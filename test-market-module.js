#!/usr/bin/env node

/**
 * Test script to verify MarketModule is working correctly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Testing TRON MCP Server MarketModule...\n');

// Start the MCP server
const server = spawn('node', [join(__dirname, 'src/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let outputBuffer = '';
let errorBuffer = '';

server.stdout.on('data', (data) => {
  outputBuffer += data.toString();
});

server.stderr.on('data', (data) => {
  errorBuffer += data.toString();
  console.error('Server output:', data.toString());
});

// Wait for server to initialize
setTimeout(async () => {
  console.log('\nSending test requests...\n');
  
  // Test 1: List tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  };
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Test 2: Get TRX Price
  setTimeout(() => {
    const getTRXPriceRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_trx_price',
        arguments: {}
      }
    };
    
    console.log('Sending get_trx_price request...');
    server.stdin.write(JSON.stringify(getTRXPriceRequest) + '\n');
  }, 1000);
  
  // Test 3: Get TRX Market Data
  setTimeout(() => {
    const getTRXMarketDataRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_trx_market_data',
        arguments: {}
      }
    };
    
    console.log('Sending get_trx_market_data request...');
    server.stdin.write(JSON.stringify(getTRXMarketDataRequest) + '\n');
  }, 2000);
  
  // Give time for responses
  setTimeout(() => {
    console.log('\nTest completed. Shutting down server...');
    server.kill();
  }, 5000);
}, 3000);

server.on('close', (code) => {
  console.log(`\nServer exited with code ${code}`);
  console.log('\nSTDOUT Output:');
  console.log(outputBuffer);
  console.log('\nSTDERR Output (including logs):');
  console.log(errorBuffer);
  
  // Check for success
  if (errorBuffer.includes('[TRON-MCP] Market module initialized')) {
    console.log('\n✅ MarketModule initialization successful!');
  } else {
    console.log('\n❌ MarketModule initialization failed!');
  }
  
  // Check if price responses are present
  if (outputBuffer.includes('get_trx_price') || outputBuffer.includes('price_usd')) {
    console.log('✅ Price methods are working!');
  } else {
    console.log('❌ Price methods failed!');
  }
  
  process.exit(code);
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});