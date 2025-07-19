#!/usr/bin/env node
console.error('[TRON-MCP-DEBUG] Starting debug version...');
console.error('[TRON-MCP-DEBUG] Node version:', process.version);
console.error('[TRON-MCP-DEBUG] Current directory:', process.cwd());

// Проверяем импорты по одному
try {
  console.error('[TRON-MCP-DEBUG] Loading @modelcontextprotocol/sdk...');
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
  } = await import('@modelcontextprotocol/sdk/types.js');
  console.error('[TRON-MCP-DEBUG] MCP SDK loaded successfully');
} catch (error) {
  console.error('[TRON-MCP-DEBUG] Failed to load MCP SDK:', error.message);
  process.exit(1);
}

try {
  console.error('[TRON-MCP-DEBUG] Loading TronWeb...');
  const TronWeb = (await import('tronweb')).default;
  console.error('[TRON-MCP-DEBUG] TronWeb loaded successfully');
} catch (error) {
  console.error('[TRON-MCP-DEBUG] Failed to load TronWeb:', error.message);
  process.exit(1);
}

try {
  console.error('[TRON-MCP-DEBUG] Loading dotenv...');
  const dotenv = (await import('dotenv')).default;
  dotenv.config();
  console.error('[TRON-MCP-DEBUG] Environment loaded');
} catch (error) {
  console.error('[TRON-MCP-DEBUG] Failed to load dotenv:', error.message);
}

try {
  console.error('[TRON-MCP-DEBUG] Loading fetch...');
  const fetch = (await import('node-fetch')).default;
  console.error('[TRON-MCP-DEBUG] Fetch loaded successfully');
} catch (error) {
  console.error('[TRON-MCP-DEBUG] Failed to load fetch:', error.message);
}

// Проверяем локальные модули
const modules = [
  './documentation.js',
  './tronscan.js', 
  './price-tracker.js',
  './network-monitor.js',
  './energy-estimator.js',
  './usdt-energy-helper.js',
  './chain-parameters-monitor.js'
];

for (const module of modules) {
  try {
    console.error(`[TRON-MCP-DEBUG] Loading ${module}...`);
    await import(module);
    console.error(`[TRON-MCP-DEBUG] ${module} loaded successfully`);
  } catch (error) {
    console.error(`[TRON-MCP-DEBUG] Failed to load ${module}:`, error.message);
    console.error(`[TRON-MCP-DEBUG] Stack:`, error.stack);
  }
}

console.error('[TRON-MCP-DEBUG] All modules checked. Exiting...');