# Neo N3 Model Context Protocol (MCP) v1.2.1

This repository contains the implementation of the Neo N3 Model Context Protocol (MCP), which enables interaction with the Neo N3 blockchain through a standardized interface. Version 1.2.1 includes enhanced error handling, improved mock data support, and various bug fixes.

## Overview

The Neo N3 MCP provides a standardized way to perform blockchain operations, including:

- Querying blockchain information (blocks, transactions, account balances)
- Creating and managing wallets
- Transferring digital assets
- Invoking smart contracts
- Interacting with famous Neo N3 contracts like NeoFS, NeoBurger, and more

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Steps

1. Install from npm:
```bash
npm install @r3e/neo-n3-mcp
```

2. Or clone this repository:
```bash
git clone https://github.com/yourusername/neo-n3-mcp.git
cd neo-n3-mcp
npm install
npm run build
```

## Running the MCP Server

The Neo N3 MCP can be run in two modes:

1. **Standard Mode** - Uses standard input/output for communication
   ```bash
   npm start
   ```

2. **HTTP Server Mode** - Exposes an HTTP endpoint for communication
   ```bash
   npm run start:http
   ```

   The HTTP server provides the following endpoints:
   - `POST /mcp` - The main MCP endpoint for making requests
   - `GET /health` - A health check endpoint that returns the server status

## Configuration

By default, the MCP supports both mainnet and testnet environments. You can configure the network mode in the settings.

### Core Functionality

The Neo N3 MCP focuses on essential blockchain interactions through these core RPC methods:

- **Contract Interaction**: Invoke smart contracts using `invokefunction`
- **Transaction Management**: Send transactions with `sendrawtransaction` and check status with `getrawtransaction`
- **Blockchain Status**: Get current height with `getblockcount` and block details with `getblock`
- **Account Information**: Get token balances with `getnep17balances`

These core functions provide all the necessary capabilities for dApp interactions without unnecessary complexity.

## Basic Usage

```javascript
const axios = require('axios');

// Call the MCP service
async function callMcp(toolName, args = {}) {
  const response = await axios.post('http://localhost:5000/mcp', {
    name: toolName,
    arguments: args
  });

  return response.data;
}

// Example: Get blockchain information
const blockchainInfo = await callMcp('get_blockchain_info', {
  network: 'mainnet'
});

console.log(`Current block height: ${blockchainInfo.result.height}`);

// Example: Create a wallet
const wallet = await callMcp('create_wallet', {
  password: 'secure-password-123',
  network: 'testnet'
});

console.log(`Wallet address: ${wallet.result.address}`);
console.log(`WIF key: ${wallet.result.WIF}`);
```

You can find a complete example in `examples/simple-mcp-example.js`. To run it:

```bash
npm run example:simple
```

## Available MCP Tools

The Neo N3 MCP provides a focused set of tools for essential blockchain operations:

### Blockchain Status
- `get_blockchain_info`: Get current block height and network information
- `get_block`: Get detailed block information by height or hash
- `get_transaction`: Get transaction details and confirmation status

### Account Operations
- `get_balance`: Get NEP-17 token balances for an address
- `create_wallet`: Create a new Neo N3 wallet
- `import_wallet`: Import an existing wallet from WIF or private key

### Smart Contract Interaction
- `invoke_read_contract`: Execute read-only contract operations
- `invoke_write_contract`: Execute contract operations that modify state
- `get_contract_info`: Get information about common Neo N3 contracts

### Transaction Management
- `transfer_assets`: Create, sign and send asset transfer transactions
- `estimate_fees`: Estimate gas fees for transactions

You can find examples of using these tools in the `examples` directory:
```bash
# Run the core functionality example
npm run example:core
```

## Security

- Private keys and WIFs are never stored by the MCP
- All sensitive operations require explicit confirmation
- Transactions can be simulated before confirmation

## Documentation

For more detailed documentation, see:

- [API Reference](API.md) - Detailed API reference for all MCP tools
- [Testing](TESTING.md) - Information on testing the MCP implementation
- [Deployment](DEPLOYMENT.md) - Deployment instructions
- [Architecture](ARCHITECTURE.md) - Architecture overview
- [Networks](NETWORKS.md) - Information on supported networks

## Development

### Building
```bash
npm run build
```

### Testing
```bash
# Run all tests
npm test

# Run simple tests
npm run test:simple

# Run network tests
npm run test:network

# Run transaction status tests
npm run test:tx-status

# Run core functionality tests
npm run test:core

# Run integration tests
npm run test:integration
```

### Contribution
Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Neo N3 Blockchain](https://neo.org/)
- [Neo N3 JavaScript SDK](https://github.com/CityOfZion/neon-js)
- [Model Context Protocol](https://modelcontextprotocol.ai/)
