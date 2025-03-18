# Neo N3 MCP Server Deployment Guide

This document outlines the deployment options and configuration for the Neo N3 MCP server.

## Deployment Options

The Neo N3 MCP server can be deployed in several ways:

1. **NPM Package**: Direct installation and usage as an NPM package
2. **Docker Container**: Deployment as a containerized application
3. **Local Development**: Running from source code

## NPM Package Deployment

### Installation

Install the package globally:

```bash
npm install -g @r3e/neo-n3-mcp
```

Or as a dependency in your project:

```bash
npm install @r3e/neo-n3-mcp
```

### Usage

Once installed, you can start the server using:

```bash
neo-n3-mcp
```

Or with custom configuration:

```bash
neo-n3-mcp --rpc-url=http://seed1.neo.org:10332 --network=mainnet
```

### Configuration

When using as an NPM package, you can configure the server using:

1. Command-line arguments
2. Environment variables
3. Configuration file

#### Command-line Arguments

```bash
neo-n3-mcp --rpc-url=http://seed1.neo.org:10332 --network=mainnet --port=3000
```

Available arguments:

- `--rpc-url`: URL of the Neo N3 RPC node
- `--network`: Network type (mainnet, testnet, private)
- `--port`: Port to listen on
- `--wallet-path`: Path to wallet files

#### Environment Variables

```bash
export NEO_RPC_URL=http://seed1.neo.org:10332
export NEO_NETWORK=mainnet
export PORT=3000
export WALLET_PATH=./wallets
neo-n3-mcp
```

#### Configuration File

Create a `.neo-n3-mcp.json` file in your project root:

```json
{
  "rpcUrl": "http://seed1.neo.org:10332",
  "network": "mainnet",
  "port": 3000,
  "walletPath": "./wallets"
}
```

## Docker Deployment

### Prerequisites

- Docker installed on your system
- Access to Docker Hub or a private Docker registry

### Pulling the Image

```bash
docker pull r3e/neo-n3-mcp:latest
```

For a specific version:

```bash
docker pull r3e/neo-n3-mcp:1.0.0
```

### Running the Container

Basic usage:

```bash
docker run -p 3000:3000 r3e/neo-n3-mcp:latest
```

With custom configuration:

```bash
docker run -p 3000:3000 \
  -e NEO_RPC_URL=http://seed1.neo.org:10332 \
  -e NEO_NETWORK=mainnet \
  -v $(pwd)/wallets:/app/wallets \
  r3e/neo-n3-mcp:latest
```

#### Configuring Dual Network Support

To configure both mainnet and testnet:

```bash
docker run -p 3000:3000 \
  -e NEO_MAINNET_RPC_URL=http://seed1.neo.org:10332 \
  -e NEO_TESTNET_RPC_URL=https://testnet1.neo.coz.io:443 \
  -v $(pwd)/wallets:/app/wallets \
  r3e/neo-n3-mcp:latest
```

The server will now accept requests for both networks, with the network specified via the `network` parameter in API calls.

### Docker Compose

For more complex setups, you can use Docker Compose:

```yaml
version: '3'
services:
  neo-n3-mcp:
    image: r3e/neo-n3-mcp:latest
    ports:
      - "3000:3000"
    environment:
      - NEO_MAINNET_RPC_URL=http://seed1.neo.org:10332
      - NEO_TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
    volumes:
      - ./wallets:/app/wallets
    restart: unless-stopped
```

Save this as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

### Building a Custom Docker Image

You can build a custom Docker image from the source:

```bash
git clone https://github.com/R3E-Network/neo-n3-mcp.git
cd neo-n3-mcp
docker build -t r3e/neo-n3-mcp:custom .
```

## Local Development Deployment

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

Clone the repository:

```bash
git clone https://github.com/CityOfZion/neo-n3-mcp.git
cd neo-n3-mcp
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Start in development mode:

```bash
npm run dev
```

Or start in production mode:

```bash
npm start
```

## Configuration Reference

### Neo N3 Node Configuration

| Environment Variable | Command-line Argument | Description | Default |
|----------------------|----------------------|-------------|---------|
| `NEO_RPC_URL` | `--rpc-url` | Default URL of the Neo N3 RPC node | `http://localhost:10332` |
| `NEO_MAINNET_RPC_URL` | `--mainnet-rpc-url` | URL of the Neo N3 mainnet RPC node | Same as `NEO_RPC_URL` or `http://seed1.neo.org:10332` |
| `NEO_TESTNET_RPC_URL` | `--testnet-rpc-url` | URL of the Neo N3 testnet RPC node | `https://testnet1.neo.coz.io:443` |
| `NEO_NETWORK` | `--network` | Default network type (mainnet, testnet) | `mainnet` |

