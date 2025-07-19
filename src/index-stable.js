#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import TronWeb from 'tronweb';
import { ChainParametersMonitor } from './chain-parameters-monitor.js';

class TronMcpServer {
  constructor() {
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

    this.setupHandlers();
    this.initializeTronWeb();
  }

  initializeTronWeb() {
    const HttpProvider = TronWeb.providers.HttpProvider;
    const fullNode = new HttpProvider(process.env.FULL_NODE_URL || 'https://api.trongrid.io');
    const solidityNode = new HttpProvider(process.env.SOLIDITY_NODE_URL || 'https://api.trongrid.io');
    const eventServer = new HttpProvider(process.env.EVENT_SERVER_URL || 'https://api.trongrid.io');
    
    this.tronWeb = new TronWeb(fullNode, solidityNode, eventServer);
    
    // Initialize Chain Parameters Monitor
    try {
      this.chainMonitor = new ChainParametersMonitor(this.tronWeb);
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
          name: 'estimate_contract_energy',
          description: 'Estimate energy consumption for smart contract interaction',
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
            },
            required: ['contractAddress', 'functionName'],
          },
        },
        {
          name: 'get_energy_prices',
          description: 'Get current energy prices and chain parameters',
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
          case 'estimate_contract_energy':
            return await this.estimateContractEnergy(args);
          case 'get_energy_prices':
            return await this.getEnergyPrices(args);
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

  async estimateContractEnergy({ contractAddress, functionName, parameters = [] }) {
    try {
      // Специальная обработка для USDT с точными значениями
      if (contractAddress === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' && functionName === 'transfer') {
        const toAddress = parameters[0];
        const amount = parameters[1] ? parameters[1] / 1_000_000 : 1;
        
        // Проверяем, есть ли у адреса USDT
        let isNewAddress = false;
        try {
          const contract = await this.tronWeb.contract().at(contractAddress);
          const balance = await contract.balanceOf(toAddress).call();
          isNewAddress = (balance.toString() === '0');
        } catch (error) {
          // Если ошибка, считаем что адрес новый
          isNewAddress = true;
        }
        
        const energyRequired = isNewAddress ? 130285 : 64285;
        
        // Получаем актуальные параметры сети
        let energyPrice = 420; // sun
        let trxPrice = 0.33;
        try {
          const chainParams = await this.tronWeb.trx.getChainParameters();
          const energyFeeParam = chainParams.find(p => p.key === 'getEnergyFee');
          if (energyFeeParam) {
            energyPrice = energyFeeParam.value;
          }
        } catch (e) {
          // Используем дефолтные значения
        }
        
        const costInSun = energyRequired * energyPrice;
        const costInTRX = costInSun / 1_000_000;
        const costInUSD = costInTRX * trxPrice;
        
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
                energyRequired,
                isNewAddress,
                description: isNewAddress ? 
                  'Первая отправка USDT на этот адрес (увеличенный расход)' : 
                  'Стандартная отправка USDT',
                costInTRX: costInTRX.toFixed(2),
                costInUSD: costInUSD.toFixed(2),
                energyPrice: energyPrice + ' sun',
                note: 'Точные значения на основе реальных тестов netts.io'
              }, null, 2),
            },
          ],
        };
      }
      
      // Fallback для других контрактов
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              contractAddress,
              functionName,
              parameters,
              estimatedEnergy: 50000,
              note: 'Приблизительное значение. Для USDT используйте точные значения: 64,285 для адреса с USDT, 130,285 для нового адреса'
            }, null, 2),
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

  async getEnergyPrices() {
    try {
      // Получаем параметры сети напрямую из блокчейна
      const chainParams = await this.tronWeb.trx.getChainParameters();
      
      let energyFee = 420;
      let createAccountFee = 100000;
      let transactionFee = 1000;
      let bandwidthPrice = 1000;
      
      for (const param of chainParams) {
        switch (param.key) {
          case 'getEnergyFee':
            energyFee = param.value;
            break;
          case 'getCreateAccountFee':
            createAccountFee = param.value;
            break;
          case 'getTransactionFee':
            transactionFee = param.value;
            break;
          case 'getBandwidthPrice':
            bandwidthPrice = param.value;
            break;
        }
      }
      
      // Получаем энергию на аккаунте (используем любой валидный адрес для примера)
      let resources = {};
      try {
        resources = await this.tronWeb.trx.getAccountResources('TJDENsfBJs4RFETt1X1W8wMDc8M5XnJhCe');
      } catch (e) {
        // Если ошибка, используем пустой объект
        resources = {};
      }
      const energyLimit = resources.EnergyLimit || 0;
      const energyUsed = resources.EnergyUsed || 0;
      const energyAvailable = energyLimit - energyUsed;
      
      // Расчет энергии за 1 TRX
      const energyPerTRX = Math.floor(1_000_000 / energyFee);
      const trxPrice = 0.33; // Можно обновить через API
      
      const result = {
        realtime: {
          energyFeeSun: energyFee,
          energyCostTRX: (1_000_000 / energyPerTRX).toFixed(2),
          energyCostUSD: ((1_000_000 / energyPerTRX) * trxPrice).toFixed(2),
          energyPerTRX: energyPerTRX,
          trxPrice: trxPrice,
          timestamp: new Date().toISOString(),
          chainParameters: {
            getEnergyFee: energyFee,
            getCreateAccountFee: createAccountFee,
            getTransactionFee: transactionFee,
            getBandwidthPrice: bandwidthPrice
          },
          accountResources: {
            energyLimit: energyLimit,
            energyUsed: energyUsed,
            energyAvailable: energyAvailable
          }
        },
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
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get energy prices: ${error.message}`
      );
    }
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      // Keep the process alive
      process.stdin.resume();
      
      // Handle shutdown
      process.on('SIGINT', () => {
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to start MCP TRON Server:', error.message);
      process.exit(1);
    }
  }
}

const server = new TronMcpServer();
server.run().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});