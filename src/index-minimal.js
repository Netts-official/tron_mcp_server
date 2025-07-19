#!/usr/bin/env node
console.error('[TRON-MCP-MINIMAL] Starting...');

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

console.error('[TRON-MCP-MINIMAL] Imports completed');

class MinimalTronServer {
  constructor() {
    console.error('[TRON-MCP-MINIMAL] Creating server instance...');
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
    console.error('[TRON-MCP-MINIMAL] Server instance created');
    this.setupHandlers();
    console.error('[TRON-MCP-MINIMAL] Handlers setup complete');
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'test_tool',
          description: 'A simple test tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Test message',
              },
            },
            required: ['message'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'test_tool') {
        return {
          content: [
            {
              type: 'text',
              text: `Test response: ${args.message}`,
            },
          ],
        };
      }
      
      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async run() {
    try {
      console.error('[TRON-MCP-MINIMAL] Creating transport...');
      const transport = new StdioServerTransport();
      console.error('[TRON-MCP-MINIMAL] Connecting to transport...');
      await this.server.connect(transport);
      console.error('[TRON-MCP-MINIMAL] Server connected and running on stdio');
      
      // Keep the process alive
      process.stdin.resume();
      
      // Handle shutdown
      process.on('SIGINT', () => {
        console.error('[TRON-MCP-MINIMAL] Shutting down...');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('[TRON-MCP-MINIMAL] Failed to start:', error.message);
      console.error('[TRON-MCP-MINIMAL] Stack:', error.stack);
      process.exit(1);
    }
  }
}

console.error('[TRON-MCP-MINIMAL] Creating server instance...');
const server = new MinimalTronServer();
console.error('[TRON-MCP-MINIMAL] Starting server...');
server.run().catch((error) => {
  console.error('[TRON-MCP-MINIMAL] Fatal error:', error.message);
  console.error('[TRON-MCP-MINIMAL] Stack:', error.stack);
  process.exit(1);
});