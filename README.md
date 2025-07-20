[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/netts-official-tron-mcp-server-badge.png)](https://mseep.ai/app/netts-official-tron-mcp-server)

# TRON MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with the TRON blockchain, enabling AI assistants like Claude to interact with TRON network features including balance checking, transaction management, smart contract interaction, and real-time blockchain data.

## 🚀 Features

### Core Blockchain Functions
- **Balance Management**: Check TRX and TRC20 token balances
- **Transaction Operations**: Send TRX and interact with smart contracts
- **Resource Management**: Monitor and manage energy and bandwidth
- **Smart Contract Interaction**: Call contract methods and estimate energy consumption
- **Block Explorer**: Query blocks, transactions, and contract information

### Advanced Features
- **Smart Fallback System**: Automatic fallback to TronGrid/TronScan APIs when local node unavailable
- **Energy Estimation**: Accurate energy consumption predictions for transactions
- **Price Tracking**: Real-time TRX price and energy cost calculations
- **Network Monitoring**: Chain parameters and network statistics
- **Documentation Search**: Access TRON developer documentation
- **Code Examples**: Ready-to-use code snippets for common operations

### 🔄 Smart Fallback System

The MCP server now features an intelligent fallback system that automatically switches between data sources:

1. **Primary**: Local TRON node (fastest, most reliable)
2. **Fallback 1**: TronGrid API (official TRON Foundation API)
3. **Fallback 2**: TronScan API (community explorer API)

**Benefits:**
- ✅ Works without local TRON node installation
- ✅ Automatic failover for maximum uptime  
- ✅ Smart source selection based on availability
- ✅ Performance optimization with availability caching

**Supported Functions with Fallback:**
- `get_balance` - TRX balance checking
- `get_account_resources` - Energy/bandwidth resources
- `get_transaction` - Transaction details
- `get_block` - Block information
- `get_current_block_number` - Latest block number
- `get_chain_parameters` - Network parameters
- `contract_call` - Smart contract interaction (read-only via TronGrid)
- `send_trx` - TRX transfers (via TronGrid broadcasting)

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- TRON wallet address (for balance queries)
- Private key (optional, only for sending transactions)
- TronGrid API key (optional, for higher rate limits)

## 🛠️ Installation

### Quick Installation (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/Netts-official/tron_mcp_server.git
cd tron_mcp_server
```

2. Run automated setup:
```bash
# For Linux/macOS
chmod +x setup.sh
./setup.sh

# For Windows (PowerShell)
.\setup.ps1

# Alternative: Use npm script
npm run install-claude
```

The setup script will:
- ✅ Check Node.js version (18+)
- ✅ Install npm dependencies  
- ✅ Create .env from .env.example
- ✅ Configure Claude CLI (if installed)
- ✅ Configure Claude Desktop (if installed)
- ✅ Test server functionality

### Manual Installation

If you prefer manual setup:

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Add to Claude CLI:
```bash
claude mcp add tron -s user -- node $(pwd)/src/index.js
```

4. Test the installation:
```bash
npm test-server
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Network Configuration
NETWORK=mainnet

# TRON Node URLs
FULL_NODE_URL=https://api.trongrid.io
SOLIDITY_NODE_URL=https://api.trongrid.io
EVENT_SERVER_URL=https://api.trongrid.io

# Optional: TronGrid API Key
TRONGRID_API_KEY=your-api-key-here

# Optional: Private Key (for sending transactions)
# WARNING: Keep this secure!
PRIVATE_KEY=your-private-key-here
```

### Using Custom Nodes

If you run your own TRON nodes:

```env
FULL_NODE_URL=http://your-full-node:8090
SOLIDITY_NODE_URL=http://your-solidity-node:8091
EVENT_SERVER_URL=http://your-full-node:8090
```

## 🚀 Quick Start

After installation, restart Claude to use TRON features:

### ✅ If you used automated installation
The setup script already configured everything. Just restart Claude and try:
```
"What is the current TRX price?"
"Check balance for address TXxx..."
"Estimate energy for USDT transfer"
```

### 🔧 Manual Configuration (if needed)

#### Claude Desktop
Edit your configuration file at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`  
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tron": {
      "command": "node",
      "args": ["/absolute/path/to/tron_mcp_server/src/index.js"],
      "env": {
        "NETWORK": "mainnet",
        "TRONGRID_API_KEY": "your-api-key"
      }
    }
  }
}
```

#### Claude CLI
```bash
claude mcp add tron -s user -- node /absolute/path/to/src/index.js
```

#### Cursor IDE
Add to your Cursor settings.json:
```json
{
  "mcp.servers": {
    "tron": {
      "command": "node",
      "args": ["/absolute/path/to/tron_mcp_server/src/index.js"]
    }
  }
}
```

## 📚 Available Tools

### Balance & Account Tools

#### `get_balance`
Get TRX balance for an address
```javascript
{
  "address": "TRX_ADDRESS_HERE"
}
```

#### `get_account_resources`
Get bandwidth and energy resources
```javascript
{
  "address": "TRX_ADDRESS_HERE"
}
```

### Smart Contract Tools

#### `estimate_contract_energy`
Estimate energy needed for contract execution
```javascript
{
  "contractAddress": "CONTRACT_ADDRESS",
  "functionName": "transfer",
  "parameters": ["TO_ADDRESS", 1000000]
}
```

#### `get_contract_info`
Get detailed contract information
```javascript
{
  "contractAddress": "CONTRACT_ADDRESS"
}
```

### Blockchain Data Tools

#### `get_transaction`
Get transaction details
```javascript
{
  "txId": "TRANSACTION_ID"
}
```

#### `get_block`
Get block information
```javascript
{
  "block": "12345678" // block number or hash
}
```

#### `get_current_block_number`
Get current block number only (compact output)
```javascript
{}
```

### API Integration Tools

#### `trongrid_api_call`
Direct call to TronGrid API endpoint
```javascript
{
  "endpoint": "/wallet/getnowblock",
  "method": "POST",
  "data": {}
}
```

#### `tronscan_api_call`
Direct call to TronScan API endpoint
```javascript
{
  "endpoint": "/api/block",
  "params": {"sort": "-number", "limit": 1}
}
```

#### `get_trongrid_block`
Get block information directly from TronGrid API
```javascript
{
  "blockNumber": 12345678,
  "onlyNumber": true
}
```

#### `get_trongrid_account`
Get account information directly from TronGrid API
```javascript
{
  "address": "TRX_ADDRESS_HERE"
}
```

### Market Data Tools

#### `get_energy_prices`
Get current energy prices and TRX/USD rate
```javascript
{}
```

## 💡 Usage Examples

### Example 1: Check TRX Balance
```
User: Check the TRX balance of TRX1234567890abcdefghijklmnop
Claude: I'll check the TRX balance for that address.

