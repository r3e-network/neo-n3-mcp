# Neo N3 MCP Server API Reference

This document provides a comprehensive reference for the Neo N3 MCP server API, including tools, resources, and configuration options.

## Network Support

The Neo N3 MCP server now supports both mainnet and testnet networks. You can specify which network to use for each request by including the `network` parameter.

- `network`: The Neo N3 network to use
  - `mainnet`: The Neo N3 mainnet (default)
  - `testnet`: The Neo N3 testnet

If no network is specified, the server will default to using the mainnet.

## MCP Tools

The Neo N3 MCP server exposes the following tools through the MCP protocol:

### get_blockchain_info

Get general information about the Neo N3 blockchain.

**Parameters:**
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "height": 12345,
  "validators": [
    {
      "publickey": "key1",
      "votes": "100",
      "active": true
    },
    {
      "publickey": "key2",
      "votes": "200",
      "active": true
    }
  ],
  "network": "mainnet"
}
```

**Example:**
```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

### get_block

Get block details by height or hash.

**Parameters:**
- `hashOrHeight` (string | number): Block hash or height
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "hash": "0x1234567890abcdef",
  "size": 1000,
  "version": 0,
  "previousblockhash": "0x0987654321fedcba",
  "merkleroot": "0xabcdef1234567890",
  "time": 1600000000,
  "index": 12344,
  "nonce": "0",
  "nextconsensus": "address",
  "script": {
    "invocation": "",
    "verification": ""
  },
  "tx": []
}
```

**Example:**
```json
{
  "name": "get_block",
  "arguments": {
    "hashOrHeight": 12345,
    "network": "mainnet"
  }
}
```

### get_transaction

Get transaction details by hash.

**Parameters:**
- `txid` (string): Transaction hash
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "hash": "0xabcdef1234567890",
  "size": 500,
  "version": 0,
  "nonce": 0,
  "sender": "address1",
  "sysfee": "0.1",
  "netfee": "0.05",
  "validuntilblock": 12400,
  "signers": [],
  "attributes": [],
  "script": "",
  "witnesses": []
}
```

**Example:**
```json
{
  "name": "get_transaction",
  "arguments": {
    "txid": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "network": "testnet"
  }
}
```

### get_balance

Get account balance for a specific address.

**Parameters:**
- `address` (string): Neo N3 address
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "balance": [
    {
      "asset": "NEO",
      "amount": "100"
    },
    {
      "asset": "GAS",
      "amount": "50.5"
    }
  ]
}
```

**Example:**
```json
{
  "name": "get_balance",
  "arguments": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "network": "mainnet"
  }
}
```

### transfer_assets

Transfer assets between addresses.

**Parameters:**
- `fromWIF` (string): WIF of the sender account
- `toAddress` (string): Recipient address
- `asset` (string): Asset hash or symbol (e.g., "NEO", "GAS")
- `amount` (string | number): Amount to transfer
- `confirm` (boolean): Confirmation flag to prevent accidental transfers
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "txid": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "message": "Transfer successful",
  "network": "mainnet"
}
```

**Example:**
```json
{
  "name": "transfer_assets",
  "arguments": {
    "fromWIF": "KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn",
    "toAddress": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "asset": "NEO",
    "amount": "1",
    "confirm": true,
    "network": "testnet"
  }
}
```

### invoke_contract

Invoke a smart contract method.

**Parameters:**
- `fromWIF` (string): WIF of the account to sign the transaction
- `scriptHash` (string): Contract script hash
- `operation` (string): Method name
- `args` (array, optional): Method arguments
- `confirm` (boolean): Confirmation flag to prevent accidental invocations
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "txid": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "message": "Contract invocation successful",
  "network": "mainnet"
}
```

**Example:**
```json
{
  "name": "invoke_contract",
  "arguments": {
    "fromWIF": "KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn",
    "scriptHash": "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
    "operation": "transfer",
    "args": [
      {
        "type": "Hash160",
        "value": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ"
      },
      {
        "type": "Hash160",
        "value": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ"
      },
      {
        "type": "Integer",
        "value": "1"
      },
      {
        "type": "Any",
        "value": null
      }
    ],
    "confirm": true,
    "network": "testnet"
  }
}
```

### create_wallet

Create a new wallet.

**Parameters:**
- `password` (string): Password for encrypting the wallet
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
  "publicKey": "publicKey",
  "encryptedPrivateKey": "encryptedKey",
  "WIF": "WIF",
  "network": "mainnet"
}
```

