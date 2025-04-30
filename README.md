# Neo N3 Model Context Protocol (MCP) v1.3.0

The Neo N3 Model Context Protocol (MCP) provides a standardized interface for AI agents and applications to interact with the Neo N3 blockchain. This server implementation aims for simplicity and ease of use, running directly via `npx` without requiring manual environment configuration for standard usage.

## Adding the MCP to a Client (e.g., VS Code)

Configure your client to use the standard I/O server via `npx`:

**Option A: VS Code User Settings (JSON)**

Add the following to your User Settings JSON (`Ctrl+Shift+P` > `Preferences: Open User Settings (JSON)`):

```json
{
  "mcp": {
    "servers": {
      "neo-n3": { // You can choose any name
        "command": "npx",
        "args": [
          "-y", // Auto-confirm npx installation/update
          "@r3e/neo-n3-mcp"
        ]
      }
    }
  }
}
```

**Option B: Workspace Configuration (`.vscode/mcp.json`)**

Create a file named `mcp.json` inside the `.vscode` directory:

```json
{
  "servers": {
    "neo-n3": { // You can choose any name
      "command": "npx",
      "args": [
        "-y", // Auto-confirm npx installation/update
        "@r3e/neo-n3-mcp"
      ]
    }
  }
}
```

**Option C: Other Clients (e.g., Cursor)**

Follow your client's instructions for adding an MCP server using a command. Provide the command `npx` and the arguments `["-y", "@r3e/neo-n3-mcp"]`.

## Available Tools

*For detailed parameters and examples, please refer to the [API.md](./API.md) documentation.*

### Configuration & Network

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_network_mode` | Get the currently configured network mode | None |
| `set_network_mode` | Set the active network mode for subsequent calls | `mode`: "mainnet_only", "testnet_only", or "both" |

### Blockchain Information

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_blockchain_info` | Get current height and general network info | `network` |
| `get_block_count` | Get the current block height | `network` |
| `get_block` | Get block details by hash or height | `network`, `hashOrHeight` |
| `get_transaction` | Get transaction details by transaction ID | `network`, `txid` |
| `check_transaction_status` | Check if a transaction is confirmed | `network`, `txid` |

### Wallet & Account Management

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `create_wallet` | Create a new encrypted wallet file | `password` |
| `import_wallet` | Import existing wallet from WIF/private key | `key`, `password` |
| `get_balance` | Get token balances for an address | `network`, `address` |

### Asset Transfers

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `transfer_assets` | Send NEO, GAS, or other NEP-17 tokens | `network`, `fromWIF`, `toAddress`, `asset`, `amount`, `confirm` |
| `estimate_transfer_fees` | Estimate network and system fees for a transfer | `network`, `fromAddress`, `toAddress`, `asset`, `amount` |

### Smart Contract Interaction

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `list_famous_contracts` | List well-known contracts supported by the server | `network` |
| `get_contract_info` | Get details (hash, methods) of a famous contract | `network`, `contractName` |
| `invoke_contract` (replaces invoke_read/write) | Invoke a smart contract method (read or write) | `network`, `scriptHash`, `operation`, `args`, `fromWIF` (for write), `confirm` (for write) |

### NeoFS (Decentralized Storage)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `neofs_create_container` | Create a NeoFS storage container | `network`, `fromWIF`, `ownerId`, `rules`, `confirm` |
| `neofs_get_containers` | List containers owned by an ID | `network`, `ownerId` |

### NeoBurger (Staking Service)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `neoburger_deposit` | Deposit NEO to receive bNEO | `network`, `fromWIF`, `confirm` |
| `neoburger_withdraw` | Withdraw NEO by returning bNEO | `network`, `fromWIF`, `amount`, `confirm` |

## Example Requests

### Get Blockchain Information

Request:
```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "mainnet"
  }
}
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

### Transfer Assets

Request:
```json
{
  "name": "transfer_assets",
  "arguments": {
    "network": "testnet",
    "fromWIF": "YourSenderWalletWIF",
    "toAddress": "NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj",
    "asset": "NEO",
    "amount": "1",
    "confirm": true
  }
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

## Error Handling

The MCP server returns standardized error responses:

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid network parameter. Must be 'mainnet' or 'testnet'."
  }
}
```

Common error codes:
- `INVALID_PARAMETER`: Missing or invalid parameter
- `NETWORK_ERROR`: Error connecting to Neo N3 node
- `BLOCKCHAIN_ERROR`: Error from the Neo N3 blockchain
- `WALLET_ERROR`: Error with wallet operations
- `CONTRACT_ERROR`: Error with smart contract operations
- `UNAUTHORIZED`: Operation not permitted
- `INTERNAL_ERROR`: Unexpected server error

## Security Best Practices

- **WIF Handling:** Be extremely cautious when providing Wallet Import Format (WIF) keys. Ensure the environment where the MCP server runs and the communication channel are secure. Consider running the server locally or within a trusted network. Avoid exposing the server publicly without robust authentication and transport security (HTTPS).
- Store wallet files securely if using file-based approaches (though the current API seems WIF-based).
- Use `confirm: true` for all state-changing operations (transfers, contract invocations) to ensure the transaction is processed by the network.
- Store wallet files securely with strong passwords
- Use testnet for development and testing
- Keep your Neo N3 MCP server updated to the latest version

## HTTP Server

In addition to the MCP server, this package also provides an HTTP server that exposes the Neo N3 functionality through a RESTful API. The HTTP server is started automatically when you run the MCP server and listens on port 3002 by default.

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/blockchain/info` | GET | Get blockchain information |
| `/api/blockchain/height` | GET | Get the current block height |
| `/api/blocks/:height` | GET | Get block details by height |
| `/api/transactions/:txid` | GET | Get transaction details by transaction ID |
| `/api/accounts/:address/balance` | GET | Get token balances for an address |
| `/api/wallets` | POST | Create a new wallet |
| `/api/wallets/:address` | GET | Get wallet information |
| `/api/network/mode` | GET | Get the current network mode |
| `/api/contracts/:name/invoke` | POST | Invoke a smart contract method |

### Example HTTP Requests

```bash
# Get blockchain information
curl http://localhost:3002/api/blockchain/info

# Get the current block height
curl http://localhost:3002/api/blockchain/height

# Get token balances for an address
curl http://localhost:3002/api/accounts/NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj/balance

# Create a new wallet
curl -X POST -H "Content-Type: application/json" -d '{"password":"your-password"}' http://localhost:3002/api/wallets

# Get the current network mode
curl http://localhost:3002/api/network/mode
```

### Benefits of the HTTP Server

- **Accessibility**: Provides access to Neo N3 blockchain functionality for applications that don't support the MCP protocol
- **Simplicity**: Simple RESTful API that can be used with any HTTP client
- **Compatibility**: Works with existing web applications and frameworks
- **Testing**: Easier to test and debug than the MCP protocol

## Testing

This package includes integration tests to verify the functionality of both the MCP server and the HTTP server.

### Running Tests

```bash
# Build the project
npm run build

# Run the core functionality tests
npm run test:core

# Run the HTTP integration tests
npm run test:http

# Run the MCP integration tests
npm run test:integration
```

## Resources

- [Neo N3 Documentation](https://docs.neo.org/docs/en-us/index.html)
- [Neo N3 RPC API Reference](https://docs.neo.org/docs/n3/reference/rpc/latest-version/api.html)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
