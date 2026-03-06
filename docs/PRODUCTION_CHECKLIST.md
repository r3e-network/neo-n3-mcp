# Production Checklist

Use this checklist before shipping `@r3e/neo-n3-mcp` into production.

## Configuration

- [ ] Set `NEO_NETWORK` explicitly; use `mainnet` or `testnet` for HTTP deployments
- [ ] Configure stable RPC endpoints for every enabled network
- [ ] Set `LOG_LEVEL` and `LOG_FILE`
- [ ] Keep `LOG_CONSOLE=false` for long-running HTTP deployments
- [ ] Enable rate limiting for public HTTP deployments

Recommended baseline:

```bash
NEO_NETWORK=mainnet
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC=http://seed1t5.neo.org:20332
RATE_LIMITING_ENABLED=true
MAX_REQUESTS_PER_MINUTE=60
MAX_REQUESTS_PER_HOUR=1000
LOG_LEVEL=info
LOG_FILE=/var/log/neo-n3-mcp/server.log
LOG_CONSOLE=false
PORT=3000
```

Backward-compatible aliases accepted by the runtime:
- `NEO_MAINNET_RPC_URL`
- `NEO_TESTNET_RPC_URL`
- `NEO_NETWORK_MODE`

## Validation

- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Run `npm test`
- [ ] Run `npm run test:mcp`
- [ ] Run `npm run test:integration`
- [ ] Verify `/health` and `/metrics` in HTTP mode
- [ ] Verify one read-only testnet workflow against the intended RPC node

## Deployment

- [ ] Run stdio mode only behind an MCP client
- [ ] Run HTTP mode with `npm run start:http` for REST/monitoring use cases
- [ ] Use a process supervisor such as systemd, Docker, or Kubernetes
- [ ] Persist logs and wallet storage to controlled volumes
- [ ] Rotate logs

Example systemd service:

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

[Install]
WantedBy=multi-user.target
```

## Security

- [ ] Never log raw private keys or WIF values
- [ ] Require explicit confirmation for state-changing tools
- [ ] Keep secrets out of shell history and container image layers
- [ ] Restrict HTTP exposure with a reverse proxy, firewall, or private network
- [ ] Monitor RPC latency and failure rates

## Smoke Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

```bash
npm run test:integration
```
