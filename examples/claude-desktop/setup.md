# Claude Desktop Setup Guide

This guide explains how to configure the TRON MCP Server with Claude Desktop application.

## Prerequisites

- Claude Desktop installed
- Node.js 18+ installed
- TRON MCP Server cloned locally

## Configuration Steps

### 1. Locate Configuration File

The configuration file location depends on your operating system:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Usually: `C:\Users\[YourUsername]\AppData\Roaming\Claude\claude_desktop_config.json`

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Create or Edit Configuration

Create the configuration file if it doesn't exist, or add the TRON server to existing configuration:

```json
{
  "mcpServers": {
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

**Important:** Use absolute paths, not relative paths!

### 3. Platform-Specific Examples

#### Windows Configuration

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\Projects\\tron_mcp_server\\src\\index.js"],
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

Note: Use double backslashes (`\\`) in Windows paths.

#### macOS Configuration

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/Users/yourname/Projects/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet"
      }
    }
  }
}
```

#### Linux Configuration

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/home/yourname/projects/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

After saving the configuration:

**Windows:**
1. Right-click Claude Desktop in system tray
2. Select "Quit Claude"
3. Start Claude Desktop again

**macOS:**
1. Click Claude in menu bar
2. Select "Quit Claude"
3. Reopen Claude Desktop

Or use Terminal:
```bash
osascript -e 'quit app "Claude"'
open -a "Claude"
```

**Linux:**
```bash
pkill -f claude-desktop
claude-desktop &
```

## Advanced Configuration

### API Keys and Private Nodes

For production use with API keys:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "FULL_NODE_URL": "https://api.trongrid.io",
        "API_TRONGRID": "your-trongrid-api-key",
        "API_KEYS": "tronscan-key1,tronscan-key2",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Multiple Networks

Configure both mainnet and testnet:

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
    "tron-shasta": {
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

### Using Environment Variables

For sensitive data, reference system environment variables:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "API_TRONGRID": "${TRON_API_KEY}",
        "PRIVATE_KEY": "${TRON_PRIVATE_KEY}"
      }
    }
  }
}
```

Then set environment variables in your system before starting Claude Desktop.

## Verification

### 1. Check MCP Status

In Claude Desktop, ask:
```
What MCP servers are available?
```

Or try using a TRON-specific command:
```
What's the current TRX price?
```

### 2. Test Basic Functions

```
Can you check the TRX balance of address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?
```

### 3. View Logs

Enable debug logging to troubleshoot:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### "MCP server failed to start"

1. **Check Node.js Installation:**
   ```bash
   node --version
   ```
   Should show v18.0.0 or higher

2. **Verify Path:**
   - Ensure the path to `index.js` is correct
   - Use absolute paths only
   - Check file exists:
     ```bash
     ls -la /path/to/tron_mcp_server/src/index.js
     ```

3. **Test Server Manually:**
   ```bash
   cd /path/to/tron_mcp_server
   node src/index.js
   ```
   Should see: `[TRON-MCP] Starting...`

#### "Cannot find module"

1. **Install Dependencies:**
   ```bash
   cd /path/to/tron_mcp_server
   npm install
   ```

2. **Check Node Modules:**
   ```bash
   ls node_modules/@modelcontextprotocol/sdk
   ```

#### Configuration Not Loading

1. **Verify JSON Syntax:**
   Use a JSON validator to check your config file

2. **Check File Permissions:**
   ```bash
   # macOS/Linux
   chmod 644 ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows (run as administrator)
   icacls "%APPDATA%\Claude\claude_desktop_config.json" /grant %USERNAME%:F
   ```

3. **Clear Cache and Restart:**
   - Quit Claude Desktop completely
   - Delete any cache files
   - Restart

### Debug Mode

Create a debug wrapper script:

**Windows** (`tron-mcp-debug.bat`):
```batch
@echo off
echo Starting TRON MCP Server in debug mode...
set LOG_LEVEL=debug
node "C:\path\to\tron_mcp_server\src\index.js" 2> tron-mcp-debug.log
```

**macOS/Linux** (`tron-mcp-debug.sh`):
```bash
#!/bin/bash
echo "Starting TRON MCP Server in debug mode..." >&2
LOG_LEVEL=debug node /path/to/tron_mcp_server/src/index.js 2>&1 | tee tron-mcp-debug.log
```

Then use this script in your config:
```json
{
  "mcpServers": {
    "tron": {
      "command": "/path/to/tron-mcp-debug.sh"
    }
  }
}
```

## Integration with Multiple MCP Servers

Claude Desktop can run multiple MCP servers simultaneously:

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

## Best Practices

### 1. Security

- Never store private keys in the config file
- Use environment variables for sensitive data
- Keep your config file permissions restrictive

### 2. Performance

- Use local TRON nodes for better performance
- Enable caching in production:
  ```json
  {
    "env": {
      "ENABLE_CACHE": "true",
      "CACHE_TTL": "3600000"
    }
  }
  ```

### 3. Maintenance

- Regularly update the TRON MCP Server:
  ```bash
  cd /path/to/tron_mcp_server
  git pull
  npm update
  ```

- Backup your configuration:
  ```bash
  # macOS
  cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/.claude-backup.json
  
  # Windows
  copy "%APPDATA%\Claude\claude_desktop_config.json" "%USERPROFILE%\claude-backup.json"
  ```

### 4. Development vs Production

Create separate configs:

**Development:**
```json
{
  "mcpServers": {
    "tron-dev": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "shasta",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

**Production:**
```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "LOG_LEVEL": "error",
        "ENABLE_CACHE": "true"
      }
    }
  }
}
```

## Creating Custom Commands

You can create a wrapper script for easier management:

```javascript
// tron-mcp-launcher.js
const { spawn } = require('child_process');
const path = require('path');

// Load environment from .env file
require('dotenv').config();

const server = spawn('node', [
  path.join(__dirname, 'src', 'index.js')
], {
  env: {
    ...process.env,
    NETWORK: process.env.TRON_NETWORK || 'mainnet'
  },
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start TRON MCP Server:', err);
  process.exit(1);
});
```

Then use in config:
```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/tron-mcp-launcher.js"]
    }
  }
}
```

This allows you to manage configuration separately from the Claude Desktop config file.