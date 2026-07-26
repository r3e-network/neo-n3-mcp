# Docker Guide

The Docker assets run the Neo MCP HTTP entrypoint on Node.js 22 Alpine images.

## Production Compose

`docker/docker-compose.yml` is the production Compose definition:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up -d
```

Production defaults:

- `HTTP_API_KEY` is required and must contain at least 32 bytes.
- Compose builds the checked-out source as `neo-mcp:local`; it does not pull a mutable registry tag.
- The container listens on `0.0.0.0:3000`.
- The host publishes `127.0.0.1:3000`; set `HTTP_BIND_ADDRESS` or `PORT` to change the host-side binding.
- `/app/wallets` is persisted in the `neo-mcp-wallets` named volume.
- The root filesystem is read-only; only the wallet volume and the bounded `/tmp` tmpfs are writable.
- Linux capabilities are dropped, privilege escalation is disabled, and the service defaults to 1 CPU, 512 MiB of memory, and 256 processes.
- Graceful shutdown has 30 seconds to complete.
- Docker's `json-file` logs rotate at 10 MiB with three files retained.

Example custom host port:

```bash
PORT=8080 HTTP_API_KEY="$HTTP_API_KEY" \
  docker compose -f docker/docker-compose.yml up -d
```

The container listener is plaintext HTTP. Publish on all interfaces only when a TLS-terminating reverse proxy or load balancer must reach it:

```bash
HTTP_BIND_ADDRESS=0.0.0.0 HTTP_API_KEY="$HTTP_API_KEY" \
  docker compose -f docker/docker-compose.yml up -d
```

Restrict the published port to that proxy. Direct remote plaintext HTTP is unsupported because bearer tokens and transaction intent data traverse requests; an API key authenticates traffic but does not encrypt it.

Run a published image through the registry overlay with a repository and immutable digest. Replace the example digest with the release artifact's 64-character lowercase hexadecimal digest:

```bash
NEO_MCP_IMAGE_REPOSITORY=r3enetwork/neo-mcp \
NEO_MCP_IMAGE_DIGEST=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
HTTP_API_KEY="$HTTP_API_KEY" \
  docker compose -f docker/docker-compose.yml \
    -f docker/docker-compose.registry.yml up -d
```

The base definition always builds the checkout. The registry overlay removes that build configuration and requires both registry variables, so a missing digest or pull failure cannot fall back to unrelated local source. Mutable tags and combined image references are not accepted by this overlay. The Compose definition also interpolates `NEO_NETWORK`, both RPC URLs, RPC transport policy, the RPC timeout, the transaction fee cap, the HTTP body limit, rate limits, log settings, and CORS origins. Resource and shutdown defaults can be changed with `CPU_LIMIT`, `MEMORY_LIMIT`, `PIDS_LIMIT`, and `STOP_GRACE_PERIOD`.

## Development Compose

`docker/docker-compose.dev.yml` bind-mounts source and test files, listens only on loopback, and runs `npm run dev:http`:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

It provides `local-development-key-change-me-0001` when `HTTP_API_KEY` is unset. That key is for local development only. Override it for any shared workstation or environment:

```bash
HTTP_API_KEY="$(openssl rand -hex 32)" \
  docker compose -f docker/docker-compose.dev.yml up -d
```

Run deterministic unit tests in the development image:

```bash
npm run docker:test
```

## Build Images

```bash
docker build --file docker/Dockerfile --target production \
  --tag neo-mcp:latest .

docker build --file docker/Dockerfile.dev --target development \
  --tag neo-mcp:dev .
```

Equivalent helper commands:

```bash
npm run docker:build
npm run docker:build:dev
```

The build helper also supports custom names, tags, registries, and an optional push:

```bash
./scripts/docker-build.sh --name neo-mcp --tag 2.0.0 \
  --registry r3enetwork --push
```

## Run an Image Directly

The production image sets `HTTP_HOST=0.0.0.0`, so it will not start without an API key:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 256 \
  --memory 512m \
  --cpus 1 \
  --stop-timeout 30 \
  --publish 127.0.0.1:3000:3000 \
  --env NEO_NETWORK=mainnet \
  --env HTTP_API_KEY \
  --env WALLETS_DIR=/app/wallets \
  --volume neo-mcp-wallets:/app/wallets \
  neo-mcp:latest
```

The checked-in run helper supplies the same security and persistence defaults:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"
./scripts/docker-run.sh --detach
```

Writes are disabled in the production Compose definition. Enabling them requires an explicit signer secret and durable journal volume; never place a WIF in an environment variable or request. Follow the signer and approval setup in [README.md](../README.md#write-mode) and mount the signer as an owner-only secret file.

Use `--env-file FILE` for additional settings. The file must include `HTTP_API_KEY` because the container listens on a non-loopback address internally.

## Container Environment

| Variable | Production Compose value | Runtime default |
| --- | --- | --- |
| `NEO_NETWORK` | `mainnet` | `both` |
| `NEO_MAINNET_RPC` | `https://mainnet1.neo.coz.io:443` | same |
| `NEO_TESTNET_RPC` | `https://testnet1.neo.coz.io:443` | same |
| `NEO_RPC_TIMEOUT_MS` | `15000` | `15000` |
| `NEO_ALLOW_INSECURE_RPC` | `false` | `false` |
| `NEO_MAX_TRANSACTION_FEE_GAS` | `20` | `20` |
| `HTTP_HOST` | `0.0.0.0` | `127.0.0.1` |
| `HTTP_API_KEY` | required | unset |
| `NEO_ENABLE_WRITES` | `false` | `false` |
| `NEO_SIGNER_WIF_FILE` | unset | required only when writes are enabled |
| `NEO_WRITE_STATE_DIR` | unset | `$WALLETS_DIR/.write-operations` |
| `HTTP_WRITE_APPROVAL_API_KEY` | unset | required by HTTP writes, must differ from `HTTP_API_KEY` |
| `HTTP_CORS_ORIGINS` | empty | empty |
| `HTTP_MAX_BODY_BYTES` | `1048576` (1 MiB) | `1048576` (1 MiB) |
| `WALLETS_DIR` | `/app/wallets` | `./wallets` |
| `PORT` | `3000` | `3000` |
| `RATE_LIMITING_ENABLED` | `true` | `true` outside tests |
| `MAX_REQUESTS_PER_MINUTE` | `60` | `60` |
| `MAX_REQUESTS_PER_HOUR` | `1000` | `1000` |
| `LOG_LEVEL` | `info` | `info` |
| `LOG_CONSOLE` | `true` | enabled outside tests |

Remote RPC endpoints must use HTTPS. Plain HTTP is allowed for loopback endpoints, while `NEO_ALLOW_INSECURE_RPC=true` is an explicit opt-in for remote plaintext HTTP. The server rejects a transaction before signing or broadcast when its combined system and network fees exceed `NEO_MAX_TRANSACTION_FEE_GAS`.

## Health and Authentication

The image health check calls the unauthenticated endpoint:

```bash
curl http://127.0.0.1:3000/live
```

Every route except `/live` and `/health` requires the bearer token when `HTTP_API_KEY` is configured:

```bash
curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/metrics
```

Keep this HTTP connection on loopback or a trusted host-local proxy network. Remote clients must connect to a TLS terminator over HTTPS.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for CORS, body-size, systemd, and rollout guidance.
