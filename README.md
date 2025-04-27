# Neo N3 Model Context Protocol (MCP) v1.2.1

The Neo N3 Model Context Protocol (MCP) enables AI agents and applications to interact with the Neo N3 blockchain through a standardized interface. This protocol bridges the gap between AI systems and blockchain technology, allowing for seamless integration of Neo N3 capabilities into AI workflows.

## What is Neo N3 MCP?

Neo N3 MCP is an implementation of the Model Context Protocol specifically designed for the Neo N3 blockchain. It provides AI agents with the ability to:

- Query blockchain information (blocks, transactions, balances)
- Create and manage wallets
- Transfer NEO, GAS, and other NEP-17 tokens
- Invoke smart contracts
- Interact with popular Neo N3 DeFi platforms and NFT marketplaces

## For AI Agent Developers

If you're developing AI agents that need to interact with the Neo N3 blockchain, the Neo N3 MCP provides a standardized way to access blockchain functionality without requiring deep blockchain expertise.

### Supported Operations

The Neo N3 MCP supports the following operations:

#### Blockchain Information
- `get_blockchain_info` - Get current blockchain height and network information
- `get_block` - Retrieve detailed information about a specific block
- `get_transaction` - Get transaction details and confirmation status
- `get_network_mode` - Check which networks (mainnet/testnet) are currently enabled

#### Wallet Management
- `create_wallet` - Generate a new Neo N3 wallet
- `import_wallet` - Import an existing wallet using WIF or private key
- `get_balance` - Check NEP-17 token balances for an address

#### Asset Transfers
- `transfer_assets` - Send NEO, GAS, or other tokens to another address
- `estimate_fees` - Calculate the gas fees required for a transaction

#### Smart Contract Interaction
- `invoke_read_contract` - Execute read-only smart contract methods
- `invoke_write_contract` - Execute methods that modify blockchain state
- `list_famous_contracts` - Get a list of well-known Neo N3 contracts
- `get_contract_info` - Get details about a specific contract

#### DeFi & NFT Operations
- `neoburger_deposit` - Stake NEO in NeoBurger
- `neoburger_withdraw` - Withdraw NEO from NeoBurger
- `neocompound_deposit` - Deposit assets into NeoCompound
- `neocompound_withdraw` - Withdraw assets from NeoCompound
- `ghostmarket_create_nft` - Create an NFT on GhostMarket
- `ghostmarket_list_nft` - List an NFT for sale
- `ghostmarket_buy_nft` - Purchase a listed NFT

### Example Usage

Here's how an AI agent might use the Neo N3 MCP to check the current blockchain height:

```
Tool: neo_n3_mcp.get_blockchain_info
Parameters: {"network": "mainnet"}
```

Response:
```json
{
  "result": {
    "height": 3456789,
    "network": "mainnet"
  }
}
```

To transfer NEO tokens:

```
Tool: neo_n3_mcp.transfer_assets
Parameters: {
  "network": "testnet",
  "walletPath": "/path/to/wallet.json",
  "walletPassword": "secure-password",
  "toAddress": "NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj",
  "asset": "NEO",
  "amount": "1",
  "confirm": true
}
```

Response:
```json
{
  "result": {
    "txid": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "address": "NVbGwMfRQVudQCcChhCFwQRwSxr5tYEqQs",
    "network": "testnet"
  }
}
```

## For Application Developers

If you're building applications that need to integrate with Neo N3 blockchain, you can use the Neo N3 MCP as a standardized interface.

### Installation

```bash
npm install @r3e/neo-n3-mcp
```

### Running the MCP Server

The Neo N3 MCP can be run in two modes:

1. **Standard Mode** - Uses standard input/output for communication
   ```bash
   npx neo-n3-mcp
   ```

2. **HTTP Server Mode** - Exposes an HTTP endpoint for communication
   ```bash
   npx neo-n3-mcp-http
   ```

### HTTP API Usage

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
async function getBlockchainInfo() {
  const result = await callMcp('get_blockchain_info', {
    network: 'mainnet'
  });

  console.log(`Current block height: ${result.result.height}`);
  return result;
}

// Example: Create a wallet
async function createWallet() {
  const result = await callMcp('create_wallet', {
    password: 'secure-password-123',
    network: 'testnet'
  });

  console.log(`Wallet address: ${result.result.address}`);
  console.log(`WIF key: ${result.result.WIF}`);
  return result;
}
```

## Security Considerations

When using Neo N3 MCP, keep these security best practices in mind:

- **Private Keys**: Never expose private keys or wallet passwords in plaintext
- **Confirmation**: Always use the `confirm: true` parameter for transactions to prevent accidental execution
- **Simulation**: Use `estimate_fees` to simulate transactions before executing them
- **Network Selection**: Be explicit about which network you're using (mainnet/testnet)
- **Error Handling**: Always handle errors gracefully, especially for blockchain operations

## Networks

Neo N3 MCP supports both mainnet and testnet environments:

- **Mainnet**: The main Neo N3 blockchain network with real value tokens
- **Testnet**: A test network for development and testing without real value

You can specify which network to use in each request with the `network` parameter.

## Resources

- [Neo N3 Documentation](https://docs.neo.org/docs/en-us/index.html)
- [Neo N3 RPC API Reference](https://docs.neo.org/docs/n3/reference/rpc/latest-version/api.html)
- [Model Context Protocol](https://modelcontextprotocol.ai/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
