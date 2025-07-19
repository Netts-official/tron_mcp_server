# CLAUDE.md Template for TRON MCP Server Integration

This document explains how to create an effective CLAUDE.md file for projects that use the TRON MCP Server. The CLAUDE.md file helps AI assistants understand your project context and use the TRON blockchain features effectively.

## What is CLAUDE.md?

CLAUDE.md is a special markdown file that Claude reads when working with your codebase. It provides project-specific context, guidelines, and instructions that help Claude understand your project's requirements and conventions.

## Basic Template

Here's a template you can customize for your project:

```markdown
# Project Name

## Overview
Brief description of your project and its relationship to TRON blockchain.

## TRON Integration

### MCP Server Configuration
This project uses the TRON MCP server for blockchain operations. When working with TRON:
- Always use the `tron` MCP server for blockchain queries
- Never make assumptions about gas costs - use `estimate_energy` first
- Check balances before attempting transactions

### Network Configuration
- Network: mainnet/shasta/nile
- Primary operations: [list main blockchain operations your project uses]

### Smart Contracts
List important contracts your project interacts with:
- USDT: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (6 decimals)
- Custom Contract: TXxxxxx... - Description

### Common Operations

#### Checking Balances
When asked about balances, use:
```
get_balance with address parameter
```

#### Estimating Energy
Before any contract interaction:
```
estimate_energy with contract address and function details
```

#### Sending Transactions
For TRX transfers:
```
send_trx with recipient and amount
```

## Project-Specific Guidelines

### Error Handling
- Always check if address is valid TRON format (starts with T)
- Handle insufficient balance errors gracefully
- Monitor energy consumption for contract calls

### Security Considerations
- Private keys are managed via environment variables
- Never log or display private keys
- Always validate user input addresses

### Testing
- Use Shasta testnet for development
- Test addresses: [list test addresses if any]

## Code Style
[Your project's coding standards]

## Common Tasks

### Task 1: Check User Balance
1. Get address from user
2. Validate address format
3. Use `get_balance` tool
4. Display in user-friendly format

### Task 2: Send USDT
1. Check USDT balance first
2. Estimate energy required
3. Ensure sufficient TRX for fees
4. Execute transfer
5. Return transaction hash

## Troubleshooting

### Common Issues
1. "Insufficient Energy" - User needs to freeze TRX or rent energy
2. "Invalid Address" - Check if address starts with 'T' and is 34 characters
3. "Transaction Failed" - Check fee limit and contract parameters

## Resources
- TRON Documentation: https://developers.tron.network/
- TronScan Explorer: https://tronscan.org/
- Project Repository: [your repo URL]
```

## Best Practices for CLAUDE.md

### 1. Be Specific About TRON Operations
```markdown
### Energy Calculation
- USDT transfers typically require 28,000-65,000 energy
- Complex DeFi operations may need 100,000+ energy
- Always use `estimate_energy` before transactions
```

### 2. Include Common Patterns
```markdown
### Pattern: Safe Token Transfer
1. Check token balance: `contract_call` with `balanceOf`
2. Estimate energy: `estimate_energy`
3. Check TRX balance for fees
4. Execute transfer with appropriate fee limit
```

### 3. Document Error Scenarios
```markdown
### Error Handling
- INSUFFICIENT_ENERGY: Suggest energy rental at netts.io
- INVALID_CONTRACT: Verify contract exists on tronscan.org
- REVERT: Check contract requirements and parameters
```

### 4. Provide Context for Decisions
```markdown
### Why We Use TRON
- Fast 3-second block time
- Low transaction costs
- High throughput for our use case
- Strong DeFi ecosystem
```

### 5. Include Testing Guidelines
```markdown
### Testing on Shasta
- Faucet: https://shasta.tronex.io/
- Block Explorer: https://shasta.tronscan.org/
- Test USDT: [contract address if deployed]
```

## Advanced Usage

### Dynamic Context
For projects that interact with multiple contracts:

```markdown
### Contract Registry
Dynamically loaded contracts - use `get_contract_info` to fetch:
- DEX Router: Check via `contracts.dex_router`
- Lending Pool: Check via `contracts.lending_pool`
```

### Integration with Other Tools
```markdown
### MCP Servers Used
1. `tron` - Blockchain operations
2. `database` - Store transaction history
3. `notification` - Alert on transaction status
```

### Performance Optimization
```markdown
### Optimization Guidelines
- Batch balance checks when possible
- Cache energy estimates for similar transactions
- Use event filters for monitoring specific contracts
```

## Example: DeFi Project CLAUDE.md

```markdown
# DeFi Yield Aggregator

## TRON Integration
This project optimizes yield farming on TRON.

### Key Contracts
- YieldVault: TXxxx... - Main vault for deposits
- Strategy: TYyyy... - Current farming strategy
- Router: TZzzz... - DEX for swaps

### Common Operations

#### User Deposit Flow
1. Check user's USDT balance
2. Check approval for vault contract
3. If not approved, estimate energy for approval
4. Estimate energy for deposit
5. Execute deposit with 500,000 energy limit

#### Yield Calculation
- Use `contract_call` to get:
  - totalAssets()
  - totalShares()
  - getUserShares(address)
- Calculate: userAssets = totalAssets * userShares / totalShares

### Energy Requirements
- Approval: ~30,000 energy
- Deposit: ~150,000 energy
- Withdraw: ~200,000 energy
- Compound: ~300,000 energy

### Risk Checks
Before any operation:
1. Verify contract not paused
2. Check TVL limits
3. Validate slippage tolerance
4. Ensure emergency withdrawal works
```

## Tips for Effective CLAUDE.md

1. **Update Regularly**: Keep contract addresses and energy estimates current
2. **Be Concise**: Focus on what's unique to your TRON integration
3. **Include Examples**: Show actual tool usage patterns
4. **Document Edge Cases**: Explain handling of TRON-specific scenarios
5. **Link Resources**: Provide quick access to explorers and documentation

## Validation Checklist

- [ ] Includes network configuration (mainnet/testnet)
- [ ] Lists all integrated smart contracts
- [ ] Documents energy requirements for main operations
- [ ] Explains error handling strategies
- [ ] Provides testing guidelines
- [ ] Includes security considerations
- [ ] Shows example tool usage
- [ ] Links to relevant resources

By following this guide, your CLAUDE.md will help AI assistants work effectively with your TRON blockchain integration.