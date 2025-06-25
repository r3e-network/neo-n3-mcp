# Neo N3 MCP Server

**MCP Server for Neo N3 Blockchain Integration** | Version 1.6.0

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
    "version": "1.6.0"
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
docker run -p 3000:3000 r3e/neo-n3-mcp:1.6.0

# With environment variables
docker run -p 3000:3000 \
  -e NEO_NETWORK=mainnet \
  -e NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443 \
  -e NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443 \
  -e LOG_LEVEL=info \
  r3e/neo-n3-mcp:1.6.0

# With volume for persistent data
docker run -p 3000:3000 \
  -v $(pwd)/wallets:/app/wallets \
  -v $(pwd)/logs:/app/logs \
  -e NEO_NETWORK=testnet \
  r3e/neo-n3-mcp:1.6.0
```

#### Docker Compose
Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  neo-mcp:
    image: r3e/neo-n3-mcp:1.6.0
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

### 🐳 Docker Quick Start

```bash
# Quick start with Docker Compose
git clone https://github.com/r3e-network/neo-n3-mcp.git
cd neo-n3-mcp
docker-compose -f docker/docker-compose.yml up -d

# Or build and run manually
npm run docker:build
npm run docker:run

# Development mode
npm run docker:up:dev
```

#### Production Docker Setup
```bash
# Build production image
./scripts/docker-build.sh --tag v1.6.0

# Run with custom configuration
docker run -d \
  --name neo-mcp-prod \
  -p 3000:3000 \
  -e NEO_NETWORK=mainnet \
  -v neo-mcp-logs:/app/logs \
  neo-n3-mcp:v1.6.0
```

#### Development Docker Setup
```bash
# Build development image
./scripts/docker-build.sh --dev

# Run with hot reload and debugging
docker-compose -f docker/docker-compose.dev.yml up -d
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

## 🔄 Version Management & Release Process

### Current Version: 1.6.0

