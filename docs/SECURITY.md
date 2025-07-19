# Security Best Practices for TRON MCP Server

This document outlines security considerations and best practices when using the TRON MCP Server in production environments.

## Table of Contents
- [Private Key Management](#private-key-management)
- [API Key Security](#api-key-security)
- [Network Security](#network-security)
- [Smart Contract Safety](#smart-contract-safety)
- [Operational Security](#operational-security)
- [Audit Checklist](#audit-checklist)

## Private Key Management

### Never Commit Private Keys

**❌ NEVER DO THIS:**
```javascript
// WRONG - Never hardcode private keys
const privateKey = "8f2a5594038472b6d2f49c3f61e0e8d34f1d6c8b2a098765432198765432abcd";
```

**✅ DO THIS INSTEAD:**
```javascript
// Use environment variables
const privateKey = process.env.PRIVATE_KEY;

// Or use a key management service
const privateKey = await keyVault.getSecret('tron-private-key');
```

### Environment Variable Best Practices

1. **Use `.env` files for development only**:
   ```bash
   # .env (add to .gitignore)
   PRIVATE_KEY=your-testnet-key-only
   ```

2. **Use system environment variables in production**:
   ```bash
   # Set in your deployment system
   export PRIVATE_KEY=$(vault read -field=key secret/tron/mainnet)
   ```

3. **Validate key format**:
   ```javascript
   if (!process.env.PRIVATE_KEY || !isValidPrivateKey(process.env.PRIVATE_KEY)) {
     throw new Error('Invalid or missing private key configuration');
   }
   ```

### Hardware Wallet Integration

For maximum security, consider hardware wallet integration:

```javascript
// Example: Ledger integration pattern
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import TronApp from '@ledgerhq/hw-app-trx';

async function signWithLedger(transaction) {
  const transport = await TransportNodeHid.create();
  const tronApp = new TronApp(transport);
  return await tronApp.signTransaction(transaction);
}
```

### Key Rotation Strategy

1. **Regular Rotation**:
   - Rotate keys every 90 days
   - Keep audit log of key changes
   - Test new keys on testnet first

2. **Emergency Rotation**:
   - Have backup keys ready
   - Document rotation procedure
   - Test recovery process regularly

## API Key Security

### Secure Storage

1. **Environment Variables**:
   ```env
   # Use different keys for different environments
   API_TRONGRID_DEV=dev-key-here
   API_TRONGRID_PROD=prod-key-here
   ```

2. **Key Vault Integration**:
   ```javascript
   // AWS Secrets Manager example
   const AWS = require('aws-sdk');
   const secretsManager = new AWS.SecretsManager();
   
   async function getApiKey() {
     const secret = await secretsManager.getSecretValue({
       SecretId: 'tron-mcp/api-keys'
     }).promise();
     return JSON.parse(secret.SecretString);
   }
   ```

### Rate Limit Management

1. **Implement Key Rotation**:
   ```javascript
   class ApiKeyRotator {
     constructor(keys) {
       this.keys = keys.split(',');
       this.currentIndex = 0;
     }
     
     getNextKey() {
       const key = this.keys[this.currentIndex];
       this.currentIndex = (this.currentIndex + 1) % this.keys.length;
       return key;
     }
   }
   ```

2. **Monitor Usage**:
   ```javascript
   // Track API usage per key
   const usage = new Map();
   
   function trackUsage(key) {
     const count = usage.get(key) || 0;
     usage.set(key, count + 1);
     
     if (count > RATE_LIMIT_THRESHOLD) {
       console.warn(`API key approaching rate limit: ${key.slice(0, 8)}...`);
     }
   }
   ```

## Network Security

### Node Connection Security

1. **Use HTTPS for public nodes**:
   ```javascript
   // Always use HTTPS for public endpoints
   const SECURE_NODES = {
     mainnet: 'https://api.trongrid.io',
     shasta: 'https://api.shasta.trongrid.io'
   };
   ```

2. **Validate SSL certificates**:
   ```javascript
   // For custom nodes
   const https = require('https');
   const agent = new https.Agent({
     rejectUnauthorized: true,
     ca: fs.readFileSync('path/to/ca-cert.pem')
   });
   ```

### Private Node Configuration

1. **Firewall Rules**:
   ```bash
   # Allow only specific IPs
   iptables -A INPUT -p tcp --dport 8090 -s YOUR_SERVER_IP -j ACCEPT
   iptables -A INPUT -p tcp --dport 8090 -j DROP
   ```

2. **VPN/SSH Tunnel**:
   ```bash
   # SSH tunnel to private node
   ssh -L 8090:localhost:8090 user@your-node-server
   ```

### Request Validation

1. **Input Sanitization**:
   ```javascript
   function validateAddress(address) {
     if (!address || typeof address !== 'string') {
       throw new Error('Invalid address format');
     }
     
     if (!address.startsWith('T') || address.length !== 34) {
       throw new Error('Invalid TRON address');
     }
     
     // Additional base58 validation
     if (!isBase58(address)) {
       throw new Error('Invalid address encoding');
     }
     
     return address;
   }
   ```

2. **Parameter Limits**:
   ```javascript
   function validateAmount(amount) {
     if (typeof amount !== 'number' || amount <= 0) {
       throw new Error('Invalid amount');
     }
     
     if (amount > MAX_TRANSACTION_AMOUNT) {
       throw new Error('Amount exceeds maximum allowed');
     }
     
     return amount;
   }
   ```

## Smart Contract Safety

### Contract Verification

1. **Always Verify Contracts**:
   ```javascript
   const VERIFIED_CONTRACTS = {
     'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': 'USDT',
     'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8': 'USDC'
   };
   
   function isVerifiedContract(address) {
     return VERIFIED_CONTRACTS.hasOwnProperty(address);
   }
   ```

2. **Check Contract Source**:
   ```javascript
   async function verifyContractSource(address) {
     // Query TronScan for contract verification status
     const response = await fetch(
       `https://api.tronscan.org/api/contract?contract=${address}`
     );
     const data = await response.json();
     return data.verified === true;
   }
   ```

### Safe Function Calls

1. **Use Fee Limits**:
   ```javascript
   // Always set reasonable fee limits
   const DEFAULT_FEE_LIMITS = {
     'transfer': 100000000,      // 100 TRX
     'approve': 100000000,       // 100 TRX
     'complex_defi': 500000000   // 500 TRX
   };
   ```

2. **Simulate First**:
   ```javascript
   async function safeContractCall(contract, method, params, options = {}) {
     // First, estimate energy
     const energy = await estimateEnergy(contract, method, params);
     
     // Check if account has sufficient resources
     const resources = await getAccountResources(options.from);
     if (resources.energy < energy) {
       throw new Error('Insufficient energy');
     }
     
     // Set safe fee limit
     options.feeLimit = options.feeLimit || calculateSafeFeeLimit(energy);
     
     // Execute with timeout
     return await Promise.race([
       contract[method](...params).send(options),
       new Promise((_, reject) => 
         setTimeout(() => reject(new Error('Transaction timeout')), 30000)
       )
     ]);
   }
   ```

### Reentrancy Protection

When interacting with unknown contracts:

```javascript
class SafeContractInteraction {
  constructor() {
    this.locked = new Set();
  }
  
  async call(contractAddress, method, params) {
    const key = `${contractAddress}-${method}`;
    
    if (this.locked.has(key)) {
      throw new Error('Reentrancy detected');
    }
    
    this.locked.add(key);
    try {
      return await this.executeCall(contractAddress, method, params);
    } finally {
      this.locked.delete(key);
    }
  }
}
```

## Operational Security

### Logging Best Practices

1. **Never Log Sensitive Data**:
   ```javascript
   // Configure logger to filter sensitive data
   const logger = winston.createLogger({
     format: winston.format.combine(
       winston.format.printf(info => {
         // Remove sensitive data
         if (info.privateKey) info.privateKey = '[REDACTED]';
         if (info.apiKey) info.apiKey = '[REDACTED]';
         return JSON.stringify(info);
       })
     )
   });
   ```

2. **Audit Logging**:
   ```javascript
   function logTransaction(txData) {
     logger.info({
       action: 'transaction',
       from: txData.from,
       to: txData.to,
       amount: txData.amount,
       timestamp: new Date().toISOString(),
       // Don't log private keys or full tx data
     });
   }
   ```

### Error Handling

1. **Don't Expose Internal Details**:
   ```javascript
   // Bad - exposes internal structure
   catch (error) {
     return { error: error.stack };
   }
   
   // Good - generic error messages
   catch (error) {
     logger.error(error); // Log full error internally
     return { error: 'Transaction failed. Please try again.' };
   }
   ```

2. **Rate Limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
     message: 'Too many requests from this IP'
   });
   ```

### Monitoring & Alerts

1. **Set Up Alerts**:
   ```javascript
   // Alert on suspicious activity
   function monitorActivity(address, action) {
     if (isHighValueTransaction(action)) {
       sendAlert({
         level: 'warning',
         message: `High value transaction detected from ${address}`,
         details: action
       });
     }
   }
   ```

2. **Regular Audits**:
   ```javascript
   // Automated security checks
   async function runSecurityAudit() {
     const checks = [
       checkUnusualTransactionPatterns(),
       verifyApiKeyUsage(),
       validateContractWhitelist(),
       checkResourceConsumption()
     ];
     
     const results = await Promise.all(checks);
     return generateAuditReport(results);
   }
   ```

## Audit Checklist

### Pre-Deployment

- [ ] All private keys stored securely (not in code)
- [ ] API keys configured via environment variables
- [ ] SSL/TLS enabled for all connections
- [ ] Input validation implemented for all parameters
- [ ] Fee limits set for all transactions
- [ ] Error messages don't expose sensitive info
- [ ] Logging configured to exclude sensitive data
- [ ] Rate limiting implemented
- [ ] Contract whitelist maintained
- [ ] Testnet testing completed

### Post-Deployment

- [ ] Monitor transaction patterns
- [ ] Track API usage and limits
- [ ] Regular key rotation scheduled
- [ ] Backup procedures tested
- [ ] Incident response plan documented
- [ ] Security patches applied regularly
- [ ] Audit logs reviewed weekly
- [ ] Penetration testing scheduled
- [ ] Disaster recovery tested
- [ ] Team security training completed

### Emergency Procedures

1. **Key Compromise**:
   ```bash
   # 1. Immediately rotate keys
   ./scripts/emergency-key-rotation.sh
   
   # 2. Audit recent transactions
   ./scripts/audit-transactions.sh --since "1 hour ago"
   
   # 3. Notify stakeholders
   ./scripts/send-security-alert.sh
   ```

2. **Suspicious Activity**:
   ```javascript
   // Automatic suspension on detection
   async function handleSuspiciousActivity(indicator) {
     await suspendOperations();
     await notifySecurityTeam(indicator);
     await createIncidentReport(indicator);
   }
   ```

## Additional Resources

- [TRON Security Guide](https://developers.tron.network/docs/security)
- [OWASP Smart Contract Security](https://owasp.org/www-project-smart-contract-security/)
- [ConsenSys Best Practices](https://consensys.github.io/smart-contract-best-practices/)

## Contact

For security concerns or vulnerability reports:
- Open a security advisory on GitHub
- Email: security@[your-domain].com (PGP key available)

Remember: Security is not a one-time setup but an ongoing process. Stay updated with the latest security practices and regularly review your implementation.