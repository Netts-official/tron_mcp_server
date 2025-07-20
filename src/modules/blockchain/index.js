/**
 * Blockchain Module for TRON MCP Server
 * Handles blockchain-related operations like transactions, blocks, and block numbers
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

export class BlockchainModule {
  constructor(tronWeb, trongridApiCall, tronscanApiCall, tronScanAPI) {
    if (!tronWeb) {
      throw new Error('BlockchainModule requires tronWeb instance');
    }
    this.tronWeb = tronWeb;
    this.trongridApiCall = trongridApiCall;
    this.tronscanApiCall = tronscanApiCall;
    this.tronScanAPI = tronScanAPI;
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction({ txHash }) {
    try {
      // Try TronWeb (local node) first
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
                source: 'tronweb_node'
              }, null, 2),
            },
          ],
        };
      } catch (nodeError) {
        console.error('TronWeb failed, trying TronGrid API:', nodeError.message);
        
        // Fallback to TronGrid API
        try {
          const transactionResult = await this.trongridApiCall({ 
            endpoint: '/wallet/gettransactionbyid', 
            method: 'POST', 
            data: { value: txHash }
          });
          
          const infoResult = await this.trongridApiCall({ 
            endpoint: '/wallet/gettransactioninfobyid', 
            method: 'POST', 
            data: { value: txHash }
          });
          
          const transaction = JSON.parse(transactionResult.content[0].text).result;
          const info = JSON.parse(infoResult.content[0].text).result;
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  transaction,
                  info,
                  source: 'trongrid_api'
                }, null, 2),
              },
            ],
          };
        } catch (trongridError) {
          console.error('TronGrid failed, trying TronScan API:', trongridError.message);
          
          // Fallback to TronScan
          try {
            const result = await this.tronscanApiCall({ 
              endpoint: '/api/transaction-info', 
              params: { hash: txHash }
            });
            
            const txData = JSON.parse(result.content[0].text).result;
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    transaction: txData,
                    info: txData, // TronScan combines both
                    source: 'tronscan_api'
                  }, null, 2),
                },
              ],
            };
          } catch (tronscanError) {
            throw new Error(`All sources failed: ${nodeError.message}, ${trongridError.message}, ${tronscanError.message}`);
          }
        }
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get transaction: ${error.message}`
      );
    }
  }

  /**
   * Get block by number or get current block
   */
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

  /**
   * Get current block number
   */
  async getCurrentBlockNumber() {
    try {
      // Try TronWeb first
      try {
        const block = await this.tronWeb.trx.getCurrentBlock();
        const blockNumber = block.block_header.raw_data.number;
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_block_number: blockNumber,
                timestamp: new Date().toISOString(),
                source: 'tronweb'
              }, null, 2),
            },
          ],
        };
      } catch (nodeError) {
        console.error('TronWeb failed, trying TronGrid API:', nodeError.message);
        
        // Fallback to TronGrid API
        const tronGridUrl = process.env.FULL_NODE_URL || 'https://api.trongrid.io';
        const headers = {
          'Content-Type': 'application/json',
        };
        
        // Add API key if available
        if (process.env.TRONGRID_API_KEY) {
          headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
        }
        
        const response = await fetch(`${tronGridUrl}/wallet/getnowblock`, {
          method: 'POST',
          headers,
          body: JSON.stringify({})
        });
        
        if (!response.ok) {
          throw new Error(`TronGrid API error: ${response.status} ${response.statusText}`);
        }
        
        const block = await response.json();
        const blockNumber = block.block_header?.raw_data?.number;
        
        if (!blockNumber) {
          throw new Error('Unable to extract block number from response');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_block_number: blockNumber,
                timestamp: new Date().toISOString(),
                source: 'trongrid_api'
              }, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      // Last fallback: try TronScan API
      try {
        const block = await this.tronScanAPI.getCurrentBlock();
        const blockNumber = block.number || block.block_header?.raw_data?.number;
        
        if (!blockNumber) {
          throw new Error('Unable to extract block number from TronScan response');
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                current_block_number: blockNumber,
                timestamp: new Date().toISOString(),
                source: 'tronscan_api'
              }, null, 2),
            },
          ],
        };
      } catch (scanError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get current block number from all sources: ${error.message}`
        );
      }
    }
  }
}
