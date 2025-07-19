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
import { EnergyEstimator } from './energy-estimator.js';
import { USDTEnergyHelper } from './usdt-energy-helper.js';
import { ChainParametersMonitor } from './chain-parameters-monitor.js';

// Conditionally import NetworkMonitor
let NetworkMonitor;
if (process.env.SKIP_NETWORK_MONITOR !== 'true') {
  try {
    NetworkMonitor = (await import('./network-monitor.js')).NetworkMonitor;
  } catch (error) {
    console.error('[TRON-MCP] Failed to import NetworkMonitor:', error.message);
  }
}

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
      console.error('[TRON-MCP] Price tracker initialized');
      
      this.networkMonitor = null;
      this.energyEstimator = null;
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
    
    if (process.env.PRIVATE_KEY) {
      this.tronWeb.setPrivateKey(process.env.PRIVATE_KEY);
    }
    
    // Initialize energy estimator
    try {
      this.energyEstimator = new EnergyEstimator(this.tronWeb);
    } catch (error) {
      console.error('Failed to initialize energy estimator:', error.message);
      this.energyEstimator = null;
    }
    
    // Initialize USDT energy helper
    try {
      this.usdtHelper = new USDTEnergyHelper();
      console.error('[TRON-MCP] USDT Energy Helper initialized');
    } catch (error) {
      console.error('Failed to initialize USDT helper:', error.message);
      this.usdtHelper = null;
    }
    
    // Initialize Chain Parameters Monitor
    try {
      this.chainMonitor = new ChainParametersMonitor(this.tronWeb);
      console.error('[TRON-MCP] Chain Parameters Monitor initialized');
    } catch (error) {
      console.error('Failed to initialize chain monitor:', error.message);
      this.chainMonitor = null;
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
          description: 'Get block information',
          inputSchema: {
            type: 'object',
            properties: {
              blockNumber: {
                type: 'number',
                description: 'Block number (optional, returns latest if not provided)',
              },
            },
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'get_balance':
            return await this.getBalance(args);
          case 'get_account_resources':
            return await this.getAccountResources(args);
          case 'send_trx':
            return await this.sendTrx(args);
          case 'get_transaction':
            return await this.getTransaction(args);
          case 'get_block':
            return await this.getBlock(args);
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
            return await this.getTRXPrice(args);
          case 'get_trx_market_data':
            return await this.getTRXMarketData(args);
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
            return await this.estimateContractEnergy(args);
          case 'batch_estimate_energy':
            return await this.batchEstimateEnergy(args);
          case 'analyze_contract_gas':
            return await this.analyzeContractGas(args);
          case 'clear_energy_cache':
            return await this.clearEnergyCache(args);
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

  async getBalance({ address }) {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      const balanceInTrx = this.tronWeb.fromSun(balance);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              address,
              balance: balanceInTrx,
              unit: 'TRX',
              balanceInSun: balance,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get balance: ${error.message}`
      );
    }
  }

  async getAccountResources({ address }) {
    try {
      const resources = await this.tronWeb.trx.getAccountResources(address);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(resources, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get account resources: ${error.message}`
      );
    }
  }

  async sendTrx({ to, amount, privateKey }) {
    try {
      if (privateKey) {
        this.tronWeb.setPrivateKey(privateKey);
      }

      const transaction = await this.tronWeb.trx.sendTransaction(
        to,
        this.tronWeb.toSun(amount)
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: transaction.result,
              txid: transaction.txid,
              transaction,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to send TRX: ${error.message}`
      );
    }
  }

  async getTransaction({ txHash }) {
    try {
      const transaction = await this.tronWeb.trx.getTransaction(txHash);
      const transactionInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              transaction,
              info: transactionInfo,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get transaction: ${error.message}`
      );
    }
  }

  async getBlock({ blockNumber }) {
    try {
      // First try to get from local node
      try {
        const block = blockNumber 
          ? await this.tronWeb.trx.getBlock(blockNumber)
          : await this.tronWeb.trx.getCurrentBlock();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(block, null, 2),
            },
          ],
        };
      } catch (nodeError) {
        console.error('Local node failed, trying TronGrid API:', nodeError.message);
        
        // Fallback to TronGrid API
        const tronGridUrl = 'https://api.trongrid.io';
        const endpoint = blockNumber ? `/wallet/getblockbynum` : `/wallet/getnowblock`;
        const body = blockNumber ? { num: blockNumber } : {};
        
        const response = await fetch(`${tronGridUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TRON-PRO-API-KEY': process.env.API_TRONGRID || ''
          },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
        }
        
        const block = await response.json();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(block, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      // Last fallback: try TronScan API
      try {
        const block = blockNumber 
          ? await this.tronScanAPI.getBlock(blockNumber)
          : await this.tronScanAPI.getCurrentBlock();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(block, null, 2),
            },
          ],
        };
      } catch (scanError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get block from all sources: ${error.message}`
        );
      }
    }
  }

  async contractCall({ contractAddress, functionName, parameters = [], feeLimit }) {
    try {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const result = await contract[functionName](...parameters).send({
        feeLimit: feeLimit || 100000000,
      });

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
        `Failed to call contract: ${error.message}`
      );
    }
  }

  async estimateEnergy({ contractAddress, functionName, parameters = [] }) {
    try {
      // Используем Chain Parameters Monitor для real-time данных
      if (this.chainMonitor) {
        console.error('[TRON-MCP] Using Chain Parameters Monitor for real-time data');
        
        const amount = parameters[1] ? parameters[1] / 1_000_000 : 1; // Сумма в читаемом формате
        const costInfo = await this.chainMonitor.getTransactionCostInfo(
          contractAddress,
          functionName,
          parameters
        );
        
        return {
          content: [
            {
              type: 'text',
              text: this.chainMonitor.formatCostResult(costInfo, amount, 'USDT'),
            },
          ],
        };
      }
      
      // Fallback на старый метод если chainMonitor не доступен
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer' && this.usdtHelper) {
        console.error('[TRON-MCP] Fallback to USDT Energy Helper');
        
        const toAddress = parameters[0];
        const amount = parameters[1] ? parameters[1] / 1_000_000 : 0.001;
        
        const energyInfo = await this.usdtHelper.getUSDTTransferEnergy(
          this.tronWeb,
          toAddress,
          amount
        );
        
        return {
          content: [
            {
              type: 'text',
              text: this.usdtHelper.formatEnergyResult(energyInfo),
            },
          ],
        };
      }
      
      // Для других контрактов используем стандартный метод
      const contract = await this.tronWeb.contract().at(contractAddress);
      const energy = await this.tronWeb.transactionBuilder.estimateEnergy(
        contract[functionName](...parameters),
        this.tronWeb.defaultAddress.base58,
        {
          feeLimit: 100000000,
        }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              estimatedEnergy: energy,
              contractAddress,
              functionName,
              parameters,
              note: 'Для USDT используйте точные значения: 64,285 для адреса с USDT, 130,285 для нового адреса'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Если ошибка связана с адресом, даем более понятное сообщение
      if (error.message.includes('Invalid address')) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Неверный формат адреса. Используйте base58 адрес начинающийся с T'
        );
      }
      
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

  async getTRXPrice() {
    try {
      const priceData = await this.priceTracker.getTRXPrice();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(priceData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get TRX price: ${error.message}`
      );
    }
  }

  async getTRXMarketData() {
    try {
      const marketData = await this.priceTracker.getTRXMarketData();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(marketData, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get TRX market data: ${error.message}`
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
                  text: JSON.stringify(parameters, null, 2),
                },
              ],
            };
          }
        } catch (error) {
          console.error('Network monitor error, falling back to direct API call:', error.message);
        }
      }
      
      // Fallback to direct API call
      const parameters = await this.tronWeb.trx.getChainParameters();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(parameters, null, 2),
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
      // Используем Chain Parameters Monitor для получения real-time данных
      if (this.chainMonitor) {
        console.error('[TRON-MCP] Getting real-time energy prices from chain monitor');
        
        const energyCost = await this.chainMonitor.getEnergyCost();
        const parameters = await this.chainMonitor.getChainParameters();
        
        // Получаем также данные с TronScan для сравнения
        let tronScanPrices = null;
        try {
          tronScanPrices = await this.tronScanAPI.getEnergyPrices();
        } catch (e) {
          console.error('[TRON-MCP] Failed to get TronScan prices:', e.message);
        }
        
        const result = {
          realtime: {
            energyFeeSun: energyCost.energyFeeSun,
            energyCostTRX: energyCost.energyCostTRX,
            energyCostUSD: energyCost.energyCostUSD,
            energyPerTRX: energyCost.energyPerTRX,
            trxPrice: energyCost.trxPrice,
            timestamp: energyCost.timestamp,
            chainParameters: {
              getEnergyFee: parameters.getEnergyFee || 420,
              getCreateAccountFee: parameters.getCreateAccountFee || 100000,
              getTransactionFee: parameters.getTransactionFee || 1000,
              getBandwidthPrice: parameters.getBandwidthPrice || 1000
            }
          },
          market: tronScanPrices,
          comparison: tronScanPrices ? {
            note: 'Real-time data from blockchain vs market prices from TronScan',
            energyCostDifference: tronScanPrices.energy_burn_sun ? 
              ((energyCost.energyFeeSun - tronScanPrices.energy_burn_sun) / tronScanPrices.energy_burn_sun * 100).toFixed(2) + '%' :
              'N/A'
          } : null,
          usdtTransferEnergy: {
            toAddressWithUSDT: 64285,
            toNewAddress: 130285,
            note: 'Точные значения для USDT переводов на основе реальных тестов netts.io'
          }
        };
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
      
      // Fallback на TronScan API если chainMonitor не доступен
      const prices = await this.tronScanAPI.getEnergyPrices();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(prices, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get energy prices: ${error.message}`
      );
    }
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
      // Специальная обработка для USDT с точными значениями
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
        if (this.chainMonitor) {
          console.error('[TRON-MCP] Using ChainParametersMonitor for USDT energy estimation');
          
          const toAddress = parameters[0];
          const amount = parameters[1] ? parameters[1] / 1_000_000 : 1; // Конвертируем в читаемый формат
          
          const costInfo = await this.chainMonitor.getTransactionCostInfo(
            contractAddress,
            functionName,
            parameters
          );
          
          // Получаем точное значение энергии для USDT
          const usdtEnergy = await this.chainMonitor.getUSDTTransferEnergy(toAddress);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  contractAddress,
                  functionName,
                  parameters,
                  toAddress,
                  amount,
                  energyRequired: usdtEnergy.energy,
                  isNewAddress: usdtEnergy.isNewAddress,
                  description: usdtEnergy.description,
                  costInTRX: costInfo.totalCostTRX,
                  costInUSD: costInfo.totalCostUSD,
                  trxPrice: costInfo.trxPrice,
                  energyPerTRX: costInfo.energyPerTRX,
                  note: 'Точные значения на основе реальных тестов netts.io'
                }, null, 2),
              },
            ],
          };
        }
      }
      
      // Fallback для других контрактов
      if (!this.energyEstimator) {
        // Если energyEstimator не доступен, используем приблизительные значения
        console.error('[TRON-MCP] Energy estimator not available, using approximate values');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                contractAddress,
                functionName,
                parameters,
                estimatedEnergy: 50000,
                note: 'Приблизительное значение. Для точной оценки требуется инициализация energy estimator',
                warning: 'Для USDT используйте точные значения: 64,285 для адреса с USDT, 130,285 для нового адреса'
              }, null, 2),
            },
          ],
        };
      }
      
      const result = await this.energyEstimator.estimateContractEnergy(
        contractAddress,
        functionName,
        parameters,
        callerAddress,
        feeLimit
      );
      
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



  async run() {
    try {
      console.error('[TRON-MCP] Creating transport...');
      const transport = new StdioServerTransport();
      console.error('[TRON-MCP] Connecting to transport...');
      await this.server.connect(transport);
      
      console.error('MCP TRON Server running on stdio');
      console.error('[TRON-MCP] Server ready to accept connections');
      
      // Skip network monitor initialization if SKIP_NETWORK_MONITOR is set
      if (process.env.SKIP_NETWORK_MONITOR !== 'true') {
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
      } else {
        console.error('[TRON-MCP] Network monitor skipped (SKIP_NETWORK_MONITOR=true)');
      }
      
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