**Example:**
```json
{
  "name": "create_wallet",
  "arguments": {
    "password": "your-secure-password",
    "network": "testnet"
  }
}
```

### import_wallet

Import an existing wallet from WIF or encrypted key.

**Parameters:**
- `key` (string): WIF or encrypted private key
- `password` (string, optional): Password for decrypting the key (if encrypted)
- `network` (optional): Network to use (`mainnet` or `testnet`)

**Returns:**
```json
{
  "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
  "publicKey": "publicKey",
  "network": "mainnet"
}
```

**Example:**
```json
{
  "name": "import_wallet",
  "arguments": {
    "key": "KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn",
    "password": "your-secure-password",
    "network": "testnet"
  }
}
```

## MCP Resources

The Neo N3 MCP server exposes the following resources through the MCP protocol:

### neo://network/status

Get the current status of the Neo N3 network (defaults to mainnet).

**Parameters:**
- None

**Returns:**
```json
{
  "height": 12345,
  "validators": [
    {
      "publickey": "key1",
      "votes": "100",
      "active": true
    },
    {
      "publickey": "key2",
      "votes": "200",
      "active": true
    }
  ],
  "network": "mainnet"
}
```

### neo://mainnet/status

Get the current status of the Neo N3 mainnet.

**Parameters:**
- None

**Returns:**
```json
{
  "height": 12345,
  "validators": [
    {
      "publickey": "key1",
      "votes": "100",
      "active": true
    },
    {
      "publickey": "key2",
      "votes": "200",
      "active": true
    }
  ],
  "network": "mainnet"
}
```

### neo://testnet/status

Get the current status of the Neo N3 testnet.

**Parameters:**
- None

**Returns:**
```json
{
  "height": 12345,
  "validators": [
    {
      "publickey": "key1",
      "votes": "100",
      "active": true
    },
    {
      "publickey": "key2",
      "votes": "200",
      "active": true
    }
  ],
  "network": "testnet"
}
```

### neo://block/{height}

Get a block by height (defaults to mainnet).

**Parameters:**
- `height` (number): The height of the block

**Returns:**
```json
{
  "hash": "0x1234567890abcdef",
  "size": 1000,
  "version": 0,
  "previousblockhash": "0x0987654321fedcba",
  "merkleroot": "0xabcdef1234567890",
  "time": 1600000000,
  "index": 12344,
  "nonce": "0",
  "nextconsensus": "address",
  "script": {
    "invocation": "",
    "verification": ""
  },
  "tx": []
}
```

### neo://mainnet/block/{height}

Get a block by height from mainnet.

**Parameters:**
- `height` (number): The height of the block

**Returns:**
Same as `neo://block/{height}`

### neo://testnet/block/{height}

Get a block by height from testnet.

**Parameters:**
- `height` (number): The height of the block

**Returns:**
Same as `neo://block/{height}`

### neo://address/{address}/balance

Get the balance of a Neo N3 address (defaults to mainnet).

**Parameters:**
- `address` (string): The Neo N3 address

**Returns:**
```json
{
  "balance": [
    {
      "asset": "NEO",
      "amount": "100"
    },
    {
      "asset": "GAS",
      "amount": "50.5"
    }
  ]
}
```

### neo://mainnet/address/{address}/balance

Get the balance of a Neo N3 address on mainnet.

**Parameters:**
- `address` (string): The Neo N3 address

**Returns:**
Same as `neo://address/{address}/balance`

### neo://testnet/address/{address}/balance

Get the balance of a Neo N3 address on testnet.

**Parameters:**
- `address` (string): The Neo N3 address

**Returns:**
Same as `neo://address/{address}/balance`

