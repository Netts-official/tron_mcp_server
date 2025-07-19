# Claude CLI Setup Guide

This guide explains how to set up the TRON MCP Server with Claude CLI.

## Prerequisites

- Claude CLI installed
- Node.js 18+ installed
- TRON MCP Server cloned locally

## Basic Setup

### 1. Create MCP Configuration Directory

```bash
mkdir -p ~/.claude
```

### 2. Create MCP Configuration File

Create `~/.claude/claude_mcp_config.json`:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
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

Replace `/path/to/tron_mcp_server` with the actual path where you cloned the repository.

### 3. Run Claude with MCP Configuration

```bash
claude --mcp-config ~/.claude/claude_mcp_config.json
```

## Advanced Configuration

### Using Environment Variables

For better security, use environment variables for sensitive data:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "FULL_NODE_URL": "${TRON_FULL_NODE_URL}",
        "API_TRONGRID": "${TRON_API_KEY}",
        "PRIVATE_KEY": "${TRON_PRIVATE_KEY}"
      }
    }
  }
}
```

Then set environment variables before running Claude:

```bash
export TRON_FULL_NODE_URL="https://api.trongrid.io"
export TRON_API_KEY="your-api-key-here"
export TRON_PRIVATE_KEY="your-private-key-here"

claude --mcp-config ~/.claude/claude_mcp_config.json
```

### Custom Node Configuration

If you have your own TRON node:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "FULL_NODE_URL": "http://your-node:8090",
        "SOLIDITY_NODE_URL": "http://your-node:8091",
        "EVENT_SERVER_URL": "http://your-node:8090",
        "API_KEYS": "your-tronscan-keys-comma-separated"
      }
    }
  }
}
```

### Multiple Networks Setup

You can configure multiple instances for different networks:

```json
{
  "mcpServers": {
    "tron-mainnet": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet"
      }
    },
    "tron-testnet": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "shasta",
        "FULL_NODE_URL": "https://api.shasta.trongrid.io"
      }
    }
  }
}
```

## Creating Launch Scripts

### Basic Launch Script

Create `~/claude-tron.sh`:

```bash
#!/bin/bash
# Claude CLI launcher with TRON MCP

echo "🚀 Starting Claude with TRON MCP Server..."

# Check if config exists
if [ ! -f ~/.claude/claude_mcp_config.json ]; then
    echo "❌ MCP config not found. Please create ~/.claude/claude_mcp_config.json"
    exit 1
fi

# Launch Claude with MCP
claude --mcp-config ~/.claude/claude_mcp_config.json
```

Make it executable:
```bash
chmod +x ~/claude-tron.sh
```

### Advanced Launch Script with Auto-Setup

Create `~/claude-tron-auto.sh`:

```bash
#!/bin/bash
# Claude CLI launcher with auto-setup

TRON_MCP_PATH="/path/to/tron_mcp_server"
CONFIG_PATH="$HOME/.claude/claude_mcp_config.json"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Claude TRON MCP Launcher${NC}"
echo "================================"

# Check if TRON MCP Server exists
if [ ! -d "$TRON_MCP_PATH" ]; then
    echo -e "${YELLOW}📥 TRON MCP Server not found. Cloning...${NC}"
    git clone https://github.com/Netts-official/tron_mcp_server.git "$TRON_MCP_PATH"
    cd "$TRON_MCP_PATH" && npm install
fi

# Create config if not exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${YELLOW}📝 Creating MCP configuration...${NC}"
    mkdir -p ~/.claude
    cat > "$CONFIG_PATH" << EOF
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["$TRON_MCP_PATH/src/index.js"],
      "env": {
        "NETWORK": "mainnet"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✅ Configuration created${NC}"
fi

# Verify MCP server is working
echo -e "${YELLOW}🔍 Verifying TRON MCP Server...${NC}"
timeout 5 node "$TRON_MCP_PATH/src/index.js" > /dev/null 2>&1
if [ $? -eq 124 ]; then
    echo -e "${GREEN}✅ TRON MCP Server is ready${NC}"
else
    echo -e "${RED}❌ TRON MCP Server failed to start${NC}"
    exit 1
fi

# Launch Claude
echo -e "${GREEN}🎯 Starting Claude CLI...${NC}"
echo ""
claude --mcp-config "$CONFIG_PATH"
```

## Verification

### Check MCP Servers

After starting Claude, verify the TRON server is loaded:

```
You> /mcp
```

Should show:
```
Available MCP servers:
- tron
```

### List Available Tools

```
You> /mcp list-tools --server tron
```

Should show all TRON tools like:
- get_balance
- send_trx
- estimate_energy
- etc.

### Test Basic Functionality

```
You> What's the TRX balance of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?
```

## Troubleshooting

### Common Issues

1. **"Server 'tron' not found"**
   - Check the path in your config file
   - Ensure Node.js is installed: `node --version`
   - Verify the server starts: `node /path/to/tron_mcp_server/src/index.js`

2. **"Connection timeout"**
   - Check your internet connection
   - Verify TRON nodes are accessible
   - Try using default TronGrid URLs

3. **"Command not found: claude"**
   - Install Claude CLI: `npm install -g @anthropic-ai/claude-cli`
   - Add npm global bin to PATH

### Debug Mode

Enable debug logging by adding to env:

```json
{
  "env": {
    "LOG_LEVEL": "debug",
    "NODE_ENV": "development"
  }
}
```

### Check Server Logs

The TRON MCP server logs to stderr, which you can capture:

```bash
claude --mcp-config ~/.claude/claude_mcp_config.json 2> tron-mcp.log
```

## Best Practices

1. **Use Environment Variables for Secrets**
   - Never hardcode private keys in config
   - Use `.env` files for development only

2. **Separate Configs for Different Environments**
   - `claude_mcp_config_dev.json` for development
   - `claude_mcp_config_prod.json` for production

3. **Regular Updates**
   ```bash
   cd /path/to/tron_mcp_server
   git pull
   npm update
   ```

4. **Backup Your Configuration**
   ```bash
   cp ~/.claude/claude_mcp_config.json ~/.claude/claude_mcp_config.backup.json
   ```

## Integration with Other MCP Servers

You can use TRON MCP alongside other servers:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    }
  }
}
```

This allows Claude to interact with TRON blockchain, GitHub repositories, and databases simultaneously.