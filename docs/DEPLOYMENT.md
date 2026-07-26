# Deployment Guide

Neo MCP supports two runtime modes:

- MCP stdio for local MCP clients such as Claude Desktop and Cursor
- HTTP for authenticated REST-style access, health checks, and metrics

## Prerequisites

- Node.js `>=22`
- npm
- Outbound access to the selected Neo RPC endpoint
- Controlled persistent storage when wallet records are enabled

## MCP Stdio

The stdio server supports `NEO_NETWORK=mainnet`, `testnet`, or `both`:

```bash
NEO_NETWORK=testnet \
NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443 \
npx -y @r3e/neo-mcp
```

Read-only calls without an explicit network use mainnet when `NEO_NETWORK=both`. Tools that both chains implement require an explicit `chain`, `n3` or `neox`; there is no default. Every state-changing MCP call requires an explicit `network`, an `idempotencyKey`, and approval of the exact intent fingerprint, including when only one network is enabled.

## HTTP Deployment

The HTTP entrypoint requires one network and binds to `127.0.0.1:3000` by default:

```bash
npm ci
npm run build
export HTTP_API_KEY="$(openssl rand -hex 32)"
NEO_NETWORK=mainnet npm run start:http
```

Key security rules:

- `HTTP_HOST` defaults to `127.0.0.1`.
- A non-loopback `HTTP_HOST` requires `HTTP_API_KEY`.
- Any configured key must contain at least 32 bytes.
- The built-in listener serves plaintext HTTP and does not terminate TLS.
- Remote clients must use HTTPS through a TLS-terminating reverse proxy or load balancer.
- Bearer authentication protects every route except `GET /live` and `GET /health` when a key is configured.
- POST and PUT bodies must be JSON objects and default to a 1 MiB limit.
- Write requests accept only the JSON boolean `true` for `confirm`; the string `"true"` is not confirmation.

Direct remote plaintext HTTP is unsupported. Bearer tokens and WIFs traverse request connections, so keep the backend HTTP hop on loopback or a trusted host-local proxy network. An API key provides authentication, not transport encryption.

Example requests:

```bash
curl http://127.0.0.1:3000/live
curl http://127.0.0.1:3000/health

curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/metrics

curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/api/blockchain/height
```

`GET /api/blockchain/height` returns the RPC block count and the latest block index:

```json
{
  "blockCount": 12346,
  "height": 12345
}
```

## HTTP Configuration

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NEO_NETWORK` | Yes for HTTP | `both` | Set `mainnet` or `testnet` |
| `NEO_MAINNET_RPC` | No | `https://mainnet1.neo.coz.io:443` | Mainnet RPC URL |
| `NEO_TESTNET_RPC` | No | `https://testnet1.neo.coz.io:443` | Testnet RPC URL |
| `NEOX_MAINNET_RPC_URLS` | No | Banelabs mainnet endpoints | Comma-separated Neo X mainnet JSON-RPC URLs |
| `NEOX_TESTNET_RPC_URLS` | No | Banelabs and NGD testnet endpoints | Comma-separated Neo X testnet JSON-RPC URLs |
| `NEOX_MAINNET_EXPLORER_API_BASE_URL` | No | `https://xexplorer.neo.org` | Blockscout base URL for Neo X mainnet analytics |
| `NEOX_TESTNET_EXPLORER_API_BASE_URL` | No | `https://xt4scan.ngd.network` | Blockscout base URL for Neo X testnet |
| `NEOX_TESTNET_ENABLED` | No | `true` | Set `false` to serve Neo X mainnet only |
| `NEOX_GRAPHQL_ENABLED` | No | `false` | Registers `query_explorer_graphql` when `true` |
| `NEO_RPC_TIMEOUT_MS` | No | `15000` | Positive per-operation RPC deadline in milliseconds |
| `NEO_ALLOW_INSECURE_RPC` | No | `false` | Permit remote plaintext HTTP RPC URLs; use only in controlled environments |
| `NEO_MAX_TRANSACTION_FEE_GAS` | No | `20` | Maximum combined system and network fee per signed transaction, in GAS |
| `HTTP_HOST` | No | `127.0.0.1` | Non-loopback values require an API key |
| `PORT` | No | `3000` | Valid range is 0-65535 for direct process startup |
| `HTTP_API_KEY` | Conditional | unset | Required off loopback; minimum 32 bytes |
| `HTTP_CORS_ORIGINS` | No | empty | Comma-separated exact HTTP/HTTPS origins |
| `HTTP_MAX_BODY_BYTES` | No | `1048576` | Positive integer request-body limit |
| `WALLETS_DIR` | No | `./wallets` | Wallet record directory |
| `RATE_LIMITING_ENABLED` | No | `true` | Disabled automatically in test-like environments |
| `MAX_REQUESTS_PER_MINUTE` | No | `60` | Positive integer |
| `MAX_REQUESTS_PER_HOUR` | No | `1000` | Positive integer |

