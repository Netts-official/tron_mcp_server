# Detailed Setup Guide for TRON MCP Server

This guide provides comprehensive instructions for setting up the TRON MCP Server with various AI tools and environments.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Basic Installation](#basic-installation)
- [Claude Desktop Setup](#claude-desktop-setup)
- [Claude CLI Setup](#claude-cli-setup)
- [Cursor IDE Setup](#cursor-ide-setup)
- [VS Code Setup](#vs-code-setup)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Memory**: At least 2GB RAM recommended
- **Network**: Stable internet connection

### Required Software
```bash
# Check Node.js version
node --version  # Should show v18.0.0 or higher

# Check npm version
npm --version   # Should show 8.0.0 or higher
```

### Installing Node.js
If Node.js is not installed:
- **Windows/macOS**: Download from [nodejs.org](https://nodejs.org/)
- **Linux**: 
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

## Basic Installation

### Step 1: Clone the Repository
```bash
# Using SSH (recommended)
git clone git@github.com:Netts-official/tron_mcp_server.git

# Using HTTPS
git clone https://github.com/Netts-official/tron_mcp_server.git

cd tron_mcp_server
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
# Create .env file from template
cp .env.example .env

# Edit .env file with your preferred editor
nano .env  # or vim, code, etc.
```

### Step 4: Basic Configuration
Edit `.env` file:
```env
# Choose network: mainnet, shasta (testnet), or nile (testnet)
NETWORK=mainnet

# Use default TronGrid (free tier)
FULL_NODE_URL=https://api.trongrid.io
SOLIDITY_NODE_URL=https://api.trongrid.io
EVENT_SERVER_URL=https://api.trongrid.io
```

### Step 5: Test Installation
```bash
npm test
```

## Claude Desktop Setup

### Windows

1. **Locate Config File**:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. **Create/Edit Configuration**:
   ```json
   {
     "mcpServers": {
       "tron": {
         "command": "node",
         "args": ["C:\\path\\to\\tron_mcp_server\\src\\index.js"],
         "env": {
           "NETWORK": "mainnet",
           "FULL_NODE_URL": "https://api.trongrid.io",
           "SOLIDITY_NODE_URL": "https://api.trongrid.io",
           "EVENT_SERVER_URL": "https://api.trongrid.io"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### macOS

1. **Locate Config File**:
   ```bash
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

2. **Create/Edit Configuration**:
   ```json
   {
     "mcpServers": {
       "tron": {
         "command": "node",
         "args": ["/Users/username/path/to/tron_mcp_server/src/index.js"],
         "env": {
           "NETWORK": "mainnet"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**:
   ```bash
   # Quit Claude Desktop completely
   osascript -e 'quit app "Claude"'
   # Reopen Claude Desktop
   ```

### Linux

1. **Locate Config File**:
   ```bash
   ~/.config/Claude/claude_desktop_config.json
   ```

2. **Follow same configuration as macOS**

## Claude CLI Setup

### Step 1: Install Claude CLI
```bash
# If not already installed
npm install -g @anthropic-ai/claude-cli
```

### Step 2: Create MCP Configuration
```bash
# Create config directory
mkdir -p ~/.claude

# Create MCP config file
cat > ~/.claude/claude_mcp_config.json << 'EOF'
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/absolute/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "FULL_NODE_URL": "https://api.trongrid.io",
        "SOLIDITY_NODE_URL": "https://api.trongrid.io",
        "EVENT_SERVER_URL": "https://api.trongrid.io",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF
```

### Step 3: Run Claude with MCP
```bash
claude --mcp-config ~/.claude/claude_mcp_config.json
```

### Step 4: Verify MCP is Loaded
```
You> /mcp
# Should show available MCP servers including 'tron'

You> /mcp list-tools --server tron
# Should list all TRON tools
```

### Optional: Create Alias
```bash
# Add to ~/.bashrc or ~/.zshrc
alias claude-tron='claude --mcp-config ~/.claude/claude_mcp_config.json'
```

## Cursor IDE Setup

### Method 1: Through Cursor Settings

1. **Open Cursor Settings**:
   - Press `Cmd/Ctrl + ,`
   - Search for "MCP" or "Model Context Protocol"

2. **Add TRON Server**:
   ```json
   {
     "name": "tron",
     "command": "node",
     "args": ["/path/to/tron_mcp_server/src/index.js"],
     "env": {
       "NETWORK": "mainnet"
     }
   }
   ```

### Method 2: Direct Configuration

1. **Locate Cursor Config**:
   - Windows: `%APPDATA%\Cursor\User\settings.json`
   - macOS: `~/Library/Application Support/Cursor/User/settings.json`
   - Linux: `~/.config/Cursor/User/settings.json`

2. **Add MCP Configuration**:
   ```json
   {
     "mcp.servers": {
       "tron": {
         "command": "node",
         "args": ["/absolute/path/to/tron_mcp_server/src/index.js"],
         "env": {
           "NETWORK": "mainnet"
         }
       }
     }
   }
   ```

## VS Code Setup

### Using Continue Extension

1. **Install Continue Extension**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Continue"
   - Install the extension

2. **Configure Continue**:
   ```json
   {
     "models": [
       {
         "provider": "anthropic",
         "model": "claude-3-sonnet",
         "apiKey": "your-api-key"
       }
     ],
     "mcpServers": {
       "tron": {
         "command": "node",
         "args": ["/path/to/tron_mcp_server/src/index.js"]
       }
     }
   }
   ```

## Advanced Configuration

### Using Custom TRON Nodes

1. **Edit `.env` file**:
   ```env
   # Custom node configuration
   FULL_NODE_URL=http://your-node:8090
   SOLIDITY_NODE_URL=http://your-node:8091
   EVENT_SERVER_URL=http://your-node:8090
   
   # Optional: Add authentication
   NODE_API_KEY=your-node-api-key
   ```

2. **Update MCP config** to include custom environment:
   ```json
   {
     "env": {
       "NETWORK": "mainnet",
       "FULL_NODE_URL": "http://your-node:8090",
       "SOLIDITY_NODE_URL": "http://your-node:8091",
       "EVENT_SERVER_URL": "http://your-node:8090"
     }
   }
   ```

### API Keys Configuration

1. **TronGrid API Key** (for better rate limits):
   - Register at [trongrid.io](https://www.trongrid.io/)
   - Add to `.env`:
     ```env
     API_TRONGRID=your-api-key-here
     ```

2. **TronScan API Keys** (for network statistics):
   - Get from [tronscan.org](https://tronscan.org/)
   - Add to `.env`:
     ```env
     API_KEYS=key1,key2,key3  # Multiple keys for rotation
     ```

### Private Key Management

**⚠️ Security Warning**: Never commit private keys to version control!

1. **For Development** (Testnet only):
   ```env
   # Only use testnet private keys
   PRIVATE_KEY=your-testnet-private-key
   ```

2. **For Production**:
   - Use environment variables
   - Use secure key management services
   - Consider hardware wallets integration

### Performance Optimization

1. **Enable Caching**:
   ```env
   ENABLE_CACHE=true
   CACHE_TTL=3600000  # 1 hour
   CACHE_DIR=./cache
   ```

2. **Configure Logging**:
   ```env
   LOG_LEVEL=info  # debug, info, warn, error
   LOG_FILE=./logs/tron-mcp.log
   ```

## Troubleshooting

### Common Issues

#### 1. "Server 'tron' not found"
- Ensure config file path is correct
- Check if Node.js is in PATH
- Verify JSON syntax in config file

#### 2. "Connection timeout"
- Check internet connection
- Verify TRON node URLs
- Try using default TronGrid URLs

#### 3. "Insufficient API rate limit"
- Add TronGrid API key
- Use API key rotation
- Implement request caching

#### 4. "Module not found"
- Run `npm install` in project directory
- Check Node.js version (must be 18+)
- Delete `node_modules` and reinstall

### Debug Mode

Enable debug logging:
```bash
# In .env file
LOG_LEVEL=debug

# Or in MCP config
"env": {
  "LOG_LEVEL": "debug"
}
```

### Testing Connection

1. **Basic Test**:
   ```bash
   npm test
   ```

2. **Manual Test**:
   ```bash
   node src/index.js
   # Should see: [TRON-MCP] Starting...
   ```

3. **With Claude**:
   ```
   You> What's the current TRX price?
   # Should return price data
   ```

### Getting Help

1. **Check Logs**:
   - Server logs: `./logs/tron-mcp.log`
   - Claude logs: Check Claude's debug console

2. **Community Support**:
   - GitHub Issues: [Report bugs](https://github.com/Netts-official/tron_mcp_server/issues)
   - Discord: Join TRON developer community

3. **Documentation**:
   - TRON Docs: https://developers.tron.network/
   - MCP Docs: https://modelcontextprotocol.com/

## Next Steps

1. **Explore Tools**: See [TOOLS.md](TOOLS.md) for all available commands
2. **Integration Examples**: Check `examples/` directory
3. **Security**: Review [SECURITY.md](SECURITY.md) for best practices
4. **Contribute**: See [CONTRIBUTING.md](../CONTRIBUTING.md) to help improve the project