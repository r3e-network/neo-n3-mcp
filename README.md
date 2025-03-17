# Neo N3 MCP Server

An MCP server for interacting with the Neo N3 blockchain.

## Features

- Query blockchain information (height, validators)
- Get block details by height or hash
- Get transaction details by hash
- Check account balances
- Transfer assets between addresses
- Deploy and invoke smart contracts
- Create and import wallets

## Installation

### Using Docker (recommended)

```bash
# Clone the repository
git clone https://github.com/R3E-Network/neo-n3-mcp.git
cd neo-n3-mcp

# Start the server with Docker Compose
docker-compose up -d
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/R3E-Network/neo-n3-mcp.git
cd neo-n3-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Adding to MCP Settings

To add the Neo N3 MCP server to your MCP settings, you can use the provided script:

```bash
# Build the project first
npm run build

# Add to MCP settings
npm run add-to-mcp
```

This will automatically add the Neo N3 MCP server to your Claude MCP settings file, making it available for use with Claude.

## Configuration

The server can be configured using environment variables:

- `NEO_RPC_URL`: URL of the Neo N3 RPC node (default: http://localhost:10332)
- `WALLET_PATH`: Path to the wallet files (default: ./wallets)
- `NEO_NETWORK`: Network type: 'mainnet', 'testnet', or 'private' (default: mainnet)
- `LOG_LEVEL`: Log level: 'debug', 'info', 'warn', 'error' (default: info)
- `LOG_CONSOLE`: Whether to log to console (default: true)
- `LOG_FILE`: Whether to log to file (default: false)
- `LOG_FILE_PATH`: Path to log file (default: ./logs/neo-n3-mcp.log)
- `MAX_REQUESTS_PER_MINUTE`: Maximum number of requests per minute (default: 60)
- `REQUIRE_CONFIRMATION`: Whether to require confirmation for sensitive operations (default: true)

## Usage

### Tools

#### get_blockchain_info

Get general information about the Neo N3 blockchain.

```json
{
  "name": "get_blockchain_info",
  "arguments": {}
}
```

#### get_block

Get block details by height or hash.

```json
{
  "name": "get_block",
  "arguments": {
    "hashOrHeight": 12345
  }
}
```

#### get_transaction

Get transaction details by hash.

```json
{
  "name": "get_transaction",
  "arguments": {
    "txid": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}
```

#### get_balance

Get account balance for a specific address.

```json
{
  "name": "get_balance",
  "arguments": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ"
  }
}
```

#### transfer_assets

Transfer assets between addresses.

```json
{
  "name": "transfer_assets",
  "arguments": {
    "fromWIF": "KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn",
    "toAddress": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "asset": "NEO",
    "amount": "1",
    "confirm": true
  }
}
```

#### invoke_contract

Invoke a smart contract method.

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
    "confirm": true
  }
}
```

#### create_wallet

Create a new wallet.

```json
{
  "name": "create_wallet",
  "arguments": {
    "password": "your-secure-password"
  }
}
```

#### import_wallet

Import an existing wallet from WIF or encrypted key.

```json
{
  "name": "import_wallet",
  "arguments": {
    "key": "KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn",
    "password": "your-secure-password"
  }
}
```

### Resources

#### Neo N3 Network Status

```
neo://network/status
```

#### Neo N3 Block by Height

```
neo://block/{height}
```

#### Neo N3 Address Balance

```
neo://address/{address}/balance
```

## Security Considerations

- Private keys are never exposed in responses
- Sensitive operations (transfers, contract invocations) require explicit confirmation
- Input validation is performed for all parameters
- Error messages are designed to be informative without exposing sensitive information

## License

MIT