### Server Configuration

| Environment Variable | Command-line Argument | Description | Default |
|----------------------|----------------------|-------------|---------|
| `PORT` | `--port` | Port to listen on | `3000` |
| `HOST` | `--host` | Host to bind to | `0.0.0.0` |

### Wallet Configuration

| Environment Variable | Command-line Argument | Description | Default |
|----------------------|----------------------|-------------|---------|
| `WALLET_PATH` | `--wallet-path` | Path to wallet files | `./wallets` |

### Security Configuration

| Environment Variable | Command-line Argument | Description | Default |
|----------------------|----------------------|-------------|---------|
| `MAX_REQUESTS_PER_MINUTE` | `--max-requests` | Rate limit (requests per minute) | `60` |
| `REQUIRE_CONFIRMATION` | `--require-confirmation` | Require confirmation for sensitive operations | `true` |

### Logging Configuration

| Environment Variable | Command-line Argument | Description | Default |
|----------------------|----------------------|-------------|---------|
| `LOG_LEVEL` | `--log-level` | Log level (debug, info, warn, error) | `info` |
| `LOG_CONSOLE` | `--log-console` | Whether to log to console | `true` |
| `LOG_FILE` | `--log-file` | Whether to log to file | `false` |
| `LOG_FILE_PATH` | `--log-file-path` | Path to log file | `./logs/neo-n3-mcp.log` |

## Health Checks and Monitoring

### Health Check Endpoint

The server provides a health check endpoint at `/health` that returns the server status:

```bash
curl http://localhost:3000/health
```

Example response:

```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "nodeConnection": true,
  "nodeHeight": 12345
}
```

### Metrics (Prometheus)

The server can expose Prometheus metrics at `/metrics`. To enable this:

```bash
export ENABLE_METRICS=true
```

This will expose metrics like:

- Request count by endpoint
- Request duration
- Error count
- System metrics (CPU, memory)

## Security Considerations

### Network Security

- Use HTTPS for production deployments
- Consider setting up a reverse proxy (like Nginx) for SSL termination
- Implement IP-based access control for sensitive operations

### Authentication and Authorization

- Consider deploying behind an API gateway for authentication
- Use API keys for programmatic access
- Implement role-based access control for sensitive operations

### Sensitive Data Handling

- Ensure wallet files are properly secured
- Never expose private keys in logs or responses
- Consider using a secure storage solution for wallet files

## Troubleshooting

### Common Issues

#### Connection to Neo N3 Node Fails

Check if:
- The RPC URL is correct and accessible
- The Neo N3 node is running and synced
- There are no network issues or firewalls blocking access

#### Server Crashes on Startup

Check if:
- All required dependencies are installed
- The configuration is valid
- There are no file permission issues

#### Rate Limiting Issues

Check if:
- The `MAX_REQUESTS_PER_MINUTE` is set appropriately
- There are no abusive clients or DoS attacks

### Logging

Enable debug logging for more information:

```bash
export LOG_LEVEL=debug
```

Or check the log file:

```bash
tail -f ./logs/neo-n3-mcp.log
```

## Upgrading

### NPM Package

Update to the latest version:

```bash
npm update -g @r3e/neo-n3-mcp
```

Or to a specific version:

```bash
npm install -g @r3e/neo-n3-mcp@1.0.0
```

### Docker Container

Pull the latest image:

```bash
docker pull r3e/neo-n3-mcp:latest
```

Stop and remove the old container:

```bash
docker stop neo-n3-mcp
docker rm neo-n3-mcp
```

Start a new container with the latest image:

```bash
docker run -p 3000:3000 r3e/neo-n3-mcp:latest
```

### Docker Compose

Update the image version in your `docker-compose.yml` file and run:

```bash
docker-compose pull
docker-compose up -d
```

## Backup and Restore

### Backing Up Wallet Files

Regularly backup your wallet files:

```bash
# For local installation
cp -r ./wallets ./wallets-backup-$(date +%Y%m%d)

# For Docker
docker cp neo-n3-mcp:/app/wallets ./wallets-backup-$(date +%Y%m%d)
```

### Restoring from Backup

```bash
# For local installation
cp -r ./wallets-backup-20230101/* ./wallets/

# For Docker
docker cp ./wallets-backup-20230101/* neo-n3-mcp:/app/wallets/
``` 