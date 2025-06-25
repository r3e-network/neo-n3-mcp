# Neo N3 MCP Examples

This document provides practical examples of using the Neo N3 Model Context Protocol (MCP) server.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Blockchain Queries](#blockchain-queries)
- [Wallet Operations](#wallet-operations)
- [Asset Transfers](#asset-transfers)
- [Contract Interactions](#contract-interactions)
- [Famous Contracts](#famous-contracts)
- [Error Handling](#error-handling)

## Basic Setup

### Starting the MCP Server

```bash
# Install the package
npm install -g @r3e/neo-n3-mcp

# Start with default configuration (both networks)
neo-n3-mcp

# Start with specific network
neo-n3-mcp --network mainnet

# Start with custom configuration
neo-n3-mcp --config ./my-config.json
```

### Configuration Example

```json
{
  "network": "mainnet",
  "rpc": {
    "mainnet": "https://mainnet1.neo.coz.io:443",
    "testnet": "https://testnet1.neo.coz.io:443"
  },
  "logging": {
    "level": "info",
    "file": "./logs/neo-mcp.log",
    "console": true
  },
  "rateLimiting": {
    "enabled": true,
    "maxRequestsPerMinute": 60,
    "maxRequestsPerHour": 1000
  }
}
```

## Blockchain Queries

### Get Blockchain Information

```javascript
// Using MCP client
const response = await client.callTool('get_blockchain_info', {
  network: 'mainnet'
});

// Response includes:
// - Current block height
// - Network validators
// - Network status
```

### Get Block Details

```javascript
// Get block by height
const block = await client.callTool('get_block', {
  hashOrHeight: 1000000,
  network: 'mainnet'
});

// Get block by hash
const block = await client.callTool('get_block', {
  hashOrHeight: '0x1234567890abcdef...',
  network: 'mainnet'
});
```

### Get Transaction Details

```javascript
const transaction = await client.callTool('get_transaction', {
  txid: '0xabcdef1234567890...',
  network: 'mainnet'
});
```

## Wallet Operations

### Create New Wallet

```javascript
const wallet = await client.callTool('create_wallet', {
  password: 'secure-password-123',
  network: 'testnet'
});

// Response includes:
// - address: Neo N3 address
// - publicKey: Public key
// - encryptedPrivateKey: Encrypted private key
// - WIF: Wallet Import Format key
```

### Import Existing Wallet

```javascript
// Import from WIF
const wallet = await client.callTool('import_wallet', {
  key: 'KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR',
  password: 'new-password-123',
  network: 'testnet'
});

// Import from encrypted key
const wallet = await client.callTool('import_wallet', {
  key: 'encrypted-key-data',
  password: 'decryption-password',
  network: 'testnet'
});
```

### Check Balance

```javascript
const balance = await client.callTool('get_balance', {
  address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
  network: 'mainnet'
});

// Response includes balance for all assets (NEO, GAS, etc.)
```

## Asset Transfers

### Transfer NEO

```javascript
const transfer = await client.callTool('transfer_assets', {
  fromWIF: 'KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR',
  toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
  asset: 'NEO',
  amount: '10',
  confirm: true,
  network: 'testnet'
});
```

### Transfer GAS

```javascript
const transfer = await client.callTool('transfer_assets', {
  fromWIF: 'KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR',
  toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
  asset: 'GAS',
  amount: '50.5',
  confirm: true,
  network: 'testnet'
});
```

### Estimate Transfer Fees

```javascript
const fees = await client.callTool('estimate_transfer_fees', {
  fromAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
  toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
  asset: 'GAS',
  amount: '10.5',
  network: 'mainnet'
});
```

## Contract Interactions

### List Available Contracts

```javascript
const contracts = await client.callTool('list_famous_contracts', {
  network: 'mainnet'
});

// Returns list of supported contracts:
// - NeoFS, NeoBurger, Flamingo, NeoCompound, GrandShare, GhostMarket
```

### Get Contract Information

```javascript
const contractInfo = await client.callTool('get_contract_info', {
  contractName: 'NeoFS',
  network: 'mainnet'
});

// Response includes:
// - Contract description
// - Script hash
// - Available operations
// - Operation parameters
```

### Read-Only Contract Call

```javascript
const result = await client.callTool('invoke_read_contract', {
  contractName: 'NeoFS',
  operation: 'getContainers',
  args: ['owner-id-123'],
  network: 'mainnet'
});
```

### Write Contract Call

```javascript
const result = await client.callTool('invoke_write_contract', {
  fromWIF: 'KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR',
  contractName: 'NeoFS',
  operation: 'createContainer',
  args: ['owner-id-123', []],
  confirm: true,
  network: 'testnet'
});
```

## Famous Contracts

### NeoFS (Decentralized Storage)

```javascript
// Create storage container
const createContainer = await client.callTool('invoke_write_contract', {
  fromWIF: 'your-wif-key',
  contractName: 'NeoFS',
  operation: 'createContainer',
  args: ['owner-id', []],
  confirm: true,
  network: 'mainnet'
});

// Get containers for owner
const containers = await client.callTool('invoke_read_contract', {
  contractName: 'NeoFS',
  operation: 'getContainers',
  args: ['owner-id'],
  network: 'mainnet'
});
```

### NeoBurger (NEO Staking)

```javascript
// Deposit NEO to get bNEO
const deposit = await client.callTool('invoke_write_contract', {
  fromWIF: 'your-wif-key',
  contractName: 'NeoBurger',
  operation: 'exchange',
  args: ['your-address'],
  confirm: true,
  network: 'mainnet'
});

// Check bNEO balance
const balance = await client.callTool('invoke_read_contract', {
  contractName: 'NeoBurger',
  operation: 'balanceOf',
  args: ['your-address'],
  network: 'mainnet'
});

// Claim GAS rewards
const claimGas = await client.callTool('invoke_write_contract', {
  fromWIF: 'your-wif-key',
  contractName: 'NeoBurger',
  operation: 'claim_gas',
  args: ['your-address'],
  confirm: true,
  network: 'mainnet'
});
```

### Flamingo (DeFi Platform)

```javascript
// Check FLM balance
const balance = await client.callTool('invoke_read_contract', {
  contractName: 'Flamingo',
  operation: 'balanceOf',
  args: ['your-address'],
  network: 'mainnet'
});

// Stake FLM tokens
const stake = await client.callTool('invoke_write_contract', {
  fromWIF: 'your-wif-key',
  contractName: 'Flamingo',
  operation: 'stake',
  args: ['your-address', '1000'],
  confirm: true,
  network: 'mainnet'
});
```

### GhostMarket (NFT Marketplace)

```javascript
// Create NFT
const createNFT = await client.callTool('invoke_write_contract', {
  fromWIF: 'your-wif-key',
  contractName: 'GhostMarket',
  operation: 'mintToken',
  args: ['owner-address', 'https://metadata-uri.com/token/1', []],
  confirm: true,
  network: 'mainnet'
});

// Get token information
const tokenInfo = await client.callTool('invoke_read_contract', {
  contractName: 'GhostMarket',
  operation: 'getTokenInfo',
  args: ['1'],
  network: 'mainnet'
});
```

## Error Handling

### Common Error Patterns

```javascript
try {
  const result = await client.callTool('get_balance', {
    address: 'invalid-address',
    network: 'mainnet'
  });
} catch (error) {
  if (error.code === -32602) {
    console.log('Invalid parameters:', error.message);
  } else if (error.code === -32603) {
    console.log('Internal error:', error.message);
  } else {
    console.log('Unknown error:', error);
  }
}
```

### Validation Errors

```javascript
// Address validation
try {
  await client.callTool('get_balance', {
    address: 'too-short',
    network: 'mainnet'
  });
} catch (error) {
  // Error: Invalid Neo N3 address format
}

// Amount validation
try {
  await client.callTool('transfer_assets', {
    fromWIF: 'valid-wif',
    toAddress: 'valid-address',
    asset: 'GAS',
    amount: '-10', // Invalid negative amount
    confirm: true,
    network: 'testnet'
  });
} catch (error) {
  // Error: Amount must be greater than zero
}
```

### Network Errors

```javascript
try {
  await client.callTool('get_blockchain_info', {
    network: 'invalid-network'
  });
} catch (error) {
  // Error: Invalid network: invalid-network. Must be one of: mainnet, testnet
}
```

## Best Practices

### 1. Always Use Testnet for Development

```javascript
// Use testnet for all development and testing
const config = {
  network: 'testnet',
  // ... other config
};
```

### 2. Handle Confirmations Properly

```javascript
// For write operations, always wait for confirmation
const result = await client.callTool('transfer_assets', {
  // ... parameters
  confirm: true, // Wait for transaction confirmation
  network: 'testnet'
});

console.log('Transaction confirmed:', result.txid);
```

### 3. Validate Inputs

```javascript
// Always validate addresses before use
function isValidNeoAddress(address) {
  return /^[A-Za-z0-9]{34}$/.test(address);
}

if (!isValidNeoAddress(userAddress)) {
  throw new Error('Invalid Neo N3 address format');
}
```

### 4. Use Appropriate Networks

```javascript
// Use mainnet for production
const productionConfig = { network: 'mainnet' };

// Use testnet for development
const developmentConfig = { network: 'testnet' };
```

### 5. Monitor Rate Limits

```javascript
// Implement retry logic for rate limiting
async function callWithRetry(toolName, args, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.callTool(toolName, args);
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}