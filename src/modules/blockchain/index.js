/**
 * Blockchain Module for TRON MCP Server
 * Handles blockchain-related operations like transactions, blocks, and block numbers
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

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
   * @param {Object} params
   * @param {number} params.blockNumber - Block number to fetch
   * @param {boolean} params.summary - Return summary only (default: true)
   * @param {boolean} params.includeTransactions - Include transactions in response (default: false)
   * @param {number} params.transactionLimit - Limit number of transactions (default: 10)
   * @param {boolean} params.saveToFile - Save full block to file (default: false)
   * @param {boolean} params.fullResponse - Return full response without limits (default: false)
   */
  async getBlock({ 
    blockNumber, 
    summary = true, 
    includeTransactions = false, 
    transactionLimit = 10,
    saveToFile = false,
    fullResponse = false 
  }) {
    try {
      let block;
      let source;
      
      // First try to get from local node
      try {
        block = blockNumber 
          ? await this.tronWeb.trx.getBlock(blockNumber)
          : await this.tronWeb.trx.getCurrentBlock();
        source = 'tronweb_node';
      } catch (nodeError) {
        console.error('Local node failed, trying TronGrid API:', nodeError.message);
        
        // Fallback to TronGrid API
        try {
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
          
          block = await response.json();
          source = 'trongrid_api';
        } catch (trongridError) {
          // Last fallback: try TronScan API
          block = blockNumber 
            ? await this.tronScanAPI.getBlock(blockNumber)
            : await this.tronScanAPI.getCurrentBlock();
          source = 'tronscan_api';
        }
      }
      
      // If full response requested, return as before
      if (fullResponse) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(block, null, 2),
            },
          ],
        };
      }
      
      // Process block for summary/limited response
      const processedBlock = await this.processBlockData(block, {
        summary,
        includeTransactions,
        transactionLimit,
        saveToFile,
        source
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(processedBlock, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get block: ${error.message}`
      );
    }
  }

  /**
   * Process block data according to options
   */
  async processBlockData(block, options) {
    const { summary, includeTransactions, transactionLimit, saveToFile, source } = options;
    
    // Calculate sizes
    const fullBlockJson = JSON.stringify(block);
    const fullSizeBytes = Buffer.byteLength(fullBlockJson);
    const estimatedTokens = Math.ceil(fullSizeBytes / 4); // Rough estimate: 1 token ≈ 4 bytes
    const transactionCount = block.transactions ? block.transactions.length : 0;
    
    // Create summary response
    let result = {
      block_header: block.block_header,
      blockID: block.blockID,
      block_number: block.block_header?.raw_data?.number,
      timestamp: block.block_header?.raw_data?.timestamp,
      witness_address: block.block_header?.raw_data?.witness_address,
      transaction_count: transactionCount,
      size_info: {
        full_size_bytes: fullSizeBytes,
        estimated_tokens: estimatedTokens,
        exceeds_limit: estimatedTokens > 25000
      },
      source
    };
    
    // Include limited transactions if requested
    if (includeTransactions && block.transactions && block.transactions.length > 0) {
      result.transactions = block.transactions.slice(0, transactionLimit);
      result.transactions_info = {
        included: Math.min(transactionLimit, transactionCount),
        total: transactionCount,
        limited: transactionCount > transactionLimit
      };
    }
    
    // Save to file if requested
    if (saveToFile) {
      const filePath = await this.saveBlockToFile(block, block.block_header?.raw_data?.number);
      result.full_data_file = filePath;
      result.file_info = {
        path: filePath,
        size_mb: (fullSizeBytes / 1024 / 1024).toFixed(2),
        note: 'Full block data saved to file'
      };
    }
    
    // Add helper information
    if (!summary) {
      result.help = {
        message: 'Block data was limited to prevent token overflow',
        options: {
          fullResponse: 'Set to true to get complete block data (may exceed token limit)',
          saveToFile: 'Set to true to save full block to file',
          includeTransactions: 'Set to true to include transactions',
          transactionLimit: `Increase to get more transactions (current: ${transactionLimit})`
        }
      };
    }
    
    return result;
  }

  /**
   * Save block data to file
   */
  async saveBlockToFile(block, blockNumber) {
    const tempDir = '/tmp/tron-blocks';
    
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `block_${blockNumber || 'latest'}_${timestamp}.json`;
    const filePath = path.join(tempDir, filename);
    
    await fs.writeFile(filePath, JSON.stringify(block, null, 2));
    
    return filePath;
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