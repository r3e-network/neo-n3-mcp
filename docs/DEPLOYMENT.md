# Deployment Guide

This project can run in two modes:
- **MCP stdio mode** for Claude Desktop, Cursor, and other MCP clients
- **HTTP mode** for health checks, metrics, and REST-style automation

## Prerequisites

- Node.js 18+
- npm
- outbound access to your chosen Neo RPC endpoint(s)

## Environment Variables

Preferred variables:

```bash
NEO_NETWORK=both
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC=http://seed1t5.neo.org:20332
LOG_LEVEL=info
LOG_FILE=./logs/neo-n3-mcp.log
```

Backward-compatible aliases:
- `NEO_MAINNET_RPC_URL`
- `NEO_TESTNET_RPC_URL`
- `NEO_NETWORK_MODE`

## MCP Stdio Mode

```bash
npx @r3e/neo-n3-mcp
```

Example with explicit environment:

```bash
NEO_NETWORK=testnet \
NEO_TESTNET_RPC=http://seed1t5.neo.org:20332 \
LOG_LEVEL=info \
npx @r3e/neo-n3-mcp
```

## HTTP Mode

Build once, then start the HTTP entrypoint:

```bash
npm run build
NEO_NETWORK=mainnet npm run start:http
```

The HTTP server requires `NEO_NETWORK=mainnet` or `NEO_NETWORK=testnet`. It listens on port `3000` by default. Override it with `PORT`:

```bash
PORT=8080 NEO_NETWORK=testnet npm run start:http
```

## HTTP Endpoints

Operational endpoints:
- `GET /health`
- `GET /metrics`

Selected REST endpoints:
- `GET /api/blockchain/info`
- `GET /api/blockchain/height`
- `GET /api/blocks/:hashOrHeight`
- `GET /api/transactions/:txid`
- `GET /api/accounts/:address/balance`
- `GET /api/accounts/:address/unclaimed-gas`
- `GET /api/accounts/:address/nep17-transfers`
- `GET /api/accounts/:address/nep11-balances`
- `GET /api/accounts/:address/nep11-transfers`
- `POST /api/transfers`
- `POST /api/transfers/estimate-fees`
- `POST /api/accounts/claim-gas`
- `POST /api/wallets`
- `POST /api/wallets/import`
- `GET /api/wallets/:address`
- `GET /api/network/mode`
- `POST /api/contracts/invoke`
- `POST /api/contracts/invoke/estimate-fees`
- `POST /api/contracts/:contractName/invoke`

## Systemd Example

```ini
[Unit]
Description=Neo N3 MCP HTTP Server
After=network.target

[Service]
Type=simple
User=neo-mcp
Group=neo-mcp
WorkingDirectory=/opt/neo-n3-mcp
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEO_NETWORK=mainnet
Environment=NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
Environment=NEO_TESTNET_RPC=http://seed1t5.neo.org:20332
Environment=LOG_LEVEL=info
Environment=LOG_FILE=/var/log/neo-n3-mcp/server.log
ExecStart=/usr/bin/npm run start:http --prefix /opt/neo-n3-mcp
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/neo-n3-mcp

[Install]
WantedBy=multi-user.target
```

## Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

`/health` returns a JSON status payload and verifies that the configured RPC endpoint is reachable.

## Docker

For container deployment, see `docs/DOCKER.md`.
