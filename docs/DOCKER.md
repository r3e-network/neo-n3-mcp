# Docker Guide

This project ships Docker assets for the **HTTP mode** of the Neo N3 MCP server.

## Quick Start

### Production image

```bash
npm run docker:build
npm run docker:run
```

### Development image

```bash
npm run docker:build:dev
npm run docker:up:dev
```

## Direct `docker build`

```bash
docker build -f docker/Dockerfile -t r3enetwork/neo-n3-mcp:latest .
```

```bash
docker build -f docker/Dockerfile.dev -t r3enetwork/neo-n3-mcp:dev .
```

Use a dynamic release tag if you want the image tag to follow `package.json`:

```bash
./scripts/docker-build.sh --tag "v$(node -p \"require('./package.json').version\")" --registry r3enetwork
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEO_NETWORK` | Network mode: `mainnet`, `testnet`, or `both` | `both` |
| `NEO_MAINNET_RPC` | Mainnet RPC endpoint | `https://mainnet1.neo.coz.io:443` |
| `NEO_TESTNET_RPC` | Testnet RPC endpoint | `http://seed1t5.neo.org:20332` |
| `RATE_LIMITING_ENABLED` | Enable rate limiting | `true` |
| `MAX_REQUESTS_PER_MINUTE` | Per-minute limit | `60` |
| `MAX_REQUESTS_PER_HOUR` | Per-hour limit | `1000` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FILE` | Log file path | `/app/logs/neo-n3-mcp.log` |
| `LOG_CONSOLE` | Console logging | `true` |
| `PORT` | HTTP port inside the container | `3000` |

Backward-compatible aliases are also accepted by the runtime:
- `NEO_MAINNET_RPC_URL`
- `NEO_TESTNET_RPC_URL`
- `NEO_NETWORK_MODE`

## Compose

Production:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Development:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

## Health and Metrics

The container exposes:
- `GET /health`
- `GET /metrics`

Examples:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

## Notes

- `docker/Dockerfile` starts `dist/http.js`
- `docker/Dockerfile.dev` starts `npm run dev:http`
- Compose files mount logs and wallet storage as persistent volumes
