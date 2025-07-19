#!/usr/bin/env node
console.error('[TRON-MCP] Starting enhanced server...');

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

// Импортируем существующие модули
import { TronDocumentation } from './documentation.js';
import { TronScanAPI } from './tronscan.js';
import { PriceTracker } from './price-tracker.js';
import { NetworkMonitor } from './network-monitor.js';
import { EnergyEstimator } from './energy-estimator.js';

// Импортируем новые модули для работы с актуальной документацией
import { UnifiedDocumentationAPI } from './documentation/api/unified-api.js';
import { TronGridAPIParser } from './documentation/parsers/trongrid-api.js';
import { CodeExamplesManager } from './code-examples/manager.js';
import { CacheManager } from './documentation/cache/cache-manager.js';

console.error('[TRON-MCP] Enhanced imports completed');
dotenv.config();
console.error('[TRON-MCP] Environment loaded');

class TronMcpServer {
  constructor() {
    console.error('[TRON-MCP] Creating enhanced server instance...');
    try {
      this.server = new Server(
        {
          name: 'mcp-tron-server-enhanced',
          version: '2.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      console.error('[TRON-MCP] Enhanced server instance created');

      this.setupHandlers();
      console.error('[TRON-MCP] Enhanced handlers setup complete');
      
      this.initializeTronWeb();
      console.error('[TRON-MCP] TronWeb initialized');
      
      // Инициализируем существующие модули
      this.documentation = new TronDocumentation();
      this.tronScanAPI = new TronScanAPI();
      this.priceTracker = new PriceTracker();
      this.networkMonitor = null;
      this.energyEstimator = null;
      
      // Инициализируем новые модули для работы с актуальной документацией
      this.unifiedAPI = new UnifiedDocumentationAPI();
      this.tronGridParser = new TronGridAPIParser();
      this.examplesManager = new CodeExamplesManager();
      this.cacheManager = new CacheManager();
      
      console.error('[TRON-MCP] All modules initialized successfully');
      
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
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Существующие инструменты
        {
          name: 'get_balance',
          description: 'Get TRX balance for an address',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'TRON address' },
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
              address: { type: 'string', description: 'TRON address' },
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
              to: { type: 'string', description: 'Recipient TRON address' },
              amount: { type: 'number', description: 'Amount in TRX' },
              privateKey: { type: 'string', description: 'Private key of sender (optional if set in env)' },
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
              txHash: { type: 'string', description: 'Transaction hash' },
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
              blockNumber: { type: 'number', description: 'Block number (optional, returns latest if not provided)' },
            },
          },
        },
        {
          name: 'contract_call',
          description: 'Call a smart contract function',
          inputSchema: {
            type: 'object',
            properties: {
              contractAddress: { type: 'string', description: 'Smart contract address' },
              functionName: { type: 'string', description: 'Function name to call' },
              parameters: { type: 'array', description: 'Function parameters', items: {} },
              feeLimit: { type: 'number', description: 'Fee limit in SUN (optional)' },
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
              contractAddress: { type: 'string', description: 'Smart contract address' },
              functionName: { type: 'string', description: 'Function name' },
              parameters: { type: 'array', description: 'Function parameters', items: {} },
            },
            required: ['contractAddress', 'functionName'],
          },
        },
        
        // НОВЫЕ ИНСТРУМЕНТЫ ДЛЯ РАБОТЫ С АКТУАЛЬНОЙ ДОКУМЕНТАЦИЕЙ
        {
          name: 'get_api_method_docs',
          description: 'Get complete documentation for a TronGrid API method with verified examples',
          inputSchema: {
            type: 'object',
            properties: {
              methodPath: { type: 'string', description: 'API method path (e.g., "/wallet/getcontract")' },
              includeExamples: { type: 'boolean', description: 'Include verified code examples (default: true)' },
              exampleLanguage: { type: 'string', description: 'Preferred language for examples (default: "javascript")' },
            },
            required: ['methodPath'],
          },
        },
        {
          name: 'get_method_fields',
          description: 'Get exact field structure for API method parameters and response',
          inputSchema: {
            type: 'object',
            properties: {
              methodPath: { type: 'string', description: 'API method path (e.g., "/wallet/getcontract")' },
            },
            required: ['methodPath'],
          },
        },
        {
          name: 'search_all_documentation',
          description: 'Advanced search across all TRON documentation sources',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              source: { type: 'string', description: 'Source to search (trongrid, tronscan, all)', enum: ['trongrid', 'tronscan', 'all'] },
              includeExamples: { type: 'boolean', description: 'Include code examples in results (default: true)' },
              exactMatch: { type: 'boolean', description: 'Require exact match (default: false)' },
              limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_example_with_context',
          description: 'Get verified code example with related documentation context',
          inputSchema: {
            type: 'object',
            properties: {
              exampleId: { type: 'string', description: 'Example ID' },
              language: { type: 'string', description: 'Programming language (default: "javascript")' },
              includeRelatedDocs: { type: 'boolean', description: 'Include related documentation (default: true)' },
            },
            required: ['exampleId'],
          },
        },
        {
          name: 'add_verified_example',
          description: 'Add a new verified code example to the knowledge base',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Example title' },
              description: { type: 'string', description: 'Example description' },
              category: { type: 'string', description: 'Example category (energy-rental, smart-contracts, etc.)' },
              tags: { type: 'array', description: 'Tags for categorization', items: { type: 'string' } },
              code: { type: 'object', description: 'Code in different languages (e.g., {"javascript": "...", "php": "..."})' },
              testResults: { type: 'object', description: 'Test results from different networks' },
              relatedDocs: { type: 'array', description: 'Related documentation URLs', items: { type: 'string' } },
              notes: { type: 'array', description: 'Additional notes', items: { type: 'string' } },
            },
            required: ['title', 'description', 'category', 'code'],
          },
        },
        {
          name: 'find_examples',
          description: 'Find verified code examples by criteria',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Example category' },
              tags: { type: 'array', description: 'Required tags', items: { type: 'string' } },
              language: { type: 'string', description: 'Programming language' },
              query: { type: 'string', description: 'Search query' },
              limit: { type: 'number', description: 'Maximum results (default: 10)' },
            },
          },
        },
        {
          name: 'get_api_recommendations',
          description: 'Get recommendations and best practices for API method usage',
          inputSchema: {
            type: 'object',
            properties: {
              methodPath: { type: 'string', description: 'API method path' },
            },
            required: ['methodPath'],
          },
        },
        {
          name: 'update_documentation_cache',
          description: 'Update documentation cache for fresh data',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source to update (trongrid, examples, all)', enum: ['trongrid', 'examples', 'all'] },
            },
          },
        },
        {
          name: 'get_documentation_status',
          description: 'Get current status of documentation cache and examples',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'import_examples_from_project',
          description: 'Import verified examples from netts.io project codebase',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string', description: 'Path to netts.io project directory' },
            },
            required: ['projectPath'],
          },
        },
        
        // Существующие инструменты документации (оставляем для совместимости)
        {
          name: 'get_java_tron_releases',
          description: 'Get latest java-tron releases from GitHub',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of releases to fetch (default: 10)' },
            },
          },
        },
        {
          name: 'search_tron_docs',
          description: 'Search TRON documentation and get relevant resources',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              topic: { type: 'string', description: 'Specific topic to search within' },
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
              topic: { type: 'string', description: 'Reference topic (addresses, units, fees, limits)' },
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`[TRON-MCP] Executing tool: ${name}`);

      try {
        switch (name) {
          // Существующие инструменты
          case 'get_balance':
            return await this.getBalance(args.address);
          case 'get_account_resources':
            return await this.getAccountResources(args.address);
          case 'send_trx':
            return await this.sendTrx(args.to, args.amount, args.privateKey);
          case 'get_transaction':
            return await this.getTransaction(args.txHash);
          case 'get_block':
            return await this.getBlock(args.blockNumber);
          case 'contract_call':
            return await this.contractCall(args.contractAddress, args.functionName, args.parameters, args.feeLimit);
          case 'estimate_energy':
            return await this.estimateEnergy(args.contractAddress, args.functionName, args.parameters);
          
          // НОВЫЕ ИНСТРУМЕНТЫ ДЛЯ РАБОТЫ С АКТУАЛЬНОЙ ДОКУМЕНТАЦИЕЙ
          case 'get_api_method_docs':
            return await this.getAPIMethodDocs(args.methodPath, args);
          case 'get_method_fields':
            return await this.getMethodFields(args.methodPath);
          case 'search_all_documentation':
            return await this.searchAllDocumentation(args.query, args);
          case 'get_example_with_context':
            return await this.getExampleWithContext(args.exampleId, args);
          case 'add_verified_example':
            return await this.addVerifiedExample(args);
          case 'find_examples':
            return await this.findExamples(args);
          case 'get_api_recommendations':
            return await this.getAPIRecommendations(args.methodPath);
          case 'update_documentation_cache':
            return await this.updateDocumentationCache(args.source);
          case 'get_documentation_status':
            return await this.getDocumentationStatus();
          case 'import_examples_from_project':
            return await this.importExamplesFromProject(args.projectPath);
          
          // Существующие инструменты документации
          case 'get_java_tron_releases':
            return await this.getJavaTronReleases(args.limit);
          case 'search_tron_docs':
            return await this.searchTronDocs(args.query, args.topic);
          case 'get_tron_reference':
            return await this.getTronReference(args.topic);
          case 'get_trx_price':
            return await this.getTrxPrice();
          case 'get_trx_market_data':
            return await this.getTrxMarketData();
          case 'get_network_statistics':
            return await this.getNetworkStatistics();

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`[TRON-MCP] Tool execution error for ${name}:`, error.message);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  // НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С АКТУАЛЬНОЙ ДОКУМЕНТАЦИЕЙ

  async getAPIMethodDocs(methodPath, options = {}) {
    const result = await this.unifiedAPI.getAPIMethodDocs(methodPath, options);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async getMethodFields(methodPath) {
    const result = await this.unifiedAPI.getMethodFields(methodPath);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async searchAllDocumentation(query, options = {}) {
    const result = await this.unifiedAPI.searchDocumentation(query, options);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async getExampleWithContext(exampleId, options = {}) {
    const result = await this.unifiedAPI.getExampleWithContext(exampleId, options);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async addVerifiedExample(exampleData) {
    const result = await this.unifiedAPI.addVerifiedExample(exampleData);
    return {
      content: [{
        type: 'text',
        text: `Example added successfully with ID: ${result.id}`
      }]
    };
  }

  async findExamples(criteria = {}) {
    const result = await this.examplesManager.findExamples(criteria);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async getAPIRecommendations(methodPath) {
    const result = await this.unifiedAPI.getAPIRecommendations(methodPath);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async updateDocumentationCache(source = 'all') {
    const result = await this.unifiedAPI.updateDocumentationCache(source);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async getDocumentationStatus() {
    const result = await this.unifiedAPI.getDocumentationStatus();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async importExamplesFromProject(projectPath) {
    const result = await this.examplesManager.importFromNettsProject(projectPath);
    return {
      content: [{
        type: 'text',
        text: `Imported ${result.length} examples from ${projectPath}`
      }]
    };
  }

  // СУЩЕСТВУЮЩИЕ МЕТОДЫ (сохраняем для совместимости)

  async getBalance(address) {
    const balance = await this.tronWeb.trx.getBalance(address);
    return {
      content: [{
        type: 'text',
        text: `Balance: ${this.tronWeb.fromSun(balance)} TRX`
      }]
    };
  }

  async getAccountResources(address) {
    const resources = await this.tronWeb.trx.getAccountResources(address);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(resources, null, 2)
      }]
    };
  }

  async sendTrx(to, amount, privateKey) {
    if (privateKey) {
      this.tronWeb.setPrivateKey(privateKey);
    }
    
    const tx = await this.tronWeb.trx.sendTransaction(to, this.tronWeb.toSun(amount));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(tx, null, 2)
      }]
    };
  }

  async getTransaction(txHash) {
    const tx = await this.tronWeb.trx.getTransaction(txHash);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(tx, null, 2)
      }]
    };
  }

  async getBlock(blockNumber) {
    const block = blockNumber ? 
      await this.tronWeb.trx.getBlock(blockNumber) : 
      await this.tronWeb.trx.getCurrentBlock();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(block, null, 2)
      }]
    };
  }

  async contractCall(contractAddress, functionName, parameters = [], feeLimit = 1000000) {
    const contract = await this.tronWeb.contract().at(contractAddress);
    const result = await contract[functionName](...parameters).call();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  async estimateEnergy(contractAddress, functionName, parameters = []) {
    if (!this.energyEstimator) {
      throw new Error('Energy estimator not initialized');
    }
    
    const estimate = await this.energyEstimator.estimateEnergy(contractAddress, functionName, parameters);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(estimate, null, 2)
      }]
    };
  }

  // Методы для существующих инструментов документации
  async getJavaTronReleases(limit = 10) {
    const releases = await this.documentation.getJavaTronReleases(limit);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(releases, null, 2)
      }]
    };
  }

  async searchTronDocs(query, topic) {
    const results = await this.documentation.searchDocumentation(query, topic);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
      }]
    };
  }

  async getTronReference(topic) {
    const reference = await this.documentation.getQuickReference(topic);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(reference, null, 2)
      }]
    };
  }

  async getTrxPrice() {
    const price = await this.priceTracker.getCurrentPrice();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(price, null, 2)
      }]
    };
  }

  async getTrxMarketData() {
    const data = await this.priceTracker.getMarketData();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  async getNetworkStatistics() {
    if (!this.networkMonitor) {
      this.networkMonitor = new NetworkMonitor();
    }
    const stats = await this.networkMonitor.getNetworkStats();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[TRON-MCP] Enhanced server running on stdio');
  }
}

const server = new TronMcpServer();
server.run().catch(console.error);