# Neo N3 Model Context Protocol (MCP) v1.2.1

The Neo N3 Model Context Protocol (MCP) provides a standardized interface for AI agents and applications to interact with the Neo N3 blockchain. This guide focuses on how to use and configure the Neo N3 MCP server.

## Quick Start

### Installation

```bash
npm install @r3e/neo-n3-mcp
```

### Starting the Server

**HTTP Server Mode (Recommended for most users):**
```bash
npx neo-n3-mcp-http
```

This starts an HTTP server on port 5000 (default) with the MCP endpoint available at `http://localhost:5000/mcp`.

**Standard Mode (For AI agent integrations):**
```bash
npx neo-n3-mcp
```

This starts the MCP server in standard input/output mode, suitable for direct integration with AI agents.

## Server Configuration

### Environment Variables

Configure the Neo N3 MCP server using these environment variables:

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `NEO_NETWORK_MODE` | Which networks to enable | `both` | `mainnet_only`, `testnet_only`, `both` |
| `NEO_MAINNET_RPC_URL` | Mainnet RPC URL | `https://mainnet1.neo.coz.io:443` | Any Neo N3 RPC URL |
| `NEO_TESTNET_RPC_URL` | Testnet RPC URL | `https://testnet1.neo.coz.io:443` | Any Neo N3 RPC URL |
| `PORT` | HTTP server port | `5000` | Any valid port number |
| `LOG_LEVEL` | Logging verbosity | `info` | `error`, `warn`, `info`, `debug`, `trace` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` | `true`, `false` |
| `MIN_CALL_INTERVAL_MS` | Minimum time between RPC calls | `100` | Any number in milliseconds |
| `MAX_RETRIES` | Maximum RPC retry attempts | `3` | Any positive integer |
| `INITIAL_RETRY_DELAY_MS` | Initial delay before retry | `1000` | Any number in milliseconds |

### Configuration Examples

**Example 1: Mainnet Only with Custom RPC**
```bash
NEO_NETWORK_MODE=mainnet_only NEO_MAINNET_RPC_URL=https://my-neo-node.example.com:10331 npx neo-n3-mcp-http
```

**Example 2: Testnet with Custom Port and Logging**
```bash
NEO_NETWORK_MODE=testnet_only PORT=8080 LOG_LEVEL=debug npx neo-n3-mcp-http
```

**Example 3: Using a Configuration File**

Create a `.env` file:
```
NEO_NETWORK_MODE=both
NEO_MAINNET_RPC_URL=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
PORT=5000
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
MIN_CALL_INTERVAL_MS=100
MAX_RETRIES=3
INITIAL_RETRY_DELAY_MS=1000
```

Then start the server:
```bash
npx dotenv-cli npx neo-n3-mcp-http
```

## Using the MCP Server

### HTTP API

Send requests to the MCP server using HTTP POST:

```javascript
const axios = require('axios');

async function callMcp(toolName, args = {}) {
  const response = await axios.post('http://localhost:5000/mcp', {
    name: toolName,
    arguments: args
  });
  return response.data;
}
```

### Health Check

The HTTP server provides a health check endpoint:

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "ok",
  "version": "1.2.1",
  "networks": ["mainnet", "testnet"]
}
```

## Available Tools

### Blockchain Information

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_blockchain_info` | Get current height and network info | `network`: "mainnet" or "testnet" |
| `get_block` | Get block details | `network`, `blockHeight` or `blockHash` |
| `get_transaction` | Get transaction details | `network`, `txid` |

### Wallet Operations

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_wallet` | Create a new wallet | `network`, `password` |
| `import_wallet` | Import existing wallet | `network`, `wif` or `privateKey`, `password` |
| `get_balance` | Get token balances | `network`, `address` |

### Asset Transfers

| Tool | Description | Parameters |
|------|-------------|------------|
| `transfer_assets` | Send tokens | `network`, `walletPath`, `walletPassword`, `toAddress`, `asset`, `amount`, `confirm` |
| `estimate_fees` | Calculate gas fees | `network`, `walletPath`, `walletPassword`, `toAddress`, `asset`, `amount` |

### Smart Contract Interaction

| Tool | Description | Parameters |
|------|-------------|------------|
| `invoke_read_contract` | Call read-only methods | `network`, `scriptHash`, `operation`, `args` |
| `invoke_write_contract` | Call state-changing methods | `network`, `walletPath`, `walletPassword`, `scriptHash`, `operation`, `args`, `confirm` |

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
    "walletPath": "/path/to/wallet.json",
    "walletPassword": "secure-password",
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

- Store wallet files securely with strong passwords
- Use `confirm: true` for all state-changing operations
- Always validate responses before taking action
- Use testnet for development and testing
- Keep your Neo N3 MCP server updated to the latest version

## Resources

- [Neo N3 Documentation](https://docs.neo.org/docs/en-us/index.html)
- [Neo N3 RPC API Reference](https://docs.neo.org/docs/n3/reference/rpc/latest-version/api.html)
- [Model Context Protocol](https://modelcontextprotocol.ai/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
