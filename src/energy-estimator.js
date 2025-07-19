import TronWeb from 'tronweb';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

/**
 * EnergyEstimator class for accurate energy consumption estimation
 * Directly interacts with TRON node instead of TronScan API
 */
export class EnergyEstimator {
  constructor(tronWeb) {
    this.tronWeb = tronWeb;
    this.cacheDir = path.join(process.cwd(), 'cache');
    this.contractCache = new Map();
    // Don't call async function in constructor
    this.ensureCacheDirSync();
  }

  ensureCacheDirSync() {
    try {
      if (!fsSync.existsSync(this.cacheDir)) {
        fsSync.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Estimate energy consumption for a smart contract call
   * @param {string} contractAddress - Contract address
   * @param {string} functionName - Function name to call
   * @param {Array} parameters - Function parameters
   * @param {string} callerAddress - Address of the caller (optional)
   * @param {number} feeLimit - Fee limit in SUN (optional)
   * @returns {Promise<Object>} Energy estimation result
   */
  async estimateContractEnergy(contractAddress, functionName, parameters = [], callerAddress = null, feeLimit = 100000000) {
    try {
      // Validate contract address
      if (!this.tronWeb.isAddress(contractAddress)) {
        throw new Error(`Invalid contract address: ${contractAddress}`);
      }

      // Use default address if caller not provided
      const fromAddress = callerAddress || this.tronWeb.defaultAddress.base58;
      if (!fromAddress) {
        throw new Error('No caller address provided and no default address set');
      }

      // Get contract instance
      const contract = await this.getContractInstance(contractAddress);
      
      // Build transaction
      const transaction = await this.buildContractTransaction(
        contract,
        functionName,
        parameters,
        fromAddress,
        feeLimit
      );

      // Estimate energy using different methods
      const estimations = await this.performEnergyEstimation(
        transaction,
        contractAddress,
        functionName,
        parameters,
        fromAddress
      );

      return {
        contractAddress,
        functionName,
        parameters,
        callerAddress: fromAddress,
        estimations,
        recommended: estimations.triggerConstantContract || estimations.estimateEnergy || estimations.fallback,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Energy estimation failed:', error);
      throw new Error(`Energy estimation failed: ${error.message}`);
    }
  }

  /**
   * Get contract instance with caching
   */
  async getContractInstance(contractAddress) {
    if (this.contractCache.has(contractAddress)) {
      return this.contractCache.get(contractAddress);
    }

    try {
      const contract = await this.tronWeb.contract().at(contractAddress);
      this.contractCache.set(contractAddress, contract);
      return contract;
    } catch (error) {
      throw new Error(`Failed to get contract instance: ${error.message}`);
    }
  }

  /**
   * Build contract transaction
   */
  async buildContractTransaction(contract, functionName, parameters, fromAddress, feeLimit) {
    try {
      // Check if function exists
      if (!contract[functionName]) {
        throw new Error(`Function '${functionName}' not found in contract`);
      }

      // Build transaction
      const transaction = await contract[functionName](...parameters).send({
        from: fromAddress,
        feeLimit: feeLimit,
        shouldPollResponse: false,
        callValue: 0
      });

      return transaction;
    } catch (error) {
      throw new Error(`Failed to build transaction: ${error.message}`);
    }
  }

  /**
   * Perform energy estimation using multiple methods
   */
  async performEnergyEstimation(transaction, contractAddress, functionName, parameters, fromAddress) {
    const estimations = {};

    // Method 1: triggerConstantContract (most accurate for read operations)
    try {
      const constantResult = await this.tronWeb.trx.triggerConstantContract(
        contractAddress,
        functionName,
        {},
        parameters,
        fromAddress
      );
      
      if (constantResult && constantResult.energy_used) {
        estimations.triggerConstantContract = {
          energy: constantResult.energy_used,
          method: 'triggerConstantContract',
          accuracy: 'high'
        };
      }
    } catch (error) {
      console.warn('triggerConstantContract estimation failed:', error.message);
    }

    // Method 2: estimateEnergy (for write operations)
    try {
      // For USDT, use direct contract call estimation
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
        const contract = await this.getContractInstance(contractAddress);
        const energyEstimate = await this.tronWeb.transactionBuilder.estimateEnergy(
          contract.transfer(parameters[0], parameters[1]),
          fromAddress
        );

        if (energyEstimate && energyEstimate.energy_required) {
          estimations.estimateEnergy = {
            energy: energyEstimate.energy_required,
            method: 'estimateEnergy',
            accuracy: 'high'
          };
        }
      } else {
        const energyEstimate = await this.tronWeb.transactionBuilder.estimateEnergy(
          contractAddress,
          functionName,
          {},
          parameters,
          fromAddress
        );

        if (energyEstimate && energyEstimate.energy_required) {
          estimations.estimateEnergy = {
            energy: energyEstimate.energy_required,
            method: 'estimateEnergy',
            accuracy: 'medium'
          };
        }
      }
    } catch (error) {
      console.warn('estimateEnergy estimation failed:', error.message);
    }

    // Method 3: Direct RPC call to node
    try {
      const rpcResult = await this.estimateEnergyViaRPC(
        contractAddress,
        functionName,
        parameters,
        fromAddress
      );
      
      if (rpcResult) {
        estimations.rpcCall = {
          energy: rpcResult.energy_used || rpcResult.energy_required,
          method: 'rpcCall',
          accuracy: 'high'
        };
      }
    } catch (error) {
      console.warn('RPC estimation failed:', error.message);
    }

    // Method 4: Historical data analysis
    try {
      const historicalEstimate = await this.getHistoricalEnergyUsage(
        contractAddress,
        functionName
      );
      
      if (historicalEstimate) {
        estimations.historical = {
          energy: historicalEstimate.averageEnergy,
          method: 'historical',
          accuracy: 'medium',
          sampleSize: historicalEstimate.sampleSize
        };
      }
    } catch (error) {
      console.warn('Historical estimation failed:', error.message);
    }

    // Fallback estimation based on contract type and function
    estimations.fallback = {
      energy: this.getFallbackEnergyEstimate(functionName, parameters, contractAddress),
      method: 'fallback',
      accuracy: 'low'
    };

    return estimations;
  }

  /**
   * Estimate energy via direct RPC call
   */
  async estimateEnergyViaRPC(contractAddress, functionName, parameters, fromAddress) {
    try {
      // For USDT transfer, use proper parameter encoding
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
        const contract = await this.getContractInstance(contractAddress);
        const transaction = await contract.transfer(parameters[0], parameters[1]).send({
          from: fromAddress,
          feeLimit: 100000000,
          shouldPollResponse: false
        });
        
        if (transaction && transaction.energy_used) {
          return { energy_used: transaction.energy_used };
        }
      }

      const functionSelector = this.tronWeb.utils.sha3(functionName).slice(0, 8);
      const parametersEncoded = this.tronWeb.utils.abi.encodeParams(
        ['address', 'string', 'array'],
        [contractAddress, functionName, parameters]
      );

      const rpcCall = {
        owner_address: this.tronWeb.address.toHex(fromAddress),
        contract_address: this.tronWeb.address.toHex(contractAddress),
        function_selector: functionSelector,
        parameter: parametersEncoded,
        visible: true
      };

      const result = await this.tronWeb.trx.call('wallet/triggerconstantcontract', rpcCall);
      return result;
    } catch (error) {
      console.warn('RPC call failed:', error.message);
      return null;
    }
  }

  /**
   * Get historical energy usage for a contract function
   */
  async getHistoricalEnergyUsage(contractAddress, functionName) {
    try {
      const cacheKey = `${contractAddress}_${functionName}_history`;
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

      // Try to load from cache
      try {
        const cached = await fs.readFile(cachePath, 'utf8');
        const data = JSON.parse(cached);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
          return data;
        }
      } catch (error) {
        // Cache miss, continue to fetch
      }

      // Fetch recent transactions for this contract
      const transactions = await this.getRecentContractTransactions(contractAddress, functionName);
      
      if (transactions.length > 0) {
        const energyUsages = transactions
          .filter(tx => tx.energy_used && tx.energy_used > 0)
          .map(tx => tx.energy_used);

        if (energyUsages.length > 0) {
          const averageEnergy = Math.round(
            energyUsages.reduce((sum, energy) => sum + energy, 0) / energyUsages.length
          );

          const historicalData = {
            averageEnergy,
            sampleSize: energyUsages.length,
            timestamp: Date.now()
          };

          // Cache the result
          await fs.writeFile(cachePath, JSON.stringify(historicalData, null, 2));
          return historicalData;
        }
      }

      return null;
    } catch (error) {
      console.warn('Historical analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Get recent transactions for a contract
   */
  async getRecentContractTransactions(contractAddress, functionName, limit = 50) {
    try {
      // This would typically query the TRON node for recent transactions
      // For now, we'll use a simplified approach
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();
      const transactions = [];

      // Search through recent blocks for contract transactions
      for (let i = 0; i < 10 && transactions.length < limit; i++) {
        const blockNum = currentBlock.block_header.raw_data.number - i;
        const block = await this.tronWeb.trx.getBlock(blockNum);
        
        if (block.transactions) {
          for (const tx of block.transactions) {
            if (tx.raw_data.contract && tx.raw_data.contract[0]) {
              const contract = tx.raw_data.contract[0];
              if (contract.type === 'TriggerSmartContract' && 
                  contract.parameter.value.contract_address === this.tronWeb.address.toHex(contractAddress)) {
                
                const txInfo = await this.tronWeb.trx.getTransactionInfo(tx.txID);
                if (txInfo.receipt && txInfo.receipt.energy_usage) {
                  transactions.push({
                    txID: tx.txID,
                    energy_used: txInfo.receipt.energy_usage,
                    block_number: blockNum
                  });
                }
              }
            }
          }
        }
      }

      return transactions;
    } catch (error) {
      console.warn('Failed to get recent transactions:', error.message);
      return [];
    }
  }

  /**
   * Get fallback energy estimate based on function type
   */
  getFallbackEnergyEstimate(functionName, parameters, contractAddress) {
    const functionLower = functionName.toLowerCase();
    
    // USDT (TRC20) specific estimates
    if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') {
      if (functionLower === 'transfer') {
        return 13940; // Actual USDT transfer energy cost
      }
      if (functionLower === 'approve') {
        return 13180; // USDT approve energy cost
      }
      if (functionLower === 'transferfrom') {
        return 18190; // USDT transferFrom energy cost
      }
      if (functionLower === 'balanceof') {
        return 680; // USDT balance query energy cost
      }
    }
    
    // Common TRC20 patterns
    if (functionLower.includes('transfer') || functionLower.includes('send')) {
      // For new address activation
      if (parameters.length > 2) {
        return 31990; // Energy cost for new address activation
      }
      return 14010; // Standard transfer to existing address
    }
    
    if (functionLower.includes('approve') || functionLower.includes('allowance')) {
      return 10000;
    }
    
    if (functionLower.includes('swap') || functionLower.includes('exchange')) {
      return 50000;
    }
    
    if (functionLower.includes('mint') || functionLower.includes('burn')) {
      return 30000;
    }
    
    if (functionLower.includes('view') || functionLower.includes('get') || functionLower.includes('balance')) {
      return 1000;
    }
    
    // Default estimate based on parameter count
    return 20000 + (parameters.length * 5000);
  }

  /**
   * Batch estimate energy for multiple contract calls
   */
  async batchEstimateEnergy(contractCalls) {
    const results = [];
    
    for (const call of contractCalls) {
      try {
        const result = await this.estimateContractEnergy(
          call.contractAddress,
          call.functionName,
          call.parameters || [],
          call.callerAddress,
          call.feeLimit
        );
        results.push(result);
      } catch (error) {
        results.push({
          contractAddress: call.contractAddress,
          functionName: call.functionName,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get contract ABI and analyze function gas costs
   */
  async analyzeContractGasCosts(contractAddress) {
    try {
      const contract = await this.getContractInstance(contractAddress);
      
      // Get contract info
      const contractInfo = await this.tronWeb.trx.getContract(contractAddress);
      
      const analysis = {
        contractAddress,
        contractName: contractInfo.name,
        functions: [],
        totalFunctions: 0,
        timestamp: new Date().toISOString()
      };

      // Analyze each function if ABI is available
      if (contractInfo.abi && contractInfo.abi.entrys) {
        for (const entry of contractInfo.abi.entrys) {
          if (entry.type === 'Function') {
            const functionAnalysis = {
              name: entry.name,
              type: entry.stateMutability || 'nonpayable',
              inputs: entry.inputs || [],
              estimatedEnergy: this.getFallbackEnergyEstimate(entry.name, entry.inputs || [], contractAddress)
            };

            analysis.functions.push(functionAnalysis);
          }
        }
      }

      analysis.totalFunctions = analysis.functions.length;
      return analysis;

    } catch (error) {
      throw new Error(`Contract analysis failed: ${error.message}`);
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      this.contractCache.clear();
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error.message}`);
    }
  }
}