[Claude uses get_balance tool]

The address has a balance of 1,234.56 TRX (1,234,560,000 SUN).
```

### Example 2: Estimate USDT Transfer Energy
```
User: How much energy do I need to transfer USDT to a new address?
Claude: I'll estimate the energy needed for a USDT transfer.

[Claude uses estimate_contract_energy tool]

For transferring USDT to a new address (that hasn't held USDT before), 
you'll need approximately 130,285 energy. This accounts for the initial 
storage allocation on the TRON network.
```

### Example 3: Get Current Energy Prices
```
User: What's the current cost of energy on TRON?
Claude: Let me check the current energy prices.

[Claude uses get_energy_prices tool]

Current energy pricing:
- Energy Price: 420 SUN per unit
- In TRX: 0.00042 TRX per energy unit
- In USD: $0.000042 per energy unit (at TRX price of $0.10)
```

### Example 4: Get Current Block Number
```
User: What's the current block number on TRON?
Claude: I'll get the current block number for you.

[Claude uses get_current_block_number tool]

Current block number: 67,891,234
Timestamp: 2024-01-15T10:30:45.123Z
Source: trongrid_api
```

### Example 5: Direct TronGrid API Call
```
User: Use TronGrid API to get current block information
Claude: I'll make a direct call to the TronGrid API.

[Claude uses trongrid_api_call with endpoint "/wallet/getnowblock"]

Successfully retrieved current block data directly from TronGrid API:
- Block Number: 74,086,797
- Timestamp: 2024-01-15T10:30:45.123Z
- Transactions: 156
```

### Example 6: TronScan API Query
```
User: Get latest account activity from TronScan for address TXxx...
Claude: I'll query TronScan API for account information.

[Claude uses tronscan_api_call with endpoint "/api/account"]

Account activity retrieved from TronScan:
- Balance: 1,234.56 TRX
- Latest transactions: 25
- Contract interactions: 12
```

## 🔧 Advanced Configuration

### Multiple API Keys
For load balancing across multiple TronGrid API keys:
```env
TRONGRID_API_KEY=key1,key2,key3
```

### Caching
Enable caching for better performance:
```env
ENABLE_CACHE=true
CACHE_TTL=300 # Cache time-to-live in seconds
```

### Debug Mode
Enable detailed logging:
```env
DEBUG=true
```

## 📖 Creating a CLAUDE.md File

For projects using this MCP server, create a `CLAUDE.md` file in your project root to help Claude understand how to use TRON features:

```markdown
# TRON Integration Instructions

This project uses the TRON MCP server for blockchain interactions.

## Available TRON Operations

### Checking Balances
Use `get_balance` with any TRON address to check TRX balance.

### Energy Estimation
Use `estimate_contract_energy` before transactions to ensure sufficient energy.

### Smart Contract Interaction
Use `get_contract_info` to understand contract interfaces.

## Best Practices
1. Always estimate energy before sending transactions
2. Check account resources before complex operations
3. Use caching for frequently accessed data
```

## 🔄 Updating MCP Server

To update the TRON MCP server to the latest version:

1. **Exit Claude** (close the application or press Ctrl+C in terminal)

2. **Navigate to project directory:**
```bash
cd /path/to/your/mcp-tron-server-github
```

3. **Initialize Git if not already done:**
```bash
# Only run if git is not initialized
git init
git remote add origin https://github.com/Netts-official/tron_mcp_server.git
```

4. **Pull latest changes:**
```bash
git pull origin main
```

5. **Restart Claude:**
```bash
claude
# or restart Claude Desktop application
```

**Alternative quick update:**
```bash
cd /path/to/your/mcp-tron-server-github && git pull origin main && claude
```

The MCP server will automatically use the updated code when Claude restarts.

## 🛡️ Security Best Practices

1. **Never commit private keys** to version control
2. Use environment variables for sensitive data
3. Implement rate limiting in production
4. Use read-only operations when possible
5. Validate all addresses before operations
6. Monitor API usage and costs

## 🐛 Troubleshooting

### Server not starting
```bash
# Check Node.js version
node --version # Should be 18+

# Verify dependencies
npm install

# Check environment variables
node -e "console.log(require('dotenv').config())"
```

### Connection issues
```bash
# Test TRON node connectivity
curl https://api.trongrid.io/wallet/getnowblock

# Check API key validity
curl -H "TRON-PRO-API-KEY: your-key" https://api.trongrid.io/wallet/getnowblock
```

### Energy estimation errors
- Ensure contract address is valid
- Check if contract is verified on TronScan
- Verify function name and parameters match ABI

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- TRON Foundation for blockchain infrastructure
- Anthropic for the MCP protocol
- TronWeb for the JavaScript SDK
- Community contributors

## 📞 Support

- GitHub Issues: [Report bugs or request features](https://github.com/Netts-official/tron_mcp_server/issues)
- Documentation: [TRON Developer Hub](https://developers.tron.network/)
- Community: [TRON Discord](https://discord.gg/tron)