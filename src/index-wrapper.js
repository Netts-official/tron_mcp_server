#!/usr/bin/env node

/**
 * Wrapper for MCP TRON Server to handle initialization delays
 * Provides proper startup for Claude CLI
 */

const { spawn } = require('child_process');
const path = require('path');

// Skip initial update if running in Claude CLI
if (process.env.SKIP_INITIAL_UPDATE === undefined) {
  process.env.SKIP_INITIAL_UPDATE = 'true';
}

// Determine which server to run
const useEnhanced = process.env.USE_ENHANCED_SERVER === 'true';
const serverPath = useEnhanced 
  ? path.join(__dirname, 'index-enhanced.js')
  : path.join(__dirname, 'index.js');

console.error(`[WRAPPER] Starting ${useEnhanced ? 'enhanced' : 'regular'} TRON MCP Server...`);

// Spawn the actual server
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

// Handle signals
process.on('SIGINT', () => {
  console.error('[WRAPPER] Received SIGINT, shutting down...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.error('[WRAPPER] Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
});

server.on('error', (err) => {
  console.error('[WRAPPER] Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.error(`[WRAPPER] Server exited with code ${code}`);
  process.exit(code || 0);
});