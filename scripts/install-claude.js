#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get absolute paths
const projectRoot = resolve(__dirname, '..');
const serverPath = resolve(projectRoot, 'src/index.js');

// Check if .env exists
if (!existsSync(resolve(projectRoot, '.env'))) {
  console.error('❌ Error: .env file not found!');
  console.error('Please copy .env.example to .env and configure it:');
  console.error('  cp .env.example .env');
  process.exit(1);
}

// Read .env configuration
const envConfig = {};
try {
  const envContent = readFileSync(resolve(projectRoot, '.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        envConfig[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
} catch (error) {
  console.error('❌ Error reading .env file:', error.message);
  process.exit(1);
}

// Create MCP configuration
const config = {
  command: process.execPath,
  args: [serverPath],
  cwd: projectRoot,
  env: {
    NODE_ENV: 'production',
    PATH: process.env.PATH,
    // Default values
    NETWORK: 'mainnet',
    FULL_NODE_URL: 'https://api.trongrid.io',
    SOLIDITY_NODE_URL: 'https://api.trongrid.io',
    EVENT_SERVER_URL: 'https://api.trongrid.io',
    ENABLE_CACHE: 'true',
    CACHE_TTL: '300',
    // Override with .env values
    ...envConfig
  }
};

console.log('🚀 Installing TRON MCP Server to Claude CLI...\n');

// Remove old configuration if exists
console.log('📦 Removing old configurations...');
try {
  execSync('claude mcp remove tron -s local 2>/dev/null', { stdio: 'ignore' });
} catch (e) {
  // Ignore errors
}
try {
  execSync('claude mcp remove tron -s user 2>/dev/null', { stdio: 'ignore' });
} catch (e) {
  // Ignore errors
}

// Add new configuration with user scope
console.log('📝 Adding new configuration...');
try {
  const configJson = JSON.stringify(config);
  execSync(`claude mcp add-json -s user tron '${configJson}'`, { stdio: 'inherit' });
  
  console.log('\n✅ TRON MCP Server successfully installed to Claude CLI!');
  console.log('\n📋 Configuration:');
  console.log(`   Server: ${serverPath}`);
  console.log(`   Network: ${config.env.NETWORK}`);
  console.log(`   API configured: ${config.env.TRONGRID_API_KEY ? 'Yes' : 'No'}`);
  
  console.log('\n🎯 Next steps:');
  console.log('   1. Restart Claude CLI to apply changes');
  console.log('   2. Test with: "What is the current TRX price?"');
  
  // Verify installation
  console.log('\n🔍 Verifying installation...');
  try {
    const listOutput = execSync('claude mcp list', { encoding: 'utf-8' });
    if (listOutput.includes('tron')) {
      console.log('✅ TRON MCP Server is listed in Claude CLI');
    } else {
      console.log('⚠️  Could not verify installation. Please run: claude mcp list');
    }
  } catch (e) {
    console.log('⚠️  Could not verify installation. Please run: claude mcp list');
  }
  
} catch (error) {
  console.error('\n❌ Installation failed!');
  console.error('Error:', error.message);
  console.error('\nPlease try manual installation:');
  console.error('1. Create a config file with your settings');
  console.error('2. Run: claude mcp add-json -s user tron <config>');
  process.exit(1);
}