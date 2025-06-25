# Neo N3 MCP Server

**MCP Server for Neo N3 Blockchain Integration** | Version 1.5.0

[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.9.0-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Neo N3](https://img.shields.io/badge/Neo%20N3-Compatible-green)](https://neo.org/)
[![NPM](https://img.shields.io/badge/NPM-@r3e/neo--n3--mcp-red)](https://www.npmjs.com/package/@r3e/neo-n3-mcp)

A production-ready MCP server providing Neo N3 blockchain integration with 34 tools and 9 resources for wallet management, asset transfers, contract interactions, and blockchain queries.

## 🚀 Quick Start

### Install from NPM
```bash
# Install globally
npm install -g @r3e/neo-n3-mcp

# Or install locally
npm install @r3e/neo-n3-mcp
```

### Basic Usage
```bash
# Run with default configuration
npx @r3e/neo-n3-mcp

# Or if installed globally
neo-n3-mcp
```

## ⚙️ Configuration

### 1. Command Line Configuration

```bash
# Specify network
neo-n3-mcp --network testnet

# Custom RPC endpoints
neo-n3-mcp --mainnet-rpc https://mainnet1.neo.coz.io:443 --testnet-rpc https://testnet1.neo.coz.io:443

# Enable logging
neo-n3-mcp --log-level info --log-file ./neo-mcp.log

# Complete example
neo-n3-mcp \
  --network mainnet \
  --mainnet-rpc https://mainnet1.neo.coz.io:443 \
  --testnet-rpc https://testnet1.neo.coz.io:443 \
  --log-level debug \
  --log-file ./logs/neo-mcp.log
```

### 2. JSON Configuration

Create a `neo-mcp-config.json` file:

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
  "server": {
    "name": "neo-n3-mcp-server",
    "version": "1.5.0"
  },
  "wallets": {
    "directory": "./wallets"
  }
}
```

Run with config file:
```bash
neo-n3-mcp --config ./neo-mcp-config.json
```

### 3. Docker Configuration

#### Using Docker Hub Image
```bash
# Basic run
docker run -p 3000:3000 r3e/neo-n3-mcp:1.5.0

# With environment variables
docker run -p 3000:3000 \
  -e NEO_NETWORK=mainnet \
  -e NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443 \
  -e NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443 \
  -e LOG_LEVEL=info \
  r3e/neo-n3-mcp:1.5.0

# With volume for persistent data
docker run -p 3000:3000 \
  -v $(pwd)/wallets:/app/wallets \
  -v $(pwd)/logs:/app/logs \
  -e NEO_NETWORK=testnet \
  r3e/neo-n3-mcp:1.5.0
```

#### Docker Compose
Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  neo-mcp:
    image: r3e/neo-n3-mcp:1.5.0
    ports:
      - "3000:3000"
    environment:
      - NEO_NETWORK=mainnet
      - NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
      - NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443
      - LOG_LEVEL=info
      - LOG_FILE=/app/logs/neo-mcp.log
    volumes:
      - ./wallets:/app/wallets
      - ./logs:/app/logs
      - ./config:/app/config
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

#### Custom Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY config/ ./config/

# Create necessary directories
RUN mkdir -p wallets logs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## 🔧 Configuration Options

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `NEO_NETWORK` | Default network (mainnet/testnet) | `testnet` |
| `NEO_MAINNET_RPC` | Mainnet RPC endpoint | `https://mainnet1.neo.coz.io:443` |
| `NEO_TESTNET_RPC` | Testnet RPC endpoint | `https://testnet1.neo.coz.io:443` |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` |
| `LOG_FILE` | Log file path | `./logs/neo-mcp.log` |
| `WALLET_DIR` | Wallet storage directory | `./wallets` |

### Command Line Options
| Option | Description |
|--------|-------------|
| `--network` | Set default network |
| `--mainnet-rpc` | Mainnet RPC URL |
| `--testnet-rpc` | Testnet RPC URL |
| `--log-level` | Set logging level |
| `--log-file` | Set log file path |
| `--config` | Load configuration from JSON file |
| `--help` | Show help information |

## 🛠️ MCP Client Integration

### Claude Desktop
Add to your Claude Desktop config (`~/.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "neo-n3": {
      "command": "npx",
      "args": [
        "-y",
        "@r3e/neo-n3-mcp",
        "--network",
        "testnet"
      ],
      "disabled": false,
      "env": {
        "NEO_NETWORK": "testnet",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

For mainnet configuration:
```json
{
  "mcpServers": {
    "neo-n3": {
      "command": "npx",
      "args": [
        "-y",
        "@r3e/neo-n3-mcp",
        "--network",
        "mainnet"
      ],
      "disabled": false,
      "env": {
        "NEO_NETWORK": "mainnet",
        "NEO_MAINNET_RPC": "https://mainnet1.neo.coz.io:443",
        "NEO_TESTNET_RPC": "https://testnet1.neo.coz.io:443",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Custom MCP Client
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['@r3e/neo-n3-mcp', '--network', 'mainnet']
});

const client = new Client(
  { name: 'my-neo-client', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);
```

## 📊 Available Tools & Resources

### 🛠️ Tools (34 available)
- **Network**: `get_network_mode`, `set_network_mode`
- **Blockchain**: `get_blockchain_info`, `get_block_count`, `get_block`, `get_transaction`
- **Wallets**: `create_wallet`, `import_wallet`
- **Assets**: `get_balance`, `transfer_assets`, `estimate_transfer_fees`
- **Contracts**: `invoke_contract`, `list_famous_contracts`, `get_contract_info`
- **Advanced**: `claim_gas`, `estimate_invoke_fees`

### 📁 Resources (9 available)
- **Network Status**: `neo://network/status`, `neo://mainnet/status`, `neo://testnet/status`
- **Blockchain Data**: `neo://mainnet/blockchain`, `neo://testnet/blockchain`
- **Contract Registry**: `neo://mainnet/contracts`, `neo://testnet/contracts`
- **Asset Information**: `neo://mainnet/assets`, `neo://testnet/assets`

## 🔐 Security

- **Input Validation**: All inputs validated and sanitized
- **Confirmation Required**: Sensitive operations require explicit confirmation
- **Private Key Security**: Keys encrypted and stored securely
- **Network Isolation**: Separate configurations for mainnet/testnet
- **Rate Limiting**: Configurable rate limiting for production deployments
- **Secure Logging**: No sensitive data exposed in logs

## ⚡ Performance & Reliability

- **Rate Limiting**: Built-in rate limiting with configurable thresholds
- **Error Handling**: Comprehensive error handling with proper MCP error codes
- **Network Resilience**: Automatic fallback mechanisms for RPC calls
- **Production Ready**: Systemd service configuration and monitoring support

## 📚 Documentation

- **[API Reference](./API.md)** - Complete API documentation
- **[Architecture](./ARCHITECTURE.md)** - System design and components
- **[Examples](./EXAMPLES.md)** - Practical usage examples and best practices
- **[Production Checklist](./PRODUCTION_CHECKLIST.md)** - Production deployment guide
- **[Deployment](./DEPLOYMENT.md)** - Deployment configuration
- **[Testing](./TESTING.md)** - Testing and validation
- **[Networks](./NETWORKS.md)** - Network configuration details

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/@r3e/neo-n3-mcp
- **Neo N3 Documentation**: https://docs.neo.org/
- **MCP Protocol**: https://modelcontextprotocol.io/
