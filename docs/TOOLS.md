# TRON MCP Server Tools Documentation

This document provides detailed information about all available tools in the TRON MCP Server.

## Table of Contents
- [Balance & Account Tools](#balance--account-tools)
- [Transaction Tools](#transaction-tools)
- [Smart Contract Tools](#smart-contract-tools)
- [Network Information Tools](#network-information-tools)
- [Market Data Tools](#market-data-tools)
- [Documentation Tools](#documentation-tools)
- [Energy & Resource Tools](#energy--resource-tools)

## Balance & Account Tools

### `get_balance`
Retrieves the TRX balance for a given TRON address.

**Parameters:**
- `address` (string, required): TRON address to check

**Example:**
```json
{
  "address": "TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU"
}
```

**Response:**
```json
{
  "address": "TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU",
  "balance": 1000.5,
  "balanceInSun": 1000500000
}
```

### `get_account_resources`
Gets detailed resource information including bandwidth and energy.

**Parameters:**
- `address` (string, required): TRON address

**Example:**
```json
{
  "address": "TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU"
}
```

**Response:**
```json
{
  "bandwidth": {
    "free": 1500,
    "used": 0,
    "total": 1500
  },
  "energy": {
    "total": 50000,
    "used": 12000,
    "available": 38000
  },
  "frozen": {
    "bandwidth": 0,
    "energy": 500000
  }
}
```

## Transaction Tools

### `send_trx`
Sends TRX from one address to another.

**Parameters:**
- `to` (string, required): Recipient TRON address
- `amount` (number, required): Amount in TRX to send
- `privateKey` (string, optional): Sender's private key (uses env if not provided)

**Example:**
```json
{
  "to": "TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU",
  "amount": 100.5
}
```

**Response:**
```json
{
  "txHash": "7c2d4206c03c9f39dcb2e0e3c8f3d98e84c7f59c9f3d3b9f9e9d9c9f9e9d9c9f",
  "success": true,
  "blockNumber": 50123456
}
```

### `get_transaction`
Retrieves detailed information about a transaction.

**Parameters:**
- `txHash` (string, required): Transaction hash

**Example:**
```json
{
  "txHash": "7c2d4206c03c9f39dcb2e0e3c8f3d98e84c7f59c9f3d3b9f9e9d9c9f9e9d9c9f"
}
```

**Response:**
```json
{
  "hash": "7c2d4206c03c9f39dcb2e0e3c8f3d98e84c7f59c9f3d3b9f9e9d9c9f9e9d9c9f",
  "from": "TRX123...",
  "to": "TRX456...",
  "amount": 100.5,
  "status": "confirmed",
  "blockNumber": 50123456,
  "timestamp": 1704067200000,
  "fee": 1.1,
  "energyUsed": 0,
  "netUsed": 268
}
```

### `get_block`
Gets information about a specific block or the latest block.

**Parameters:**
- `blockNumber` (number, optional): Block number (omit for latest)

**Example:**
```json
{
  "blockNumber": 50123456
}
```

**Response:**
```json
{
  "blockNumber": 50123456,
  "timestamp": 1704067200000,
  "hash": "0000000002fc7c40...",
  "parentHash": "0000000002fc7c3f...",
  "txCount": 142,
  "witnessAddress": "TGj1Ej1qRwh7Sd9JpJH7JbCpV6xD5eqnp9",
  "size": 45623
}
```

## Smart Contract Tools

### `contract_call`
Calls a smart contract function (read or write).

**Parameters:**
- `contractAddress` (string, required): Smart contract address
- `functionName` (string, required): Function name to call
- `parameters` (array, optional): Function parameters
- `feeLimit` (number, optional): Maximum fee in SUN (default: 150000000)
- `callValue` (number, optional): TRX to send with call (default: 0)

**Example - Read Balance:**
```json
{
  "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "functionName": "balanceOf",
  "parameters": ["TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU"]
}
```

**Example - Transfer USDT:**
```json
{
  "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "functionName": "transfer",
  "parameters": ["TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU", 1000000],
  "feeLimit": 150000000
}
```

### `estimate_energy`
Estimates energy consumption for a contract call.

**Parameters:**
- `contractAddress` (string, required): Contract address
- `functionName` (string, required): Function to estimate
- `parameters` (array, optional): Function parameters

**Example:**
```json
{
  "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "functionName": "transfer",
  "parameters": ["TRkDLbWXJYnfbdMrVWpmcnKwqNEKKQYGjU", 1000000]
}
```

**Response:**
```json
{
  "energyRequired": 28163,
  "estimatedFee": {
    "trx": 11.2652,
    "sun": 11265200
  },
  "suggestion": "Ensure account has at least 30000 energy or 12 TRX for fees"
}
```

### `estimate_contract_energy`
Enhanced energy estimation with detailed breakdown.

**Parameters:**
- `contractAddress` (string, required): Contract address
- `functionName` (string, required): Function name
- `parameters` (array, optional): Parameters array

**Example:**
```json
{
  "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "functionName": "approve",
  "parameters": ["TXYZabcdef...", "1000000000"]
}
```

**Response:**
```json
{
  "energy": 28163,
  "energyCost": {
    "trx": 11.27,
    "usd": 1.35
  },
  "breakdown": {
    "base": 10000,
    "dynamic": 18163
  },
  "recommendations": {
    "feeLimit": 150000000,
    "safetyMargin": 1.2
  }
}
```

## Network Information Tools

### `get_chain_parameters`
Gets current blockchain parameters.

**Response:**
```json
{
  "maintenanceTimeInterval": 21600000,
  "accountUpgradeCost": 9999000000,
  "createAccountFee": 100000,
  "transactionFee": 1000,
  "assetIssueFee": 1024000000,
  "witnessPayPerBlock": 32000000,
  "energyFee": 420,
  "bandwidthFee": 1000,
  "maxCpuTimeOfOneTx": 50,
  "allowMultiSign": 1,
  "allowAdaptiveEnergy": 1,
  "updateTime": 1704067200000
}
```

### `get_energy_prices`
Gets current energy and bandwidth prices.

**Response:**
```json
{
  "energy": {
    "price": 420,
    "priceInTrx": 0.00042,
    "per1000Energy": 0.42
  },
  "bandwidth": {
    "price": 1000,
    "priceInTrx": 0.001,
    "perKb": 1
  },
  "updateTime": 1704067200000,
  "marketPrices": {
    "energyRental": {
      "1hour": 0.35,
      "1day": 0.30,
      "3days": 0.28
    }
  }
}
```

### `get_network_statistics`
Gets comprehensive network statistics.

**Response:**
```json
{
  "totalAccounts": 234567890,
  "totalTransactions": 9876543210,
  "totalTRX": 100650515277,
  "circulatingSupply": 71659657369,
  "tps": 87.5,
  "blockHeight": 58901234,
  "nodes": {
    "total": 2691,
    "sr": 27,
    "srCandidates": 127
  }
}
```

## Market Data Tools

### `get_trx_price`
Gets current TRX price in multiple currencies.

**Response:**
```json
{
  "usd": 0.1203,
  "eur": 0.1098,
  "btc": 0.00000283,
  "eth": 0.0000486,
  "change24h": 2.45,
  "source": "coingecko",
  "timestamp": 1704067200000
}
```

### `get_trx_market_data`
Gets comprehensive TRX market data.

**Response:**
```json
{
  "price": {
    "usd": 0.1203,
    "eur": 0.1098,
    "btc": 0.00000283
  },
  "marketCap": {
    "usd": 10672000000,
    "rank": 11
  },
  "volume24h": {
    "usd": 892000000,
    "change": 15.3
  },
  "supply": {
    "circulating": 88734586213,
    "total": 88734586213,
    "max": null
  },
  "allTimeHigh": {
    "usd": 0.231673,
    "date": "2018-01-05",
    "daysAgo": 2189
  },
  "allTimeLow": {
    "usd": 0.00180434,
    "date": "2017-11-12",
    "daysAgo": 2242
  }
}
```

## Documentation Tools

### `search_tron_docs`
Searches TRON documentation for relevant information.

**Parameters:**
- `query` (string, required): Search query
- `topic` (string, optional): Specific topic area

**Example:**
```json
{
  "query": "energy calculation",
  "topic": "smart-contracts"
}
```

**Response:**
```json
{
  "results": [
    {
      "title": "Energy Calculation Guide",
      "url": "https://developers.tron.network/docs/energy",
      "snippet": "Energy consumption depends on contract complexity...",
      "relevance": 0.95
    }
  ],
  "totalResults": 5
}
```

### `get_tron_reference`
Gets quick reference information about TRON concepts.

**Parameters:**
- `topic` (string, required): Topic to get reference for

**Available Topics:**
- `addresses` - Address formats and validation
- `units` - TRX, SUN, and energy units
- `fees` - Transaction fees and limits
- `limits` - Network limits and constraints
- `resources` - Bandwidth and energy system

**Example:**
```json
{
  "topic": "units"
}
```

**Response:**
```json
{
  "topic": "units",
  "content": {
    "trx": {
      "name": "TRX",
      "description": "Base currency unit",
      "decimals": 6
    },
    "sun": {
      "name": "SUN",
      "description": "Smallest unit",
      "conversion": "1 TRX = 1,000,000 SUN"
    },
    "energy": {
      "description": "Used for smart contract execution",
      "obtaining": "Freeze TRX or rent from providers"
    }
  }
}
```

### `get_java_tron_releases`
Gets information about java-tron client releases.

**Parameters:**
- `limit` (number, optional): Number of releases to return (default: 10)

**Example:**
```json
{
  "limit": 5
}
```

**Response:**
```json
{
  "releases": [
    {
      "version": "v4.7.2",
      "name": "Odyssey-v4.7.2",
      "date": "2024-01-15",
      "changes": ["Performance improvements", "Bug fixes"],
      "downloadUrl": "https://github.com/tronprotocol/java-tron/releases/tag/v4.7.2"
    }
  ]
}
```

## Energy & Resource Tools

### `get_energy_consumption`
Gets top energy consuming contracts.

**Parameters:**
- `limit` (number, optional): Number of results (default: 10)

**Example:**
```json
{
  "limit": 5
}
```

**Response:**
```json
{
  "contracts": [
    {
      "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      "name": "USDT",
      "energyConsumed24h": 1234567890,
      "percentOfNetwork": 12.5,
      "avgEnergyPerTx": 28000
    }
  ],
  "totalNetworkEnergy": 9876543210000
}
```

### `get_defi_tvl`
Gets Total Value Locked in DeFi protocols.

**Response:**
```json
{
  "totalTVL": {
    "usd": 8234567890,
    "trx": 68500000000
  },
  "protocols": [
    {
      "name": "JustLend",
      "tvl": 2345678901,
      "change24h": 2.3,
      "category": "Lending"
    }
  ],
  "byCategory": {
    "lending": 4567890123,
    "dex": 2345678901,
    "derivatives": 1321098765
  }
}
```

### `get_staking_info`
Gets TRX staking information.

**Response:**
```json
{
  "totalStaked": {
    "trx": 43567890123,
    "percentage": 49.1
  },
  "apr": {
    "current": 4.82,
    "average30d": 4.75
  },
  "voters": 1234567,
  "superRepresentatives": {
    "total": 27,
    "candidates": 127
  }
}
```

## Error Handling

All tools follow consistent error handling:

### Common Error Codes

- `INVALID_ADDRESS` - Invalid TRON address format
- `INSUFFICIENT_BALANCE` - Not enough TRX or tokens
- `INSUFFICIENT_ENERGY` - Not enough energy for operation
- `CONTRACT_ERROR` - Smart contract execution failed
- `NETWORK_ERROR` - Connection or API issues
- `RATE_LIMIT` - API rate limit exceeded

### Error Response Format
```json
{
  "error": {
    "code": "INSUFFICIENT_ENERGY",
    "message": "Required 28000 energy but account has only 5000",
    "details": {
      "required": 28000,
      "available": 5000,
      "suggestion": "Freeze 2000 TRX or rent energy"
    }
  }
}
```

## Best Practices

1. **Always Validate Addresses**
   - TRON addresses start with 'T'
   - Are exactly 34 characters long
   - Use base58 encoding

2. **Energy Management**
   - Always estimate before execution
   - Add 20% safety margin
   - Consider energy rental for large operations

3. **Error Handling**
   - Check for sufficient balance before transactions
   - Handle network timeouts gracefully
   - Implement retry logic for transient failures

4. **Rate Limiting**
   - Use API keys for higher limits
   - Implement caching where appropriate
   - Batch operations when possible

5. **Security**
   - Never log private keys
   - Validate all input parameters
   - Use testnet for development