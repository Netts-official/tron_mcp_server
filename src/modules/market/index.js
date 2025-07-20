/**
 * Market Module for TRON MCP Server
 * Handles TRX price and market data operations
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export class MarketModule {
  constructor(priceTracker) {
    if (!priceTracker) {
      throw new Error('MarketModule requires priceTracker instance');
    }
    this.priceTracker = priceTracker;
  }

  /**
   * Get current TRX price
   */
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

  /**
   * Get detailed TRX market data
   */
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
}