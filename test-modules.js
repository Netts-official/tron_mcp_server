#!/usr/bin/env node

/**
 * Test script to verify TRON MCP Server modules are working correctly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Testing TRON MCP Server modules...\n');

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
  
  // Test 2: Estimate energy for USDT transfer
  setTimeout(() => {
    const estimateEnergyRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'estimate_energy',
        arguments: {
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          functionName: 'transfer',
          parameters: ['TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6', 1000000]
        }
      }
    };
    
    console.log('Sending estimate_energy request...');
    server.stdin.write(JSON.stringify(estimateEnergyRequest) + '\n');
  }, 1000);
  
  // Test 3: Estimate contract energy
  setTimeout(() => {
    const estimateContractEnergyRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'estimate_contract_energy',
        arguments: {
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          functionName: 'transfer',
          parameters: ['TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6', 1000000]
        }
      }
    };
    
    console.log('Sending estimate_contract_energy request...');
    server.stdin.write(JSON.stringify(estimateContractEnergyRequest) + '\n');
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
  if (errorBuffer.includes('Module handlers initialized successfully') && 
      errorBuffer.includes('Available handlers:')) {
    console.log('\n✅ Module initialization successful!');
  } else {
    console.log('\n❌ Module initialization failed!');
  }
  
  process.exit(code);
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});