## Error Handling

The Neo N3 MCP server uses standardized error responses to provide clear information about failures. Errors are returned in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error message"
    }
  ],
  "isError": true
}
```

### Common Error Types

1. **Invalid Parameters**
   - Malformed addresses
   - Invalid hashes
   - Missing required parameters
   - Invalid network parameter

2. **Network Errors**
   - Connection failures to Neo N3 node
   - Timeout errors
   - Network-specific failures

3. **Blockchain Errors**
   - Insufficient funds
   - Invalid signature
   - Unknown assets

## Configuration

The Neo N3 MCP server can be configured using environment variables. Here's a detailed explanation of each configuration option:

### Neo N3 Node Configuration

- `NEO_RPC_URL`: Default URL of the Neo N3 RPC node
  - Default: `http://localhost:10332`
  - Example: `http://seed1.neo.org:10332`

- `NEO_MAINNET_RPC_URL`: URL of the Neo N3 mainnet RPC node
  - Default: Same as `NEO_RPC_URL` or `http://seed1.neo.org:10332`
  - Example: `http://seed1.neo.org:10332`

- `NEO_TESTNET_RPC_URL`: URL of the Neo N3 testnet RPC node
  - Default: `https://testnet1.neo.coz.io:443`
  - Example: `https://testnet2.neo.coz.io:443`

- `NEO_NETWORK`: Default network type
  - Values: `mainnet`, `testnet`
  - Default: `mainnet`

### Wallet Configuration

- `WALLET_PATH`: Path to the wallet files
  - Default: `./wallets`
  - Example: `/path/to/wallets`

### Logging Configuration

- `LOG_LEVEL`: Log level
  - Values: `debug`, `info`, `warn`, `error`
  - Default: `info`

- `LOG_CONSOLE`: Whether to log to console
  - Values: `true`, `false`
  - Default: `true`

- `LOG_FILE`: Whether to log to file
  - Values: `true`, `false`
  - Default: `false`

- `LOG_FILE_PATH`: Path to log file
  - Default: `./logs/neo-n3-mcp.log`
  - Example: `/path/to/logs/neo-n3-mcp.log`

### Security Configuration

- `MAX_REQUESTS_PER_MINUTE`: Maximum number of requests per minute
  - Default: `60`
  - Example: `120`

- `REQUIRE_CONFIRMATION`: Whether to require confirmation for sensitive operations
  - Values: `true`, `false`
  - Default: `true`

## Data Types

### Asset Types

- `NEO`: The Neo token
- `GAS`: The Gas token
- Custom tokens: Specified by their script hash

#### Network-Specific Asset Hashes

**Mainnet:**
- NEO: `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5`
- GAS: `0xd2a4cff31913016155e38e474a2c06d08be276cf`

**Testnet:**
- NEO: `0x8c23f196d8a1bfd103a9dcb1f9ccf0c611377d3b`
- GAS: `0xd2a4cff31913016155e38e474a2c06d08be276cf`

### Contract Parameter Types

- `Hash160`: A 160-bit hash (e.g., addresses)
- `Integer`: A number
- `ByteArray`: A byte array
- `String`: A string
- `Boolean`: A boolean value
- `Hash256`: A 256-bit hash
- `Array`: An array of parameters
- `Any`: Any type of parameter

## Security Considerations

When using the API, keep the following security considerations in mind:

1. **Private Keys**: Never share WIF keys or private keys
2. **Confirmation Flag**: Always set the `confirm` flag to `true` for sensitive operations
3. **RPC URL**: Use secure connections (HTTPS) for remote RPC nodes
4. **Rate Limiting**: Be aware of rate limits to prevent denial of service
5. **Input Validation**: All inputs should be validated before passing to the API
6. **Network Selection**: Be cautious about which network you're using (mainnet or testnet)

## Compatibility

The Neo N3 MCP server is compatible with:

- Neo N3 network (not compatible with Neo Legacy)
- Neo N3 RPC nodes running version 3.0.0 or higher
- MCP protocol version 0.1.0 or higher 