The aliases `NEO_MAINNET_RPC_URL`, `NEO_TESTNET_RPC_URL`, and `NEO_NETWORK_MODE` remain supported.

RPC URLs must use HTTPS unless they target a loopback host. A remote plaintext HTTP endpoint is rejected unless `NEO_ALLOW_INSECURE_RPC=true`; the override disables transport protection and is not recommended for production. `NEO_MAX_TRANSACTION_FEE_GAS` must be a positive GAS amount with at most eight decimal places. Transactions whose combined system and network fees exceed the cap are rejected before signing or broadcast.

`HTTP_CORS_ORIGINS` does not enable wildcard CORS. Each entry must be an exact HTTP or HTTPS origin without credentials, a path, query parameters, or a fragment:

```bash
HTTP_CORS_ORIGINS=https://console.example.com,https://admin.example.com
```

## Production Compose

Use the checked-in production definition:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up -d
```

For a published image, replace the example digest with the release artifact's 64-character lowercase hexadecimal digest:

```bash
NEO_MCP_IMAGE_REPOSITORY=r3enetwork/neo-mcp \
NEO_MCP_IMAGE_DIGEST=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
HTTP_API_KEY="$HTTP_API_KEY" \
  docker compose -f docker/docker-compose.yml \
    -f docker/docker-compose.registry.yml up -d
```

It:

- requires `HTTP_API_KEY` during Compose interpolation
- builds the checked-out source as `neo-mcp:local` by default instead of pulling a mutable tag
- listens inside the container on `0.0.0.0:3000`
- publishes the host port on `127.0.0.1` by default
- provides `docker-compose.registry.yml`, an image-only overlay that requires `NEO_MCP_IMAGE_REPOSITORY` and a 64-character lowercase hexadecimal `NEO_MCP_IMAGE_DIGEST`, constructs an immutable digest reference, and cannot fall back to a local build
- persists `/app/wallets` in the `neo-mcp-wallets` named volume
- runs with a read-only root filesystem, no Linux capabilities, no privilege escalation, and a bounded `/tmp` tmpfs
- defaults to 1 CPU, 512 MiB of memory, 256 processes, and a 30-second shutdown grace period
- rotates Docker JSON logs at 10 MiB with three files retained

Override `HTTP_BIND_ADDRESS` only when a TLS-terminating proxy or load balancer must reach the container:

```bash
HTTP_BIND_ADDRESS=0.0.0.0 \
HTTP_API_KEY="$HTTP_API_KEY" \
docker compose -f docker/docker-compose.yml up -d
```

Restrict the published port to that proxy. Do not route remote clients directly to the plaintext container listener.

See the [Docker guide](./DOCKER.md) for image and development workflow details.

## Systemd Example

Keep secrets in a root-readable environment file rather than in the unit itself. Example `/etc/neo-mcp.env`:

```bash
NEO_NETWORK=mainnet
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
HTTP_HOST=127.0.0.1
HTTP_API_KEY=replace-with-at-least-32-random-bytes
PORT=3000
WALLETS_DIR=/var/lib/neo-mcp/wallets
LOG_LEVEL=info
LOG_FILE=/var/log/neo-mcp/server.log
LOG_CONSOLE=false
```

Example unit:

```ini
[Unit]
Description=Neo MCP HTTP Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=neo-mcp
Group=neo-mcp
WorkingDirectory=/opt/neo-mcp
Environment=NODE_ENV=production
EnvironmentFile=/etc/neo-mcp.env
ExecStart=/usr/bin/npm run start:http --prefix /opt/neo-mcp
Restart=on-failure
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/neo-mcp /var/log/neo-mcp

[Install]
WantedBy=multi-user.target
```

Create the writable directories and restrict the environment file before starting the unit:

```bash
sudo install -d -o neo-mcp -g neo-mcp -m 0700 /var/lib/neo-mcp/wallets
sudo install -d -o neo-mcp -g neo-mcp -m 0750 /var/log/neo-mcp
sudo chmod 0600 /etc/neo-mcp.env
sudo systemctl enable --now neo-mcp
```

## Health and Operations

`GET /live` is the unauthenticated process liveness route used by the container health check. It does not call Neo RPC.

`GET /health` is the unauthenticated readiness route. It returns `200` when the configured RPC endpoint responds and `503` otherwise.

`GET /metrics` is bearer-protected when `HTTP_API_KEY` is set. It exposes process uptime, the selected network marker, and the latest observed block height. The repository does not define a monitoring backend, dashboard, alerting policy, or automated production deployment.

For a release rollback, redeploy the last known-good npm or container version and verify `/health` plus one authenticated read-only route before restoring traffic.
