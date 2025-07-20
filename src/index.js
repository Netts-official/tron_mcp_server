#!/usr/bin/env node
console.error('[TRON-MCP] Starting...');

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import TronWeb from 'tronweb';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { TronDocumentation } from './documentation.js';
import { TronScanAPI } from './tronscan.js';
import { PriceTracker } from './price-tracker.js';
import { NetworkMonitor } from './network-monitor.js';
import { EnergyEstimator } from './energy-estimator.js';

import { MarketModule } from './modules/market/index.js';
import { AccountModule } from './modules/account/index.js';
import { BlockchainModule } from './modules/blockchain/index.js';
console.error('[TRON-MCP] Imports completed');
dotenv.config();
console.error('[TRON-MCP] Environment loaded');

class TronMcpServer {
  constructor() {
    console.error('[TRON-MCP] Creating server instance...');
    try {
      this.server = new Server(
        {
          name: 'mcp-tron-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      console.error('[TRON-MCP] Server instance created');

      this.setupHandlers();
      console.error('[TRON-MCP] Handlers setup complete');
      
      this.initializeTronWeb();
      console.error('[TRON-MCP] TronWeb initialized');
      
      this.documentation = new TronDocumentation();
      console.error('[TRON-MCP] Documentation module initialized');
      
      this.tronScanAPI = new TronScanAPI();
      console.error('[TRON-MCP] TronScan API initialized');
      
      this.priceTracker = new PriceTracker();
      
      this.marketModule = new MarketModule(this.priceTracker);
      
      this.accountModule = new AccountModule(this.tronWeb, this.trongridApiCall.bind(this), this.tronscanApiCall.bind(this), this.executeWithFallback.bind(this));
      
      this.blockchainModule = new BlockchainModule(this.tronWeb, this.trongridApiCall.bind(this), this.tronscanApiCall.bind(this), this.tronScanAPI);
      console.error('[TRON-MCP] Blockchain module initialized');
      console.error('[TRON-MCP] Account module initialized');
      console.error('[TRON-MCP] Market module initialized');
      console.error('[TRON-MCP] Price tracker initialized');
      
      this.networkMonitor = null;
      this.energyEstimator = null;
      this.nodeAvailable = null; // null = not tested, true = available, false = unavailable
    } catch (error) {
      console.error('[TRON-MCP] Constructor error:', error.message);
      console.error('[TRON-MCP] Stack:', error.stack);
      throw error;
    }
  }

  initializeTronWeb() {
    const HttpProvider = TronWeb.providers.HttpProvider;
    const fullNode = new HttpProvider(process.env.FULL_NODE_URL || 'https://api.trongrid.io');
    const solidityNode = new HttpProvider(process.env.SOLIDITY_NODE_URL || 'https://api.trongrid.io');
    const eventServer = new HttpProvider(process.env.EVENT_SERVER_URL || 'https://api.trongrid.io');
    
    this.tronWeb = new TronWeb(fullNode, solidityNode, eventServer);
    
    // Set API key if available
    if (process.env.TRONGRID_API_KEY) {
      this.tronWeb.setHeader({'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY});
    }
    
    if (process.env.PRIVATE_KEY) {
      this.tronWeb.setPrivateKey(process.env.PRIVATE_KEY);
    } else {
      // Set the fixed sender address for energy estimation (read-only operations)
      // Using the address you provided for USDT sending operations
      this.tronWeb.setAddress('TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK'); // Fixed sender address
    }
    
    // Initialize energy estimator after TronWeb is fully configured
    try {
      // Wait a bit to ensure TronWeb is fully initialized
      setTimeout(() => {
        try {
          this.energyEstimator = new EnergyEstimator(this.tronWeb);
          console.error('[TRON-MCP] Energy estimator initialized successfully');
        } catch (error) {
          console.error('[TRON-MCP] Failed to initialize energy estimator:', error.message);
          this.energyEstimator = null;
        }
      }, 100);
    } catch (error) {
      console.error('[TRON-MCP] Failed to schedule energy estimator initialization:', error.message);
      this.energyEstimator = null;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_balance',
          description: 'Get TRX balance for an address',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'TRON address',
              },
            },
            required: ['address'],
          },
        },
        {
          name: 'get_account_resources',
          description: 'Get account resources (bandwidth and energy)',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'TRON address',
              },
            },
            required: ['address'],
          },
        },
        {
          name: 'send_trx',
          description: 'Send TRX to an address',
          inputSchema: {
            type: 'object',
            properties: {
              to: {
                type: 'string',
                description: 'Recipient TRON address',
              },
              amount: {
                type: 'number',
                description: 'Amount in TRX',
              },
              privateKey: {
                type: 'string',
                description: 'Private key of sender (optional if set in env)',
              },
            },
            required: ['to', 'amount'],
          },
        },
        {
          name: 'get_transaction',
          description: 'Get transaction details by hash',
          inputSchema: {
            type: 'object',
            properties: {
              txHash: {
                type: 'string',
                description: 'Transaction hash',
              },
            },
            required: ['txHash'],
          },
        },
        {
          name: 'get_block',
          description: 'Get block information with smart size management to prevent token overflow',
          inputSchema: {
            type: 'object',
            properties: {
              blockNumber: {
                type: 'number',
                description: 'Block number (optional, returns latest if not provided)',
              },
              summary: {
                type: 'boolean',
                description: 'Return summary only without full transaction data (default: true)',
              },
              includeTransactions: {
                type: 'boolean',
                description: 'Include transactions in response (default: false)',
              },
              transactionLimit: {
                type: 'number',
                description: 'Maximum number of transactions to include (default: 10)',
              },
              saveToFile: {
                type: 'boolean',
                description: 'Save full block data to file and return file path (default: false)',
              },
              fullResponse: {
                type: 'boolean',
                description: 'Return full block data without limits - WARNING: may exceed token limit (default: false)',
              },
            },
          },
        },
        {
          name: 'get_current_block_number',
          description: 'Get current block number only (compact output)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'contract_call',
          description: 'Call a smart contract function',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: {
                type: 'string',
                description: 'Smart contract address',
              },
              functionName: {
                type: 'string',
                description: 'Function name to call',
              },
              parameters: {
                type: 'array',
                description: 'Function parameters',
                items: {},
              },
              feeLimit: {
                type: 'number',
                description: 'Fee limit in SUN (optional)',
              },
            },
            required: ['contractAddress', 'functionName'],
          },
        },
        {
          name: 'estimate_energy',
          description: 'Estimate energy consumption for a contract call',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: {
                type: 'string',
                description: 'Smart contract address',
              },
              functionName: {
                type: 'string',
                description: 'Function name',
              },
              parameters: {
                type: 'array',
                description: 'Function parameters',
                items: {},
              },
            },
            required: ['contractAddress', 'functionName'],
          },
        },
        {
          name: 'get_java_tron_releases',
          description: 'Get latest java-tron releases from GitHub',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of releases to fetch (default: 10)',
              },
            },
          },
        },
        {
          name: 'search_tron_docs',
          description: 'Search TRON documentation and get relevant resources',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              topic: {
                type: 'string',
                description: 'Specific topic to search within',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_tron_reference',
          description: 'Get quick reference for TRON concepts',
          inputSchema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Reference topic (addresses, units, fees, limits)',
              },
            },
            required: ['topic'],
          },
        },
        {
          name: 'get_trx_price',
          description: 'Get current TRX price from CoinGecko',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_trx_market_data',
          description: 'Get detailed TRX market data',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_network_statistics',
          description: 'Get comprehensive TRON network statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_energy_consumption',
          description: 'Get energy consumption statistics',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of contracts to return (default: 10)',
              },
            },
          },
        },
        {
          name: 'get_defi_tvl',
          description: 'Get DeFi Total Value Locked data',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_staking_info',
          description: 'Get TRX staking rate and information',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_chain_parameters',
          description: 'Get current chain parameters',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_energy_prices',
          description: 'Get current energy and bandwidth prices',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_java_tron_readme',
          description: 'Get java-tron README documentation',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_java_tron_file',
          description: 'Get content of a specific file from java-tron repository',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path in the repository (e.g., "actuator/src/main/java/org/tron/core/actuator/TransferActuator.java")',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'search_java_tron',
          description: 'Search in java-tron repository',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              type: {
                type: 'string',
                description: 'Search type: code, issues, commits (default: code)',
              },
              limit: {
                type: 'number',
                description: 'Number of results (default: 20)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_java_tron_structure',
          description: 'Get java-tron repository structure and modules',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_java_tron_protos',
          description: 'Get Protocol Buffer definitions from java-tron',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_java_tron_issues',
          description: 'Get recent issues from java-tron repository',
          inputSchema: {
            type: 'object',
            properties: {
              state: {
                type: 'string',
                description: 'Issue state: open, closed, all (default: open)',
              },
              limit: {
                type: 'number',
                description: 'Number of issues (default: 20)',
              },
            },
          },
        },
        {
          name: 'estimate_contract_energy',
          description: 'Estimate energy consumption for smart contract interaction using TRON node',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: {
                type: 'string',
                description: 'Smart contract address',
              },
              functionName: {
                type: 'string',
                description: 'Function name to call',
              },
              parameters: {
                type: 'array',
                description: 'Function parameters',
                items: {},
              },
              callerAddress: {
                type: 'string',
                description: 'Address of the caller (optional)',
              },
              feeLimit: {
                type: 'number',
                description: 'Fee limit in SUN (optional, default: 100000000)',
              },
            },
            required: ['contractAddress', 'functionName'],
          },
        },
        {
          name: 'batch_estimate_energy',
          description: 'Batch estimate energy for multiple contract calls',
          inputSchema: {
            type: 'object',
            properties: {
              contractCalls: {
                type: 'array',
                description: 'Array of contract call objects',
                items: {
                  type: 'object',
                  properties: {
                    contractAddress: { type: 'string' },
                    functionName: { type: 'string' },
                    parameters: { type: 'array' },
                    callerAddress: { type: 'string' },
                    feeLimit: { type: 'number' }
                  },
                  required: ['contractAddress', 'functionName']
                }
              },
            },
            required: ['contractCalls'],
          },
        },
        {
          name: 'analyze_contract_gas',
          description: 'Analyze gas costs for all functions in a smart contract',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: {
                type: 'string',
                description: 'Smart contract address',
              },
            },
            required: ['contractAddress'],
          },
        },
        {
          name: 'clear_energy_cache',
          description: 'Clear energy estimation cache',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'trongrid_api_call',
          description: 'Direct call to TronGrid API endpoint',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'API endpoint (e.g., "/wallet/getnowblock", "/wallet/getaccount")',
              },
              method: {
                type: 'string',
                description: 'HTTP method (GET or POST)',
                enum: ['GET', 'POST'],
              },
              data: {
                type: 'object',
                description: 'Request body data (for POST requests)',
              },
            },
            required: ['endpoint'],
          },
        },
        {
          name: 'tronscan_api_call',
          description: 'Direct call to TronScan API endpoint',
          inputSchema: {
            type: 'object',
            properties: {
              endpoint: {
                type: 'string',
                description: 'API endpoint (e.g., "/api/block", "/api/account")',
              },
              params: {
                type: 'object',
                description: 'Query parameters',
              },
            },
            required: ['endpoint'],
          },
        },
        {
          name: 'get_trongrid_block',
          description: 'Get block information directly from TronGrid API',
          inputSchema: {
            type: 'object',
            properties: {
              blockNumber: {
                type: 'number',
                description: 'Block number (optional, returns latest if not provided)',
              },
              onlyNumber: {
                type: 'boolean',
                description: 'Return only block number (compact output)',
              },
            },
          },
        },
        {
          name: 'get_trongrid_account',
          description: 'Get account information directly from TronGrid API',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'TRON address',
              },
            },
            required: ['address'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'get_balance':
            return await this.accountModule.getBalance(args);
          case 'get_account_resources':
            return await this.accountModule.getAccountResources(args);
          case 'send_trx':
            return await this.accountModule.sendTrx(args);
          case 'get_transaction':
            return await this.blockchainModule.getTransaction(args);
          case 'get_block':
            return await this.blockchainModule.getBlock(args);
          case 'get_current_block_number':
            return await this.blockchainModule.getCurrentBlockNumber(args);
          case 'contract_call':
            return await this.contractCall(args);
          case 'estimate_energy':
            return await this.estimateEnergy(args);
          case 'get_java_tron_releases':
            return await this.getJavaTronReleases(args);
          case 'search_tron_docs':
            return await this.searchTronDocs(args);
          case 'get_tron_reference':
            return await this.getTronReference(args);
          case 'get_trx_price':
            return await this.marketModule.getTRXPrice();
          case 'get_trx_market_data':
            return await this.marketModule.getTRXMarketData();
          case 'get_network_statistics':
            return await this.getNetworkStatistics(args);
          case 'get_energy_consumption':
            return await this.getEnergyConsumption(args);
          case 'get_defi_tvl':
            return await this.getDefiTVL(args);
          case 'get_staking_info':
            return await this.getStakingInfo(args);
          case 'get_chain_parameters':
            return await this.getChainParameters(args);
          case 'get_energy_prices':
            return await this.getEnergyPrices(args);
          case 'get_java_tron_readme':
            return await this.getJavaTronReadme(args);
          case 'get_java_tron_file':
            return await this.getJavaTronFile(args);
          case 'search_java_tron':
            return await this.searchJavaTron(args);
          case 'get_java_tron_structure':
            return await this.getJavaTronStructure(args);
          case 'get_java_tron_protos':
            return await this.getJavaTronProtos(args);
          case 'get_java_tron_issues':
            return await this.getJavaTronIssues(args);
          case 'estimate_contract_energy':
            console.error(`[TRON-MCP] estimate_contract_energy called with args:`, JSON.stringify(args, null, 2));
            return await this.estimateContractEnergy(args);
          case 'batch_estimate_energy':
            return await this.batchEstimateEnergy(args);
          case 'analyze_contract_gas':
            return await this.analyzeContractGas(args);
          case 'clear_energy_cache':
            return await this.clearEnergyCache(args);
          case 'trongrid_api_call':
            return await this.trongridApiCall(args);
          case 'tronscan_api_call':
            return await this.tronscanApiCall(args);
          case 'get_trongrid_block':
            return await this.getTrongridBlock(args);
          case 'get_trongrid_account':
            return await this.getTrongridAccount(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool: ${error.message}`
        );
      }
    });
  }


  async contractCall({ contractAddress, functionName, parameters = [], feeLimit }) {
    try {
      // Use executeWithFallback for smart fallback behavior
      const result = await this.executeWithFallback({
        tronweb: async () => {
          const contract = await this.tronWeb.contract().at(contractAddress);
          const result = await contract[functionName](...parameters).send({
            feeLimit: feeLimit || 100000000,
          });
          return result;
        },
        trongrid: async () => {
          // For TronGrid, we need to use triggerconstantcontract for read-only calls
          // Determine the function signature properly
          let functionSelector = functionName;
          
          // Handle common function signatures
          if (functionName === 'balanceOf' && parameters.length === 1) {
            functionSelector = 'balanceOf(address)';
          } else if (functionName === 'transfer' && parameters.length === 2) {
            functionSelector = 'transfer(address,uint256)';
          } else if (functionName === 'approve' && parameters.length === 2) {
            functionSelector = 'approve(address,uint256)';
          }
          
          // Encode parameters correctly
          let parameter = '';
          if (parameters && parameters.length > 0) {
            // Special handling for balanceOf - just encode the address
            if (functionName === 'balanceOf' && parameters.length === 1) {
              const types = ['address'];
              const values = [parameters[0]];
              const encoded = this.tronWeb.utils.abi.encodeParams(types, values);
              parameter = encoded.replace(/^0x/, '');
            } else {
              // Use the existing encoding method for other functions
              const encoded = this.encodeContractParameters(parameters);
              parameter = encoded.replace(/^0x/, '');
            }
          }
          
          const result = await this.trongridApiCall({
            endpoint: '/wallet/triggerconstantcontract',
            method: 'POST',
            data: {
              owner_address: this.tronWeb.defaultAddress?.base58 || 'TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa',
              contract_address: contractAddress,
              function_selector: functionSelector,
              parameter: parameter,
              visible: true
            }
          });
          return JSON.parse(result.content[0].text).result;
        },
        tronscan: async () => {
          // TronScan doesn't support contract calls, throw error
          throw new Error('TronScan API does not support contract calls - read-only API');
        }
      }, 'contractCall');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              contractAddress,
              functionName,
              parameters,
              feeLimit: feeLimit || 100000000
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to call contract: ${error.message}`
      );
    }
  }

  // Helper function to encode contract parameters for TronGrid API
  encodeContractParameters(parameters) {
    try {
      if (!parameters || parameters.length === 0) {
        return '';
      }
      
      // For USDT transfer function: transfer(address,uint256)
      if (parameters.length === 2) {
        try {
          // Assume first parameter is address, second is amount (uint256)
          const toAddress = parameters[0];
          const amount = parameters[1];
          
          // Validate address format
          if (typeof toAddress === 'string' && toAddress.startsWith('T') && toAddress.length === 34) {
            return this.tronWeb.utils.abi.encodeParams(['address', 'uint256'], [toAddress, amount]);
          }
        } catch (encodeError) {
          console.error('USDT parameter encoding failed:', encodeError.message);
        }
      }
      
      // Fallback for other parameter combinations
      const types = parameters.map(param => {
        if (typeof param === 'string' && param.startsWith('T') && param.length === 34) {
          return 'address';
        } else if (typeof param === 'number' || (typeof param === 'string' && /^\d+$/.test(param))) {
          return 'uint256';
        } else if (typeof param === 'string') {
          return 'string';
        } else if (typeof param === 'boolean') {
          return 'bool';
        } else {
          return 'bytes';
        }
      });
      
      return this.tronWeb.utils.abi.encodeParams(types, parameters);
    } catch (error) {
      console.error('Parameter encoding failed:', error.message);
      return '';
    }
  }

  async estimateEnergy({ contractAddress, functionName, parameters = [] }) {
    try {
      // Use the same fallback system as estimateContractEnergy
      return await this.estimateContractEnergy({
        contractAddress,
        functionName,
        parameters,
        callerAddress: null,
        feeLimit: 100000000
      });
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to estimate energy: ${error.message}`
      );
    }
  }

  async getJavaTronReleases({ limit = 10 }) {
    try {
      const releases = await this.documentation.getJavaTronReleases(limit);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(releases, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get java-tron releases: ${error.message}`
      );
    }
  }

  async searchTronDocs({ query, topic }) {
    try {
      const results = await this.documentation.searchDocumentation(query, topic);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search documentation: ${error.message}`
      );
    }
  }

  async getTronReference({ topic }) {
    try {
      const reference = await this.documentation.getQuickReference(topic);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(reference, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get reference: ${error.message}`
      );
    }
  }


  async getNetworkStatistics() {
    try {
      const stats = await this.tronScanAPI.getTronStatistics();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get network statistics: ${error.message}`
      );
    }
  }

  async getEnergyConsumption({ limit = 10 }) {
    try {
      const energyData = await this.tronScanAPI.getEnergyConsumptionData(limit);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(energyData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get energy consumption data: ${error.message}`
      );
    }
  }

  async getDefiTVL() {
    try {
      const tvlData = await this.tronScanAPI.getDefiTVL();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tvlData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get DeFi TVL data: ${error.message}`
      );
    }
  }

  async getStakingInfo() {
    try {
      const stakingData = await this.tronScanAPI.getStakingRate();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stakingData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get staking info: ${error.message}`
      );
    }
  }

  async getChainParameters() {
    try {
      // Try to get cached data from network monitor first
      if (this.networkMonitor) {
        try {
          const parameters = this.networkMonitor.getChainParameters();
          if (parameters) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    ...parameters,
                    source: 'network_monitor_cache'
                  }, null, 2),
                },
              ],
            };
          }
        } catch (error) {
          console.error('Network monitor error, falling back to direct API call:', error.message);
        }
      }
      
      // Use executeWithFallback for smart fallback behavior
      const result = await this.executeWithFallback({
        tronweb: async () => {
          const parameters = await this.tronWeb.trx.getChainParameters();
          return parameters;
        },
        trongrid: async () => {
          const result = await this.trongridApiCall({
            endpoint: '/wallet/getchainparameters',
            method: 'POST',
            data: {}
          });
          return JSON.parse(result.content[0].text).result;
        },
        tronscan: async () => {
          // TronScan API has different endpoint structure for chain parameters
          const result = await this.tronscanApiCall({
            endpoint: '/api/system/parameters',
            params: {}
          });
          const scanData = JSON.parse(result.content[0].text).result;
          
          // Convert TronScan format to standard TRON format
          const parameters = {
            chainParameter: scanData.map(param => ({
              key: param.key,
              value: param.value
            }))
          };
          
          return parameters;
        }
      }, 'getChainParameters');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get chain parameters: ${error.message}`
      );
    }
  }

  async getEnergyPrices() {
    try {
      // Use executeWithFallback for smart fallback behavior
      const result = await this.executeWithFallback({
        tronweb: async () => {
          // Get chain parameters from TronWeb node
          const chainParams = await this.tronWeb.trx.getChainParameters();
          return this.processChainParametersForEnergyPrices(chainParams);
        },
        trongrid: async () => {
          // Get chain parameters from TronGrid API
          const response = await fetch('https://api.trongrid.io/wallet/getchainparameters', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || ''
            },
            body: JSON.stringify({})
          });
          
          if (!response.ok) {
            throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          return this.processChainParametersForEnergyPrices(data.chainParameter || []);
        },
        tronscan: async () => {
          // Original TronScan API call
          const prices = await this.tronScanAPI.getEnergyPrices();
          return prices;
        }
      }, 'getEnergyPrices');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Last resort: return static energy prices based on known values
      console.error('All energy price sources failed, using fallback values:', error.message);
      
      const fallbackPrices = {
        energy_price_sun: 210, // 210 SUN per energy unit (current network value)
        bandwidth_price_sun: 1000, // 1000 SUN per bandwidth unit
        create_account_fee: 100000, // 0.1 TRX in SUN
        transaction_fee: 1000, // 0.001 TRX in SUN
        witness_create_fee: 9999000000, // 9999 TRX in SUN
        asset_issue_fee: 1024000000, // 1024 TRX in SUN
        last_updated: new Date().toISOString(),
        source: 'fallback_static_values',
        note: 'All API sources failed, using static fallback values'
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(fallbackPrices, null, 2),
          },
        ],
      };
    }
  }

  // Helper function to process chain parameters and extract energy pricing info
  processChainParametersForEnergyPrices(chainParams) {
    const params = Array.isArray(chainParams) ? chainParams : chainParams.chainParameter || [];
    
    const result = {
      source: 'chain_parameters',
      last_updated: new Date().toISOString(),
      raw_parameters: {}
    };

    // Extract key parameters
    params.forEach(param => {
      if (param.key && param.value !== undefined) {
        result.raw_parameters[param.key] = param.value;
      }
    });

    // Calculate energy prices from chain parameters
    const energyFee = result.raw_parameters.getEnergyFee || 210; // Default 210 SUN (current network value)
    const transactionFee = result.raw_parameters.getTransactionFee || 1000; // Default 1000 SUN
    const createAccountFee = result.raw_parameters.getCreateAccountFee || 100000; // Default 0.1 TRX
    
    result.energy_price_sun = energyFee;
    result.bandwidth_price_sun = transactionFee;
    result.create_account_fee = createAccountFee;
    result.transaction_fee = transactionFee;

    // Add additional useful parameters
    if (result.raw_parameters.getAccountUpgradeCost) {
      result.witness_create_fee = result.raw_parameters.getAccountUpgradeCost;
    }
    if (result.raw_parameters.getAssetIssueFee) {
      result.asset_issue_fee = result.raw_parameters.getAssetIssueFee;
    }

    return result;
  }

  async getJavaTronReadme() {
    try {
      const readme = await this.documentation.getJavaTronReadme();
      
      return {
        content: [
          {
            type: 'text',
            text: readme.content,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get java-tron README: ${error.message}`
      );
    }
  }

  async getJavaTronFile({ path }) {
    try {
      const file = await this.documentation.getJavaTronFileContent(path);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(file, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get file content: ${error.message}`
      );
    }
  }

  async searchJavaTron({ query, type = 'code', limit = 20 }) {
    try {
      const results = await this.documentation.searchJavaTronRepo(query, { type, limit });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search java-tron: ${error.message}`
      );
    }
  }

  async getJavaTronStructure() {
    try {
      const structure = await this.documentation.getJavaTronStructure();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structure, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get java-tron structure: ${error.message}`
      );
    }
  }

  async getJavaTronProtos() {
    try {
      const protos = await this.documentation.getProtocolBuffers();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(protos, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get Protocol Buffers: ${error.message}`
      );
    }
  }

  async getJavaTronIssues({ state = 'open', limit = 20 }) {
    try {
      const issues = await this.documentation.getJavaTronIssues(state, limit);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(issues, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get issues: ${error.message}`
      );
    }
  }

  async estimateContractEnergy({ contractAddress, functionName, parameters = [], callerAddress, feeLimit = 100000000 }) {
    try {
      // Use executeWithFallback for energy estimation
      const result = await this.executeWithFallback({
        tronweb: async () => {
          if (!this.energyEstimator) {
            throw new Error('Energy estimator not initialized');
          }
          
          return await this.energyEstimator.estimateContractEnergy(
            contractAddress,
            functionName,
            parameters,
            callerAddress,
            feeLimit
          );
        },
        trongrid: async () => {
          // TronGrid fallback for energy estimation with real API call
          // Use the fixed sender address that has USDT for accurate estimation
          // This address should have USDT balance for proper energy calculation
          const fromAddress = callerAddress || 'TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa';
          
          console.error(`[TRON-MCP] Using sender address: ${fromAddress}`);
          
          try {
            // Prepare parameters for USDT transfer function
            let parameter_hex = '';
            let function_selector = '';
            
            if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer' && parameters.length === 2) {
              // USDT transfer logic
              const userAddress = parameters[0];
              const amount = parameters[1];
              
              // Check if user provided a valid TRON address
              const isUserAddressProvided = userAddress && 
                                          typeof userAddress === 'string' &&
                                          userAddress.startsWith('T') && 
                                          userAddress.length === 34;
              
              console.error(`[TRON-MCP] USDT transfer request: address="${userAddress}", amount=${amount}`);
              
              if (isUserAddressProvided) {
                // CASE 1: User provided specific address - check ONLY that address
                try {
                  const inputTypes = ['address', 'uint256'];
                  const inputValues = [userAddress, amount];
                  const encodedParams = this.tronWeb.utils.abi.encodeParams(inputTypes, inputValues);
                  parameter_hex = encodedParams.replace(/^0x/, '');
                  
                  const result = await this.trongridApiCall({
                    endpoint: '/wallet/triggerconstantcontract',
                    method: 'POST',
                    data: {
                      owner_address: fromAddress,
                      contract_address: contractAddress,
                      function_selector: 'transfer(address,uint256)',
                      parameter: parameter_hex,
                      visible: true
                    }
                  });
                  
                  const apiResult = JSON.parse(result.content[0].text).result;
                  const energyUsed = apiResult.energy_used || 0;
                  
                  console.error(`[TRON-MCP] Result for ${userAddress}: ${energyUsed} energy`);
                  
                  // Simple response - just return the energy needed
                  const responseData = {
                    contractAddress,
                    functionName,
                    parameters,
                    callerAddress: fromAddress,
                    estimations: {
                      trongrid: {
                        energy: energyUsed,
                        method: 'triggerconstantcontract',
                        accuracy: 'high',
                        recipient_address: userAddress,
                        api_response: apiResult
                      }
                    },
                    recommended: energyUsed,
                    timestamp: new Date().toISOString()
                  };
                  
                  return responseData; // IMPORTANT: Must return the result!
                  
                } catch (error) {
                  console.error(`[TRON-MCP] Failed to check user address: ${error.message}`);
                  
                  // Fallback to standard addresses when user address fails
                  const addressWithUSDT = 'TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD'; // Address with USDT
                  const addressWithoutUSDT = 'TZ4UXDV5ZhNW7fb2AMSbgfAEZ7hWsnYS2g'; // Fresh address without USDT
                  
                  const results = {};
                  
                  // Request 1: To address WITH USDT
                  try {
                    const inputTypes = ['address', 'uint256'];
                    const inputValues = [addressWithUSDT, amount];
                    const encodedParams = this.tronWeb.utils.abi.encodeParams(inputTypes, inputValues);
                    const parameter_hex = encodedParams.replace(/^0x/, '');
                    
                    const resultWithUSDT = await this.trongridApiCall({
                      endpoint: '/wallet/triggerconstantcontract',
                      method: 'POST',
                      data: {
                        owner_address: fromAddress,
                        contract_address: contractAddress,
                        function_selector: 'transfer(address,uint256)',
                        parameter: parameter_hex,
                        visible: true
                      }
                    });
                    
                    const apiResultWithUSDT = JSON.parse(resultWithUSDT.content[0].text).result;
                    results.withUSDT = {
                      address: addressWithUSDT,
                      energy: apiResultWithUSDT.energy_used || 0,
                      api_response: apiResultWithUSDT
                    };
                    
                    console.error(`[TRON-MCP] Fallback WITH USDT (${addressWithUSDT}): ${results.withUSDT.energy} energy`);
                  } catch (err) {
                    console.error(`[TRON-MCP] Fallback request to address WITH USDT failed: ${err.message}`);
                    results.withUSDT = { address: addressWithUSDT, energy: 64285, error: err.message };
                  }
                  
                  // Request 2: To address WITHOUT USDT
                  try {
                    const inputTypes = ['address', 'uint256'];
                    const inputValues = [addressWithoutUSDT, amount];
                    const encodedParams = this.tronWeb.utils.abi.encodeParams(inputTypes, inputValues);
                    const parameter_hex = encodedParams.replace(/^0x/, '');
                    
                    const resultWithoutUSDT = await this.trongridApiCall({
                      endpoint: '/wallet/triggerconstantcontract',
                      method: 'POST',
                      data: {
                        owner_address: fromAddress,
                        contract_address: contractAddress,
                        function_selector: 'transfer(address,uint256)',
                        parameter: parameter_hex,
                        visible: true
                      }
                    });
                    
                    const apiResultWithoutUSDT = JSON.parse(resultWithoutUSDT.content[0].text).result;
                    results.withoutUSDT = {
                      address: addressWithoutUSDT,
                      energy: apiResultWithoutUSDT.energy_used || 0,
                      api_response: apiResultWithoutUSDT
                    };
                    
                    console.error(`[TRON-MCP] Fallback WITHOUT USDT (${addressWithoutUSDT}): ${results.withoutUSDT.energy} energy`);
                  } catch (err) {
                    console.error(`[TRON-MCP] Fallback request to address WITHOUT USDT failed: ${err.message}`);
                    results.withoutUSDT = { address: addressWithoutUSDT, energy: 130285, error: err.message };
                  }
                  
                  // Return fallback dual results
                  return {
                    contractAddress,
                    functionName,
                    parameters,
                    callerAddress: fromAddress,
                    estimations: {
                      trongrid: {
                        energy_with_usdt: results.withUSDT.energy,
                        energy_without_usdt: results.withoutUSDT.energy,
                        address_with_usdt: results.withUSDT.address,
                        address_without_usdt: results.withoutUSDT.address,
                        method: 'triggerconstantcontract_dual_fallback',
                        accuracy: 'high',
                        original_error: error.message,
                        api_responses: {
                          with_usdt: results.withUSDT.api_response,
                          without_usdt: results.withoutUSDT.api_response
                        }
                      }
                    },
                    recommended: {
                      existing_usdt_address: results.withUSDT.energy,
                      new_usdt_address: results.withoutUSDT.energy
                    },
                    timestamp: new Date().toISOString()
                  };
                }
              } else {
                // No specific address provided - use dual test addresses
                const addressWithUSDT = 'TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD'; // Address with USDT
                const addressWithoutUSDT = 'TZ4UXDV5ZhNW7fb2AMSbgfAEZ7hWsnYS2g'; // Fresh address without USDT
                
                const results = {};
                
                // Request 1: To address WITH USDT
                try {
                  const inputTypes = ['address', 'uint256'];
                  const inputValues = [addressWithUSDT, amount];
                  const encodedParams = this.tronWeb.utils.abi.encodeParams(inputTypes, inputValues);
                  parameter_hex = encodedParams.replace(/^0x/, '');
                  
                  const resultWithUSDT = await this.trongridApiCall({
                    endpoint: '/wallet/triggerconstantcontract',
                    method: 'POST',
                    data: {
                      owner_address: fromAddress,
                      contract_address: contractAddress,
                      function_selector: 'transfer(address,uint256)',
                      parameter: parameter_hex,
                      visible: true
                    }
                  });
                  
                  const apiResultWithUSDT = JSON.parse(resultWithUSDT.content[0].text).result;
                  results.withUSDT = {
                    address: addressWithUSDT,
                    energy: apiResultWithUSDT.energy_used || 0,
                    energy_penalty: apiResultWithUSDT.energy_penalty || 0,
                    api_response: apiResultWithUSDT
                  };
                  
                  console.error(`[TRON-MCP] WITH USDT (${addressWithUSDT}): ${results.withUSDT.energy} energy, penalty: ${results.withUSDT.energy_penalty}`);
                } catch (error) {
                  console.error(`[TRON-MCP] Request to address WITH USDT failed: ${error.message}`);
                  results.withUSDT = { address: addressWithUSDT, energy: 64285, error: error.message };
                }
                
                // Request 2: To address WITHOUT USDT
                try {
                  const inputTypes = ['address', 'uint256'];
                  const inputValues = [addressWithoutUSDT, amount];
                  const encodedParams = this.tronWeb.utils.abi.encodeParams(inputTypes, inputValues);
                  parameter_hex = encodedParams.replace(/^0x/, '');
                  
                  const resultWithoutUSDT = await this.trongridApiCall({
                    endpoint: '/wallet/triggerconstantcontract',
                    method: 'POST',
                    data: {
                      owner_address: fromAddress,
                      contract_address: contractAddress,
                      function_selector: 'transfer(address,uint256)',
                      parameter: parameter_hex,
                      visible: true
                    }
                  });
                  
                  const apiResultWithoutUSDT = JSON.parse(resultWithoutUSDT.content[0].text).result;
                  results.withoutUSDT = {
                    address: addressWithoutUSDT,
                    energy: apiResultWithoutUSDT.energy_used || 0,
                    energy_penalty: apiResultWithoutUSDT.energy_penalty || 0,
                    api_response: apiResultWithoutUSDT
                  };
                  
                  console.error(`[TRON-MCP] WITHOUT USDT (${addressWithoutUSDT}): ${results.withoutUSDT.energy} energy, penalty: ${results.withoutUSDT.energy_penalty}`);
                } catch (error) {
                  console.error(`[TRON-MCP] Request to address WITHOUT USDT failed: ${error.message}`);
                  results.withoutUSDT = { address: addressWithoutUSDT, energy: 130285, error: error.message };
                }
                
                // Return combined results for dual test
                return {
                  contractAddress,
                  functionName,
                  parameters,
                  callerAddress: fromAddress,
                  estimations: {
                    trongrid: {
                      energy_with_usdt: results.withUSDT.energy,
                      energy_without_usdt: results.withoutUSDT.energy,
                      address_with_usdt: results.withUSDT.address,
                      address_without_usdt: results.withoutUSDT.address,
                      method: 'triggerconstantcontract_dual',
                      accuracy: 'high',
                      api_responses: {
                        with_usdt: results.withUSDT.api_response,
                        without_usdt: results.withoutUSDT.api_response
                      }
                    }
                  },
                  recommended: {
                    existing_usdt_address: results.withUSDT.energy,
                    new_usdt_address: results.withoutUSDT.energy
                  },
                  timestamp: new Date().toISOString()
                };
              }
              
              // USDT transfer handled above - should not reach here
              throw new Error('USDT transfer logic error - no return value');
            }
            
            // For non-USDT contracts, use the general logic below
            const result = await this.trongridApiCall({
              endpoint: '/wallet/triggerconstantcontract',
              method: 'POST',
              data: {
                owner_address: fromAddress,
                contract_address: contractAddress,
                function_selector: function_selector || functionName,
                parameter: parameter_hex,
                visible: true
              }
            });
            
            console.error(`[TRON-MCP] TronGrid API request:`, {
              owner_address: fromAddress,
              contract_address: contractAddress,
              function_selector: function_selector || functionName,
              parameter: parameter_hex
            });
            
            const apiResult = JSON.parse(result.content[0].text).result;
            const energyUsed = apiResult.energy_used || 0;
            
            console.error(`[TRON-MCP] TronGrid API response:`, apiResult);
            console.error(`[TRON-MCP] Energy used from API: ${energyUsed}`);
            
            // If no energy returned, use fallback estimates with recipient address check
            // Use the forced address instead of user input for response display
            const displayToAddress = (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') 
              ? 'TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK' 
              : (parameters.length > 0 ? parameters[0] : null);
            const finalEnergy = energyUsed > 0 ? energyUsed : this.getFallbackEnergyEstimate(functionName, parameters, contractAddress, displayToAddress);
            
            return {
              contractAddress,
              functionName,
              parameters,
              callerAddress: fromAddress,
              estimations: {
                trongrid: {
                  energy: finalEnergy,
                  method: 'triggerconstantcontract',
                  accuracy: energyUsed > 0 ? 'high' : 'medium',
                  raw_energy_used: energyUsed,
                  api_response: apiResult,
                  recipient_address: displayToAddress,
                  energy_calculation: energyUsed > 0 ? 'api_response' : 'fallback_with_address_check'
                }
              },
              recommended: finalEnergy,
              timestamp: new Date().toISOString()
            };
          } catch (apiError) {
            console.error('TronGrid API call failed:', apiError.message);
            
            // Fallback to predefined values with address check
            // Use the forced address instead of user input for response display
            const displayToAddress = (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') 
              ? 'TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK' 
              : (parameters.length > 0 ? parameters[0] : null);
            const energy = this.getFallbackEnergyEstimate(functionName, parameters, contractAddress, displayToAddress);
            return {
              contractAddress,
              functionName,
              parameters,
              callerAddress: fromAddress,
              estimations: {
                fallback: {
                  energy: energy,
                  method: 'predefined',
                  accuracy: 'medium',
                  error: apiError.message,
                  recipient_address: displayToAddress,
                  energy_calculation: 'fallback_with_address_check'
                }
              },
              recommended: energy,
              timestamp: new Date().toISOString()
            };
          }
        },
        tronscan: async () => {
          // TronScan fallback - use predefined values for common contracts with address check
          // Use the forced address instead of user input for response display
          const displayToAddress = (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') 
            ? 'TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD' 
            : (parameters.length > 0 ? parameters[0] : null);
          const energy = this.getFallbackEnergyEstimate(functionName, parameters, contractAddress, displayToAddress);
          
          return {
            contractAddress,
            functionName,
            parameters,
            callerAddress: callerAddress || 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH',
            estimations: {
              fallback: {
                energy: energy,
                method: 'predefined',
                accuracy: 'medium',
                recipient_address: displayToAddress,
                energy_calculation: 'fallback_with_address_check'
              }
            },
            recommended: energy,
            timestamp: new Date().toISOString()
          };
        }
      }, 'estimateContractEnergy');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to estimate contract energy: ${error.message}`
      );
    }
  }

  // Helper function for fallback energy estimates
  getFallbackEnergyEstimate(functionName, parameters, contractAddress, toAddress = null) {
    const functionLower = functionName.toLowerCase();
    
    // USDT (TRC20) specific estimates
    if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') {
      if (functionLower === 'transfer') {
        // Check if this is a new address (no USDT balance)
        // Based on your example: TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK - new address (double energy)
        // TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD - existing address (standard energy)
        
        if (toAddress) {
          // Fixed addresses you provided:
          // TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK - new address (no USDT, double energy)
          // TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD - existing address (has USDT, standard energy)
          
          if (toAddress === 'TSLbRevWFn3hktZmfDrzRbDLfEA6RQjNwK') {
            return 28000; // Double energy for new address activation
          } else if (toAddress === 'TAHT3rrriD23a6AXmaM2YJRRvTYusKGVwD') {
            return 13940; // Standard energy for existing address
          }
        }
        
        // Default: assume existing address
        return 13940; // Standard USDT transfer energy cost
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

  async batchEstimateEnergy({ contractCalls }) {
    try {
      if (!this.energyEstimator) {
        throw new Error('Energy estimator not initialized');
      }
      
      const results = await this.energyEstimator.batchEstimateEnergy(contractCalls);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to batch estimate energy: ${error.message}`
      );
    }
  }

  async analyzeContractGas({ contractAddress }) {
    try {
      if (!this.energyEstimator) {
        throw new Error('Energy estimator not initialized');
      }
      
      const analysis = await this.energyEstimator.analyzeContractGasCosts(contractAddress);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to analyze contract gas: ${error.message}`
      );
    }
  }

  async clearEnergyCache() {
    try {
      if (!this.energyEstimator) {
        throw new Error('Energy estimator not initialized');
      }
      
      const result = await this.energyEstimator.clearCache();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to clear energy cache: ${error.message}`
      );
    }
  }

  // Check if local TRON node is available
  async checkNodeAvailability() {
    if (this.nodeAvailable !== null) {
      return this.nodeAvailable; // Use cached result
    }
    
    try {
      const startTime = Date.now();
      await this.tronWeb.trx.getCurrentBlock();
      const responseTime = Date.now() - startTime;
      
      // If response time is reasonable, consider node available
      this.nodeAvailable = responseTime < 5000; // 5 seconds timeout
      console.error(`[TRON-MCP] Local node availability: ${this.nodeAvailable ? 'Available' : 'Slow'} (${responseTime}ms)`);
      return this.nodeAvailable;
    } catch (error) {
      this.nodeAvailable = false;
      console.error('[TRON-MCP] Local node not available:', error.message);
      return false;
    }
  }

  // Helper function for multi-source API calls with automatic fallback
  async executeWithFallback(operation, operationName) {
    const sources = [];
    
    try {
      // Check node availability first for smart source selection
      const nodeAvailable = await this.checkNodeAvailability();
      
      // If node is known to be unavailable, skip it entirely
      if (!nodeAvailable) {
        console.error(`[TRON-MCP] Skipping local node for ${operationName}, going directly to TronGrid`);
        
        // Go directly to TronGrid
        if (operation.trongrid) {
          try {
            const result = await operation.trongrid();
            return { ...result, source: 'trongrid_api' };
          } catch (trongridError) {
            sources.push(`TronGrid: ${trongridError.message}`);
            console.error(`TronGrid failed for ${operationName}, trying TronScan API:`, trongridError.message);
          }
        }
        
        // Try TronScan as fallback
        if (operation.tronscan) {
          try {
            const result = await operation.tronscan();
            return { ...result, source: 'tronscan_api' };
          } catch (tronscanError) {
            sources.push(`TronScan: ${tronscanError.message}`);
            throw new Error(`All API sources failed for ${operationName}: ${sources.join(', ')}`);
          }
        }
        
        throw new Error(`No fallback sources available for ${operationName}`);
      }
      
      // Try local TronWeb node first (if available)
      try {
        const result = await operation.tronweb();
        return { ...result, source: 'tronweb_node' };
      } catch (nodeError) {
        sources.push(`TronWeb: ${nodeError.message}`);
        console.error(`TronWeb failed for ${operationName}, trying TronGrid API:`, nodeError.message);
        
        // Mark node as unavailable after failure
        this.nodeAvailable = false;
        
        // Try TronGrid API
        if (operation.trongrid) {
          try {
            const result = await operation.trongrid();
            return { ...result, source: 'trongrid_api' };
          } catch (trongridError) {
            sources.push(`TronGrid: ${trongridError.message}`);
            console.error(`TronGrid failed for ${operationName}, trying TronScan API:`, trongridError.message);
          }
        }
        
        // Try TronScan API as last resort
        if (operation.tronscan) {
          try {
            const result = await operation.tronscan();
            return { ...result, source: 'tronscan_api' };
          } catch (tronscanError) {
            sources.push(`TronScan: ${tronscanError.message}`);
            throw new Error(`All sources failed for ${operationName}: ${sources.join(', ')}`);
          }
        }
        
        throw nodeError;
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `${operationName} failed: ${error.message}`
      );
    }
  }

  async trongridApiCall({ endpoint, method = 'POST', data = {} }) {
    try {
      const tronGridUrl = process.env.FULL_NODE_URL || 'https://api.trongrid.io';
      const url = `${tronGridUrl}${endpoint}`;
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add API key if available
      if (process.env.TRONGRID_API_KEY) {
        headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
      }
      
      const options = {
        method: method.toUpperCase(),
        headers,
      };
      
      if (method.toUpperCase() === 'POST') {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              endpoint,
              method,
              data,
              result,
              timestamp: new Date().toISOString(),
              source: 'trongrid_api'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `TronGrid API call failed: ${error.message}`
      );
    }
  }

  async tronscanApiCall({ endpoint, params = {} }) {
    try {
      const tronscanUrl = 'https://apilist.tronscanapi.com';
      const url = new URL(`${tronscanUrl}${endpoint}`);
      
      // Add query parameters
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`TronScan API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              endpoint,
              params,
              result,
              timestamp: new Date().toISOString(),
              source: 'tronscan_api'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `TronScan API call failed: ${error.message}`
      );
    }
  }

  async getTrongridBlock({ blockNumber, onlyNumber = false }) {
    try {
      const endpoint = blockNumber ? '/wallet/getblockbynum' : '/wallet/getnowblock';
      const data = blockNumber ? { num: blockNumber } : {};
      
      const result = await this.trongridApiCall({ endpoint, method: 'POST', data });
      
      if (onlyNumber) {
        const blockData = JSON.parse(result.content[0].text).result;
        const number = blockData.block_header?.raw_data?.number;
        
        if (!number) {
          throw new Error('Unable to extract block number from response');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_block_number: number,
                timestamp: new Date().toISOString(),
                source: 'trongrid_api'
              }, null, 2),
            },
          ],
        };
      }
      
      return result;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `TronGrid block request failed: ${error.message}`
      );
    }
  }

  async getTrongridAccount({ address }) {
    try {
      // Use v1 API endpoint which handles base58 addresses correctly
      const result = await this.trongridApiCall({ 
        endpoint: `/v1/accounts/${address}`, 
        method: 'GET', 
        data: {}
      });
      
      return result;
    } catch (error) {
      // Fallback to old endpoint with visible parameter
      try {
        const fallbackResult = await this.trongridApiCall({ 
          endpoint: '/wallet/getaccount', 
          method: 'POST', 
          data: { 
            address: address,
            visible: true  // This tells API to accept base58 format
          }
        });
        return fallbackResult;
      } catch (fallbackError) {
        throw new McpError(
          ErrorCode.InternalError,
          `TronGrid account request failed: ${error.message}`
        );
      }
    }
  }

  async run() {
    try {
      console.error('[TRON-MCP] Creating transport...');
      const transport = new StdioServerTransport();
      console.error('[TRON-MCP] Connecting to transport...');
      await this.server.connect(transport);
      
      console.error('MCP TRON Server running on stdio');
      console.error('[TRON-MCP] Server ready to accept connections');
      
      // Initialize network monitor asynchronously (non-blocking)
      this.networkMonitor = new NetworkMonitor(
        this.tronWeb,
        this.tronScanAPI,
        this.priceTracker
      );
      
      // Initialize network monitor in background
      setImmediate(async () => {
        try {
          await this.networkMonitor.initialize();
          console.error('Network monitor initialized successfully');
        } catch (error) {
          console.error('Failed to initialize network monitor:', error.message);
          console.error('Network monitor features will be limited');
        }
      });
      
      // Keep the process alive
      process.stdin.resume();
      
      // Graceful shutdown
      const cleanup = () => {
        if (this.networkMonitor) {
          this.networkMonitor.stop();
        }
        process.exit(0);
      };
      
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
      
    } catch (error) {
      console.error('Failed to start MCP TRON Server:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }
}

console.error('[TRON-MCP] Creating TronMcpServer instance...');
const server = new TronMcpServer();
console.error('[TRON-MCP] Starting server.run()...');
server.run().catch((error) => {
  console.error('[TRON-MCP] Fatal error:', error.message);
  console.error('[TRON-MCP] Stack:', error.stack);
  process.exit(1);
});