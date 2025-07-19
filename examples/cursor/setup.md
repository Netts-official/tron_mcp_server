# Cursor IDE Setup Guide

This guide explains how to integrate the TRON MCP Server with Cursor IDE for enhanced blockchain development.

## Prerequisites

- Cursor IDE installed
- Node.js 18+ installed
- TRON MCP Server cloned locally

## Setup Methods

### Method 1: Through Cursor Settings UI

1. **Open Cursor Settings**
   - Press `Cmd/Ctrl + ,`
   - Or go to: File → Preferences → Settings

2. **Search for MCP**
   - In the search bar, type "MCP" or "Model Context Protocol"

3. **Add TRON Server Configuration**
   - Click on "Edit in settings.json"
   - Add the TRON server configuration

### Method 2: Direct Configuration File

1. **Locate Cursor Settings File**

   **Windows:**
   ```
   %APPDATA%\Cursor\User\settings.json
   ```

   **macOS:**
   ```
   ~/Library/Application Support/Cursor/User/settings.json
   ```

   **Linux:**
   ```
   ~/.config/Cursor/User/settings.json
   ```

2. **Add MCP Configuration**

   ```json
   {
     // ... other settings ...
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

## Complete Configuration Examples

### Basic Configuration

```json
{
  "mcp.servers": {
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

### Advanced Configuration with API Keys

```json
{
  "mcp.servers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "API_TRONGRID": "${env:TRON_API_KEY}",
        "API_KEYS": "${env:TRONSCAN_KEYS}",
        "LOG_LEVEL": "info",
        "ENABLE_CACHE": "true"
      }
    }
  }
}
```

### Multiple Networks Configuration

```json
{
  "mcp.servers": {
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

## Workspace-Specific Configuration

For project-specific settings, create `.vscode/settings.json` in your project root:

```json
{
  "mcp.servers": {
    "tron": {
      "command": "node",
      "args": ["${workspaceFolder}/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "PRIVATE_KEY": "${env:PROJECT_TRON_KEY}"
      }
    }
  }
}
```

## Using with Cursor AI Features

### 1. Enable in Chat

When chatting with Cursor AI, the TRON tools will be automatically available:

```
You: Can you check the balance of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?

Cursor: I'll check the TRX balance for that address using the TRON MCP server.
[Uses get_balance tool automatically]
```

### 2. Code Generation with TRON Context

```
You: Create a function to estimate energy for USDT transfers

Cursor: I'll create a function that uses the TRON MCP server to estimate energy:
[Generates code using estimate_energy tool]
```

### 3. Inline Suggestions

Cursor will provide TRON-aware code completions:

```javascript
// Type: "tron." and get suggestions based on available tools
const balance = await tron.getBalance("address");
const energy = await tron.estimateEnergy(contract, method, params);
```

## Creating Helper Scripts

### TRON Development Assistant

Create `.cursor/tron-helper.js` in your project:

```javascript
// TRON Development Helper for Cursor
const TRON_TOOLS = {
  // Balance checking
  checkBalance: async (address) => {
    return await cursor.mcp.tron.get_balance({ address });
  },
  
  // Energy estimation
  estimateEnergy: async (contract, method, params) => {
    return await cursor.mcp.tron.estimate_energy({
      contractAddress: contract,
      functionName: method,
      parameters: params
    });
  },
  
  // Price checking
  getPrice: async () => {
    return await cursor.mcp.tron.get_trx_price();
  }
};

// Export for use in Cursor
module.exports = TRON_TOOLS;
```

### Project Configuration

Create `.cursor/config.json`:

```json
{
  "tron": {
    "defaultNetwork": "mainnet",
    "contracts": {
      "USDT": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "USDC": "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8"
    },
    "commonTasks": [
      "Check balance",
      "Estimate energy",
      "Send transaction",
      "Query contract"
    ]
  }
}
```

## Debugging and Troubleshooting

### Enable Debug Logging

Add to your Cursor settings:

```json
{
  "mcp.servers": {
    "tron": {
      "command": "node",
      "args": ["/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"
      }
    }
  },
  "mcp.debug": true
}
```

### View MCP Logs

1. Open Command Palette: `Cmd/Ctrl + Shift + P`
2. Type: "Developer: Toggle Developer Tools"
3. Go to Console tab to see MCP logs

### Test MCP Connection

Create a test file `test-tron-mcp.js`:

```javascript
// Test TRON MCP Connection
async function testTronMCP() {
  try {
    // Test 1: Get TRX price
    console.log("Testing TRX price...");
    const price = await cursor.mcp.tron.get_trx_price();
    console.log("TRX Price:", price);
    
    // Test 2: Get chain parameters
    console.log("\nTesting chain parameters...");
    const params = await cursor.mcp.tron.get_chain_parameters();
    console.log("Chain params:", params);
    
    // Test 3: Check a known address
    console.log("\nTesting balance check...");
    const balance = await cursor.mcp.tron.get_balance({
      address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
    });
    console.log("Balance:", balance);
    
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testTronMCP();
```

## Common Issues and Solutions

### Issue: "MCP server not found"

**Solution 1:** Check path is absolute
```json
{
  "mcp.servers": {
    "tron": {
      // ❌ Wrong: relative path
      "args": ["./tron_mcp_server/src/index.js"],
      
      // ✅ Correct: absolute path
      "args": ["/Users/username/projects/tron_mcp_server/src/index.js"]
    }
  }
}
```

**Solution 2:** Verify Node.js is in PATH
```bash
which node
# Should output: /usr/local/bin/node or similar
```

### Issue: "Module not found"

**Solution:** Install dependencies
```bash
cd /path/to/tron_mcp_server
npm install
```

### Issue: "Connection timeout"

**Solution:** Test server manually
```bash
# Test if server starts
node /path/to/tron_mcp_server/src/index.js

# Test with timeout
timeout 10 node /path/to/tron_mcp_server/src/index.js
```

## Best Practices

### 1. Use Environment Variables

Create `.env` in your project:
```env
TRON_NETWORK=mainnet
TRON_API_KEY=your-api-key
TRON_PRIVATE_KEY=your-test-key
```

Reference in Cursor settings:
```json
{
  "mcp.servers": {
    "tron": {
      "env": {
        "NETWORK": "${env:TRON_NETWORK}",
        "API_TRONGRID": "${env:TRON_API_KEY}"
      }
    }
  }
}
```

### 2. Create Snippets

Add TRON-specific snippets to `.vscode/tron.code-snippets`:

```json
{
  "Check TRON Balance": {
    "prefix": "tronbalance",
    "body": [
      "const balance = await tron.getBalance('${1:address}');",
      "console.log('Balance:', balance.balance, 'TRX');"
    ]
  },
  "Estimate Energy": {
    "prefix": "tronenergy",
    "body": [
      "const energy = await tron.estimateEnergy({",
      "  contractAddress: '${1:contract}',",
      "  functionName: '${2:method}',",
      "  parameters: [${3:params}]",
      "});"
    ]
  }
}
```

### 3. Configure Tasks

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Check TRON Network Status",
      "type": "shell",
      "command": "node",
      "args": [
        "-e",
        "require('child_process').exec('curl -s https://api.trongrid.io/wallet/getnowblock', (err, stdout) => console.log(JSON.parse(stdout)))"
      ]
    },
    {
      "label": "Test TRON MCP Server",
      "type": "shell",
      "command": "node",
      "args": [
        "${workspaceFolder}/test-tron-mcp.js"
      ]
    }
  ]
}
```

## Integration with Other Extensions

### 1. Blockchain Development Kit

Configure to work alongside:
```json
{
  "blockchain.tronNetwork": "mainnet",
  "blockchain.tronProvider": "mcp"
}
```

### 2. Solidity Extension

For smart contract development:
```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.6",
  "solidity.defaultCompiler": "remote",
  "mcp.servers.tron.contractVerification": true
}
```

## Conclusion

With TRON MCP Server integrated into Cursor, you have:
- Instant access to blockchain data
- Energy estimation for transactions
- Real-time price information
- Smart contract interaction tools

All within your development environment, making TRON development more efficient and integrated.