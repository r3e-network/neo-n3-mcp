[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/r3e-network-neo-n3-mcp-badge.png)](https://mseep.ai/app/r3e-network-neo-n3-mcp)

# Neo N3 MCP Server

`@r3e/neo-n3-mcp` is an MCP server for Neo N3 blockchain queries and controlled, auditable transaction submission. It ships three entrypoints:

| Entrypoint | Command | Protocol |
| --- | --- | --- |
| MCP stdio | `npm start` | MCP over stdin/stdout, for local clients such as Claude Desktop and Cursor |
| MCP Streamable HTTP | `npm run start:mcp-http` | MCP over HTTP, for remote MCP clients |
| REST API | `npm run start:http` | Bespoke REST/JSON; not an MCP transport |

The two HTTP servers are unrelated and configured separately. See [Remote MCP over Streamable HTTP](#remote-mcp-over-streamable-http) and [docs/remote-mcp-transport.md](./docs/remote-mcp-transport.md).

Current version: `3.1.0`. Node.js `>=22` is required.

## Quick Start

Install and run the MCP stdio server:

```bash
npm install -g @r3e/neo-n3-mcp
neo-n3-mcp
```

Or run it without a global install:

```bash
npx -y @r3e/neo-n3-mcp
```

Example Claude Desktop or Cursor configuration:

```json
{
  "mcpServers": {
    "neo-n3": {
      "command": "npx",
      "args": ["-y", "@r3e/neo-n3-mcp"],
      "env": {
        "NEO_NETWORK": "testnet",
        "NEO_TESTNET_RPC": "https://testnet1.neo.coz.io:443",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Programmatic API

The package root exports the MCP server, HTTP server, services, network enums, and validated configuration:

```ts
import { NeoNetwork, NeoService } from '@r3e/neo-n3-mcp';

const neo = new NeoService(
  'https://testnet1.neo.coz.io:443',
  NeoNetwork.TESTNET,
);

const blockCount = await neo.getBlockCount();
console.log({ blockCount, height: Math.max(0, blockCount - 1) });
```

`NeoN3McpServer` exposes `run()` and `close()` for applications that manage the stdio transport lifecycle themselves.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEO_NETWORK` | `mainnet`, `testnet`, or `both`; HTTP requires one network | `both` |
| `NEO_MAINNET_RPC` | Mainnet RPC endpoint | `https://mainnet1.neo.coz.io:443` |
| `NEO_TESTNET_RPC` | Testnet RPC endpoint | `https://testnet1.neo.coz.io:443` |
| `NEO_RPC_TIMEOUT_MS` | Per-operation Neo RPC deadline in milliseconds | `15000` |
| `NEO_ALLOW_INSECURE_RPC` | Allow a remote plaintext HTTP RPC URL | `false` |
| `NEO_MAX_TRANSACTION_FEE_GAS` | Maximum combined system and network fee for a signed transaction, in GAS | `20` |
| `NEO_ENABLE_WRITES` | Register state-changing tools and HTTP routes | `false` |
| `NEO_SIGNER_WIF_FILE` | Owner-only regular file containing the single server signer WIF | required for writes |
| `NEO_WRITE_STATE_DIR` | Durable idempotency journal directory | `$WALLETS_DIR/.write-operations` |
| `HTTP_WRITE_APPROVAL_API_KEY` | Independent bearer token for HTTP write approval | required for writes |
| `NEO_ENABLE_WALLET_ADMIN` | Enable HTTP wallet create/import administration | `false` |
| `N3INDEX_API_BASE_URL` | Remote contract name lookup base URL | `https://api.n3index.dev` |
| `N3INDEX_ENABLED` | Enable N3Index-backed name resolution | `true` |
| `HTTP_HOST` | REST API listen address | `127.0.0.1` |
| `HTTP_API_KEY` | Bearer token for REST API routes | unset |
| `HTTP_CORS_ORIGINS` | Comma-separated exact HTTP/HTTPS origins | empty |
| `HTTP_MAX_BODY_BYTES` | Maximum HTTP request body size | `1048576` (1 MiB) |
| `MCP_HTTP_PORT` | Remote MCP transport listen port | `3001` |
| `MCP_HTTP_HOST` | Remote MCP transport listen address | `127.0.0.1` |
| `MCP_HTTP_PATH` | Remote MCP endpoint path | `/mcp` |
| `MCP_HTTP_BEARER` | Bearer token for the remote MCP endpoint; required unless `MCP_HTTP_HOST` is loopback | unset |
| `MCP_HTTP_ALLOWED_ORIGINS` | Comma-separated exact origins allowed to connect from a browser | empty |
| `MCP_HTTP_MAX_SESSIONS` | Concurrent remote MCP session cap | `128` |
| `MCP_HTTP_SESSION_TTL_MS` | Idle remote MCP session expiry | `1800000` (30 minutes) |
| `WALLETS_DIR` | Directory for persisted encrypted wallet records | `./wallets` |
| `RATE_LIMITING_ENABLED` | Enable request rate limiting | enabled outside test environments |
| `MAX_REQUESTS_PER_MINUTE` | Per-client minute limit | `60` |
| `MAX_REQUESTS_PER_HOUR` | Per-client hour limit | `1000` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error` | `info` |
| `LOG_CONSOLE` | Enable console logging | enabled outside test environments |
| `LOG_FILE` | Log file path; setting it enables file logging | `./logs/neo-n3-mcp.log` |
| `LOG_FILE_ENABLED` | Enable file logging without setting `LOG_FILE` | `false` |
| `PORT` | HTTP listen port | `3000` |

The aliases `NEO_MAINNET_RPC_URL`, `NEO_TESTNET_RPC_URL`, and `NEO_NETWORK_MODE` remain supported.

Remote RPC endpoints must use HTTPS. Plain HTTP is accepted for loopback RPC endpoints; setting `NEO_ALLOW_INSECURE_RPC=true` explicitly permits remote plaintext HTTP and should be limited to controlled development environments.

When `NEO_NETWORK=both`, read-only MCP calls without an explicit network use mainnet. Every state-changing call requires an explicit network and an idempotency key. The HTTP entrypoint rejects `both`; set `NEO_NETWORK=mainnet` or `NEO_NETWORK=testnet`.

Writes are disabled by default. To enable them, create an owner-only signer file outside the repository and configure durable state:

```bash
install -m 0600 /dev/stdin /run/secrets/neo-signer-wif
export NEO_ENABLE_WRITES=true
export NEO_SIGNER_WIF_FILE=/run/secrets/neo-signer-wif
export NEO_WRITE_STATE_DIR=/var/lib/neo-n3-mcp/write-operations
export HTTP_WRITE_APPROVAL_API_KEY="$(openssl rand -hex 32)"
```

The MCP and HTTP request schemas never accept WIFs, private keys, or passwords. MCP writes require form elicitation and exact fingerprint approval. HTTP writes return a pending intent and require a separate approval request authenticated by `HTTP_WRITE_APPROVAL_API_KEY`.

## HTTP API

This is a bespoke REST/JSON API, not an MCP transport. MCP clients cannot connect to it; they use the stdio entrypoint or the [remote MCP transport](#remote-mcp-over-streamable-http).

Build and start the HTTP entrypoint:

```bash
npm ci
npm run build
export HTTP_API_KEY="$(openssl rand -hex 32)"
NEO_NETWORK=mainnet npm run start:http
```

The server listens on `127.0.0.1:3000` by default. A non-loopback `HTTP_HOST` requires `HTTP_API_KEY`, and every configured API key must contain at least 32 bytes. When a key is configured, send it as a bearer token on every route except `GET /live` and `GET /health`:

```bash
curl http://127.0.0.1:3000/live
curl http://127.0.0.1:3000/health
curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/api/blockchain/height
```

The HTTP listener does not terminate TLS. Plaintext HTTP is supported only on loopback or a trusted host-local proxy network. Remote clients must use HTTPS through a TLS-terminating reverse proxy or load balancer; direct remote plaintext HTTP is unsupported because bearer tokens traverse requests.

The height endpoint distinguishes the node's block count from the latest block index:

```json
{
  "blockCount": 12346,
  "height": 12345
}
```

`HTTP_CORS_ORIGINS` is an optional exact-origin allowlist. For example:

```bash
HTTP_CORS_ORIGINS=https://console.example.com,https://admin.example.com
```

Origins must use HTTP or HTTPS and cannot contain paths, credentials, query strings, or fragments. Wildcard CORS is not supported.

POST and PUT bodies must be JSON objects. The default body limit is 1 MiB and can be changed with `HTTP_MAX_BODY_BYTES`. A write request creates an immutable pending intent:

```bash
curl -X POST http://127.0.0.1:3000/api/transfers \
  -H "Authorization: Bearer $HTTP_API_KEY" \
  -H "Idempotency-Key: transfer-2026-07-11-001" \
  -H 'Content-Type: application/json' \
  -d '{"network":"mainnet","toAddress":"Nb...","asset":"NEO","amount":"1"}'
```

Approve only after comparing the returned fingerprint with the intended request:

```bash
curl -X POST http://127.0.0.1:3000/api/write-intents/INTENT_ID/approve \
  -H "Authorization: Bearer $HTTP_WRITE_APPROVAL_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"fingerprint":"RETURNED_64_HEX_FINGERPRINT"}'
```

See [API.md](./docs/API.md) for the tool and route reference.

## Remote MCP over Streamable HTTP

The Streamable HTTP transport serves the same MCP tools as the stdio entrypoint to remote MCP clients. It is a separate process from the REST API above, listens on its own port, and has its own configuration and bearer token.

```bash
npm ci
npm run build
export MCP_HTTP_BEARER="$(openssl rand -hex 32)"
NEO_NETWORK=mainnet npm run start:mcp-http
```

The server listens on `127.0.0.1:3001` by default and exposes:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `MCP_HTTP_PATH` (default `/mcp`) | JSON-RPC messages: `initialize`, `tools/list`, `tools/call` |
| `GET` | `MCP_HTTP_PATH` | Server-Sent Events stream for server-initiated messages |
| `DELETE` | `MCP_HTTP_PATH` | Terminates the session named by `Mcp-Session-Id` |
| `GET` | `/healthz` | Unauthenticated liveness probe |

A non-loopback `MCP_HTTP_HOST` requires `MCP_HTTP_BEARER` and rejects a token shorter than 32 bytes, mirroring the `HTTP_API_KEY` rule for the REST entrypoint. When a token is configured, clients send `Authorization: Bearer <token>` on every request to `MCP_HTTP_PATH`; `/healthz` stays unauthenticated so probes can reach it.

Connect with the MCP TypeScript SDK:

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3001/mcp'), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_HTTP_BEARER}` } },
});
const client = new Client({ name: 'my-client', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);
const { tools } = await client.listTools();
```

Like the REST listener, this listener serves plaintext HTTP and does not terminate TLS. Remote clients must reach it through a TLS-terminating reverse proxy. Sessions are held in memory, so a multi-replica deployment needs sticky routing on the `Mcp-Session-Id` header.

See [remote-mcp-transport.md](./docs/remote-mcp-transport.md) for the full configuration reference, an end-to-end local run against the Neo Explorer agent, production deployment guidance, and troubleshooting.

## Docker

The production Compose file is `docker/docker-compose.yml`. It defines two services from the same image: `neo-mcp` runs the REST API on port 3000, and `neo-mcp-http` runs the remote MCP transport on port 3001. Each requires its own token, binds the host port to `127.0.0.1` by default, and persists wallet records in its own volume:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"
export MCP_HTTP_BEARER="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up -d
```

Start only the remote MCP service. Compose interpolates the whole file before
selecting a service, so the REST service's mandatory `HTTP_API_KEY` must be set
to any non-empty placeholder even though its container is never started here
(the ">= 32 bytes" check only runs when that container actually starts):

```bash
HTTP_API_KEY=unused-when-starting-only-the-mcp-service \
MCP_HTTP_BEARER="$(openssl rand -hex 32)" \
  docker compose -f docker/docker-compose.yml up -d neo-mcp-http
```

To run a published image instead of building the checkout, use the digest-only registry overlay with the image repository and the release artifact's 64-character lowercase hexadecimal digest:

```bash
NEO_MCP_IMAGE_REPOSITORY=r3enetwork/neo-n3-mcp \
NEO_MCP_IMAGE_DIGEST=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
HTTP_API_KEY="$HTTP_API_KEY" \
MCP_HTTP_BEARER="$MCP_HTTP_BEARER" \
  docker compose -f docker/docker-compose.yml \
    -f docker/docker-compose.registry.yml up -d
```

Set `HTTP_BIND_ADDRESS=0.0.0.0` (REST) or `MCP_HTTP_BIND_ADDRESS=0.0.0.0` (remote MCP) only when the service must be reachable by a TLS-terminating reverse proxy or load balancer. Do not expose either plaintext listener directly to remote clients.

The development Compose file binds locally and supplies local-development tokens by default. It defines `neo-mcp-dev` for the REST API and `neo-mcp-http-dev` for the remote MCP transport:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Those default tokens are for local development only. Override `HTTP_API_KEY` and `MCP_HTTP_BEARER` for any shared environment.

Build and run without Compose:

```bash
npm run docker:build
export HTTP_API_KEY="$(openssl rand -hex 32)"
npm run docker:run -- --detach
```

See [DOCKER.md](./docs/DOCKER.md) for image, volume, and helper-script details.

## MCP Tools and Resources

The default MCP surface exposes 19 read-only tools. Enabling writes adds four tools, for 23 total:

- Network: `get_network_mode`
- Blockchain: `get_blockchain_info`, `get_block_count`, `get_block`, `get_transaction`, `get_application_log`, `wait_for_transaction`
- Wallet metadata: `get_wallet`
- Assets: `get_balance`, `get_unclaimed_gas`, `get_nep17_transfers`, `get_nep11_balances`, `get_nep11_transfers`, `estimate_transfer_fees`
- Contracts: `invoke_contract`, `list_famous_contracts`, `get_contract_info`, `get_contract_status`, `estimate_invoke_fees`
- Enabled writes: `transfer_assets`, `invoke_contract_write`, `claim_gas`, `deploy_contract`

The curated contract list is intentionally empty until each entry has a current network hash and a verified on-chain manifest. Generic contract tools accept a script hash, Neo address, exact N3Index name, or a name learned from a live manifest.

`estimate_transfer_fees` and `estimate_invoke_fees` return exact integer decimal strings in `networkFeeDatos` and `systemFeeDatos`, plus formatted GAS strings in `networkFeeGas` and `systemFeeGas`. Before any transaction is signed or broadcast, the combined system and network fee must not exceed `NEO_MAX_TRANSACTION_FEE_GAS`.

`deploy_contract` accepts compiler output as a complete serialized NEF object, `nef: { encoding: "hex" | "base64", data: string }`, together with its manifest. Raw VM bytecode is not a deployable NEF artifact.

`get_block_count` returns both `blockCount` and `height`, where `height` is `max(0, blockCount - 1)`.

Resources:

- `neo://network/status`
- `neo://mainnet/status`
- `neo://testnet/status`
- `neo://block/{height}`

## Security Notes

- Keep both HTTP listeners bound to loopback unless remote access is required.
- Terminate TLS before every remote HTTP connection; a bearer token authenticates requests but does not encrypt itself in transit.
- Use a randomly generated token of at least 32 bytes for `HTTP_API_KEY` and `MCP_HTTP_BEARER`.
- Keep `NEO_ENABLE_WRITES=false` on any remotely reachable MCP listener; the remote transport exists to serve read-only queries.
- Keep the signer WIF only in the owner-only `NEO_SIGNER_WIF_FILE`; never send it through MCP or HTTP.
- Persist `WALLETS_DIR` on controlled storage with restrictive permissions.
- State-changing MCP tools require an explicit `network`, a stable idempotency key, and exact form-elicited approval.
- Remote plaintext HTTP RPC endpoints are rejected unless `NEO_ALLOW_INSECURE_RPC=true`; prefer HTTPS.
- Signed transactions are rejected when their combined system and network fees exceed `NEO_MAX_TRANSACTION_FEE_GAS`.
- Rate limiting is enabled by default outside test-like environments.

## Testing

```bash
# Deterministic unit tests; excludes tests/mcp-*.test.ts
npm run test:unit

# Compile, then run deterministic built-server smoke and lifecycle checks
npm run build
npm run test:mcp

# Unit tests + build + deterministic MCP checks
npm run test:all

# Opt-in public RPC checks; requires a build and network access
npm run build
npm run test:mcp:live

# Explicit stress suite; requires a build
npm run test:mcp:stress
```

`npm run test:integration` is an additional built-server integration script that calls public RPC endpoints; it is not part of `test:all`.

## Release and Dependency Checks

`npm audit` and `npm audit --omit=dev` are expected to pass. The package uses a scoped `lodash@4.18.1` override for the transitive `@cityofzion/neon-core` dependency.

`./scripts/prepare-release.sh` installs the lockfile, runs type checking, deterministic tests, the build, both audits, package validation, Compose validation, and container builds. It updates the version only after verification and does not create a commit or tag.

GitHub Actions tests Node.js 22 and 24. Published GitHub releases can publish the npm package and Docker image when the required repository secrets are configured; no production deployment target is defined in this repository.

## Documentation

- [API reference](./docs/API.md)
- [Remote MCP transport](./docs/remote-mcp-transport.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [Docker guide](./docs/DOCKER.md)
- [Testing guide](./docs/TESTING.md)
- [Production checklist](./docs/PRODUCTION_CHECKLIST.md)
- [Version management](./docs/VERSION_MANAGEMENT.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Networks](./docs/NETWORKS.md)
- [Changelog](./docs/CHANGELOG.md)

## Troubleshooting

- Installation failures: verify `node --version` reports Node.js 22 or newer, then retry `npm ci` or the package install.
- `HTTP_API_KEY is required`: the HTTP process is listening on a non-loopback host. Set a key containing at least 32 bytes or bind `HTTP_HOST` to a loopback address.
- HTTP `401`: send `Authorization: Bearer <HTTP_API_KEY>` on all routes except `/live` and `/health`.
- HTTP `413`: reduce the request size or increase `HTTP_MAX_BODY_BYTES` to a positive integer.
- Remote MCP `401`: send `Authorization: Bearer <MCP_HTTP_BEARER>`; `/healthz` is the only unauthenticated route.
- Remote MCP `404` after a successful `initialize`: the session expired, was evicted, or a proxy stripped the `Mcp-Session-Id` header. See [remote-mcp-transport.md](./docs/remote-mcp-transport.md#troubleshooting).
- RPC errors: verify the selected RPC URL is reachable and supports the requested Neo RPC method.

## License

MIT. See [LICENSE](./LICENSE).