This project follows [Semantic Versioning](https://semver.org/) with automated CI/CD pipeline for releases. See our [Version Management Guide](./docs/VERSION_MANAGEMENT.md) for detailed information.

### 🚀 How to Trigger Next Version Release

#### **Method 1: Automated Release Script (Recommended)**
```bash
# 1. First, do a dry run to see what will happen
./scripts/prepare-release.sh --type minor --dry-run

# 2. If everything looks good, run the actual release preparation
./scripts/prepare-release.sh --type minor

# 3. Push the changes (script will guide you)
git push

# 4. Create GitHub release (triggers full CI/CD pipeline)
gh release create v1.7.0 --generate-notes
```

#### **Method 2: Manual NPM Version Commands**
```bash
# Check current version
npm run version:check

# Bump version manually
npm run version:patch   # 1.6.0 → 1.6.1 (bug fixes)
npm run version:minor   # 1.6.0 → 1.7.0 (new features)
npm run version:major   # 1.6.0 → 2.0.0 (breaking changes)

# Then commit and push
git add . && git commit -m "chore: bump version to 1.7.0"
git push
```

#### **Method 3: GitHub Release (Direct)**
```bash
# Using GitHub CLI
gh release create v1.7.0 --generate-notes

# Or manually through GitHub web interface:
# 1. Go to https://github.com/r3e-network/neo-n3-mcp/releases
# 2. Click "Create a new release"
# 3. Tag: v1.7.0, Title: "Release v1.7.0"
# 4. Auto-generate release notes
# 5. Publish release
```

### 🔄 What Happens When You Create a Release

The automated CI/CD pipeline triggers the following workflow:

#### **Phase 1: Testing & Validation** ⚡
- ✅ **Multi-version testing**: Node.js 18.x, 20.x, 22.x on ubuntu-latest
- ✅ **Code quality**: Linting and type checking
- ✅ **Unit tests**: Core functionality validation
- ✅ **Coverage reporting**: Automatic upload to Codecov

#### **Phase 2: Build & Docker** 🔨
- ✅ **TypeScript compilation**: Build validation
- ✅ **Docker builds**: Both development and production images
- ✅ **Container testing**: Docker functionality validation
- ✅ **Compose validation**: Configuration testing

#### **Phase 3: Security & Audit** 🔒
- ✅ **Security audit**: npm audit for vulnerabilities
- ✅ **Dependency check**: audit-ci for security issues
- ✅ **Package updates**: Check for outdated dependencies

#### **Phase 4: Publishing** 📦 (Only on release)
- 🚀 **NPM Publishing**: Automatic package publishing to npm registry
- 🐳 **Docker Publishing**: Multi-tag image publishing to Docker Hub
- 📋 **Versioned tags**: Semantic versioning with proper tagging

#### **Phase 5: Deployment** 🌐 (Only on release)
- 🎯 **Production deployment**: Automated deployment notification
- 📊 **Release tracking**: Version monitoring and validation

### 📋 Release Types

| Type | Version Change | Use Case | Example |
|------|---------------|----------|---------|
| **patch** | 1.6.0 → 1.6.1 | Bug fixes, security patches | `./scripts/prepare-release.sh --type patch` |
| **minor** | 1.6.0 → 1.7.0 | New features, enhancements | `./scripts/prepare-release.sh --type minor` |
| **major** | 1.6.0 → 2.0.0 | Breaking changes | `./scripts/prepare-release.sh --type major` |

### 🎯 Quick Release Commands

```bash
# For next minor release (recommended for new features)
./scripts/prepare-release.sh --type minor

# For patch release (bug fixes)
./scripts/prepare-release.sh --type patch

# For major release (breaking changes)
./scripts/prepare-release.sh --type major

# Test what would happen (dry run)
./scripts/prepare-release.sh --type minor --dry-run
```

### 📊 Latest Changes (v1.6.0)
- ✨ **Enterprise CI/CD Pipeline**: Complete GitHub Actions workflow
- 🐳 **Docker Infrastructure**: Production and development environments
- 📁 **Project Organization**: Structured folders (docker/, docs/, scripts/)
- 🔧 **Automated Publishing**: NPM and Docker Hub integration
- 📚 **Comprehensive Documentation**: Guides for all deployment scenarios
- 🔄 **Version Management**: Automated release preparation and validation

### 📚 Release Documentation
- **[CHANGELOG.md](./docs/CHANGELOG.md)** - Complete version history
- **[VERSION_MANAGEMENT.md](./docs/VERSION_MANAGEMENT.md)** - Detailed release process
- **[WORKFLOW.md](./docs/WORKFLOW.md)** - CI/CD pipeline documentation

### 🔐 Required Secrets (Already Configured)
- ✅ `NPM_TOKEN` - For NPM registry publishing
- ✅ `DOCKER_USERNAME` - Docker Hub username
- ✅ `DOCKER_PASSWORD` - Docker Hub access token

## 📚 Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and components
- **[Examples](./docs/EXAMPLES.md)** - Practical usage examples and best practices
- **[Docker Guide](./docs/DOCKER.md)** - Comprehensive Docker deployment guide
- **[Production Checklist](./docs/PRODUCTION_CHECKLIST.md)** - Production deployment guide
- **[Deployment](./docs/DEPLOYMENT.md)** - Deployment configuration
- **[Testing](./docs/TESTING.md)** - Testing and validation
- **[Networks](./docs/NETWORKS.md)** - Network configuration details
- **[Version Management](./docs/VERSION_MANAGEMENT.md)** - Release process and versioning
- **[Release Guide](./docs/RELEASE_GUIDE.md)** - Quick reference for triggering releases
- **[Workflow Guide](./docs/WORKFLOW.md)** - CI/CD pipeline documentation
- **[Changelog](./docs/CHANGELOG.md)** - Version history and changes

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/@r3e/neo-n3-mcp
- **Neo N3 Documentation**: https://docs.neo.org/
- **MCP Protocol**: https://modelcontextprotocol.io/
