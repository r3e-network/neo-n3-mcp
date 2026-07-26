# Remote MCP Transport (Streamable HTTP)

The Streamable HTTP transport exposes this package's MCP server over the network so a remote MCP client can call its tools. It speaks the same MCP protocol as the stdio entrypoint; only the transport changes.

## Three entrypoints, one package

This repository ships three processes that are easy to confuse. They are not interchangeable.

| Entrypoint | Command | Wire protocol | Listens on | Intended client |
| --- | --- | --- | --- | --- |
| MCP stdio | `npm start` (or `npx -y @r3e/neo-mcp`) | MCP JSON-RPC over stdin/stdout | nothing; the client spawns the process | A local MCP client on the same machine: Claude Desktop, Cursor, an IDE |
| MCP Streamable HTTP | `npm run start:mcp-http` | MCP JSON-RPC over HTTP, per the MCP Streamable HTTP transport | `MCP_HTTP_HOST:MCP_HTTP_PORT` (default `127.0.0.1:3001`) | A remote MCP client, such as the Neo Explorer agent |
| REST API | `npm run start:http` | Bespoke REST/JSON. **Not MCP.** | `HTTP_HOST:PORT` (default `127.0.0.1:3000`) | Dashboards, `curl`, service-to-service callers |

Consequences worth internalising:

- An MCP client cannot connect to the REST API. `src/http-server.ts` serves routes such as `GET /api/blockchain/height`; it has no `initialize` handshake, no JSON-RPC framing, and no session negotiation. Pointing `StreamableHTTPClientTransport` at port 3000 fails.
- `curl` cannot browse the MCP endpoint like a REST API. `GET /mcp` opens a Server-Sent Events stream for server-to-client messages; it does not return blockchain data. Every request/response exchange is a JSON-RPC POST.
- The two HTTP servers have completely separate configuration. `HTTP_API_KEY`, `HTTP_CORS_ORIGINS`, and `PORT` configure the REST API only. `MCP_HTTP_*` configures the MCP transport only. Setting one does not affect the other.
- Both HTTP servers can run at once on different ports. They share nothing but the Neo RPC configuration and the process-level logger settings.

The stdio entrypoint is unchanged by any of this. `npm start` behaves exactly as before.

## Endpoints

`MCP_HTTP_PATH` defaults to `/mcp`.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `MCP_HTTP_PATH` | Every JSON-RPC message the client sends: `initialize`, `tools/list`, `tools/call`, notifications | Bearer, when configured |
| `GET` | `MCP_HTTP_PATH` | Opens the Server-Sent Events stream for server-initiated messages | Bearer, when configured |
| `DELETE` | `MCP_HTTP_PATH` | Explicitly terminates the session identified by `Mcp-Session-Id` | Bearer, when configured |
| `GET` | `/healthz` | Liveness probe for orchestrators and the container healthcheck | None |

`/healthz` is deliberately unauthenticated so a Docker or Kubernetes probe can reach it without holding the bearer token. It reports process liveness only and exposes no blockchain or session data.

### Session lifecycle

The transport is stateful. The first `POST` carrying an `initialize` request creates a session; the response returns an `Mcp-Session-Id` header that the client echoes on every subsequent request. The SDK enforces the rules:

- A request with an unknown or expired session id gets `404 Not Found`. A well-behaved client reacts by re-initializing.
- A non-`initialize` request with no session id gets `400 Bad Request`.
- A `POST` whose `Accept` header does not list both `application/json` and `text/event-stream` gets `406 Not Acceptable`.
- A `POST` without `Content-Type: application/json` gets `415 Unsupported Media Type`.

Sessions are held in memory. See [Production deployment](#production-deployment) for what that means when you run more than one replica.

## Configuration

All variables are read at startup.

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `MCP_HTTP_PORT` | `3001` | No | TCP port for the MCP HTTP listener. |
| `MCP_HTTP_HOST` | `127.0.0.1` | No | Listen address. Keep it on loopback unless a reverse proxy on another interface must reach it. |
| `MCP_HTTP_PATH` | `/mcp` | No | Path serving `POST`, `GET`, and `DELETE`. Must begin with `/`. |
| `MCP_HTTP_BEARER` | unset | Yes, unless `MCP_HTTP_HOST` is a loopback address | Bearer token clients must send as `Authorization: Bearer <token>`. Mirrors the `HTTP_API_KEY` rule enforced by `resolveHttpSecurity` in `src/http.ts`: binding to a non-loopback address without a token is a startup error, not a warning. A token guarding a non-loopback listener must also contain at least 32 bytes, which is enforced at startup. |
| `MCP_HTTP_ALLOWED_ORIGINS` | empty | No | Comma-separated exact-origin allowlist for browser clients, for example `https://explorer.example.com`. Guards against DNS rebinding and cross-origin use. A request carrying **any** `Origin` header is rejected unless that origin is listed, so the empty default rejects every browser. Non-browser clients — including the explorer's serverless function — send no `Origin` header and are always allowed. |
| `MCP_HTTP_ALLOWED_HOSTS` | empty | No | Comma-separated `Host`-header allowlist (a second DNS-rebinding defense). Empty (the default) accepts any `Host`, which is correct behind a reverse proxy that forwards the public hostname. Set it only for a directly-exposed listener that should answer for specific hostnames. |
| `MCP_HTTP_MAX_SESSIONS` | `128` | No | Upper bound on concurrent sessions. At capacity a new `initialize` is answered with `503 Server session capacity reached`; existing sessions are never evicted to make room, so an established client is not disrupted by a burst of new ones. |
| `MCP_HTTP_SESSION_TTL_MS` | `1800000` (30 minutes) | No | Idle session expiry. An expired session id yields `404`, and the client must re-initialize. |

The MCP HTTP process also honours the shared configuration documented in the [README configuration table](../README.md#configuration): `NEO_NETWORK`, `NEO_MAINNET_RPC`, `NEO_TESTNET_RPC`, `NEO_RPC_TIMEOUT_MS`, `LOG_LEVEL`, `LOG_CONSOLE`, and the rest. Unlike the REST entrypoint, it accepts `NEO_NETWORK=both`.

`NEO_ENABLE_WRITES` should stay `false` for a remotely reachable MCP server. The remote transport exists to serve read-only analytical queries; enabling writes puts a signer behind a network listener.

### Authentication model

Authentication is a single shared bearer token, checked before the request reaches the MCP transport. It is a coarse deployment gate, not a per-user identity system: every client holding the token has the same access to the same read-only tool surface.

- When `MCP_HTTP_BEARER` is set, `POST`, `GET`, and `DELETE` on `MCP_HTTP_PATH` all require `Authorization: Bearer <token>`. `/healthz` does not.
- When it is unset, the server starts only if `MCP_HTTP_HOST` is a loopback address (`127.0.0.1`, `localhost`, `::1`). This keeps local development friction-free without ever silently exposing an unauthenticated listener on a routable interface.
- A token guarding a non-loopback listener must contain at least 32 bytes. A shorter one is a startup error. `openssl rand -hex 32` produces a 64-byte hex string and satisfies this comfortably.
- The token is compared in constant time, so a wrong token cannot be recovered by timing the response.

Request bodies are capped at 4 MiB. That limit is a fixed constant, not a tunable environment variable.

## Local run

Two terminals: the MCP server, then the explorer that calls it.

### 1. Start the MCP HTTP server

```bash
cd /path/to/neo-mcp
npm ci
npm run build

export MCP_HTTP_BEARER="$(openssl rand -hex 32)"
NEO_NETWORK=mainnet \
MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT=3001 \
MCP_HTTP_PATH=/mcp \
  npm run start:mcp-http
```

Confirm it is up:

```bash
curl -sS http://127.0.0.1:3001/healthz
```

Optionally drive the handshake by hand. This is the fastest way to prove the bearer token and the path are right before involving the explorer:

```bash
curl -sS -D - -X POST http://127.0.0.1:3001/mcp \
  -H "Authorization: Bearer $MCP_HTTP_BEARER" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "0" }
    }
  }'
```

A successful response includes an `Mcp-Session-Id` response header and the server's capabilities. Both the `Content-Type` and the two-value `Accept` header are mandatory; omitting either produces `415` or `406`.

### 2. Point the explorer at it

The explorer reaches the MCP server from `api/agent.js`, a Vercel serverless function, through `api/lib/mcpClient.js`. It needs three variables:

```bash
cd /Users/jinghuiliao/git/r3e/Neo-Explorer-UI

export DEEPSEEK_API_KEY="sk-..."                    # the agent's model provider
export NEOX_MCP_URL="http://127.0.0.1:3001/mcp"     # full URL including MCP_HTTP_PATH
export NEOX_MCP_BEARER="$MCP_HTTP_BEARER"           # same token the MCP server was started with

npx vercel dev
```

`NEOX_MCP_URL` must be the complete endpoint URL, path included — `mcpClient.js` passes it straight to `new URL(...)` and does not append `/mcp`.

Optional explorer variables: `DEEPSEEK_BASE_URL` (defaults to `https://api.deepseek.com/anthropic`), `AGENT_MODEL`, and `AGENT_RATE_LIMIT_PER_MINUTE`.

`npx vercel dev` is required because the agent is a serverless function; `npm run dev` starts Vite alone and does not execute `api/agent.js`.

Exercise the whole path:

```bash
curl -sS -X POST http://127.0.0.1:3000/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"chain":"n3","messages":[{"role":"user","content":"What is the current Neo N3 block height?"}]}'
```

The response carries the model's `answer` plus a `toolUses` array naming the MCP tools that ran. An empty `toolUses` on a blockchain question usually means the model answered without calling a tool, not that the transport failed — check the MCP server log to confirm requests are arriving.

### What the client does, and what the server must therefore support

`api/lib/mcpClient.js` is already shipped and is not negotiable. It constructs:

```js
const transport = new StreamableHTTPClientTransport(new URL(process.env.NEOX_MCP_URL), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.NEOX_MCP_BEARER}` } },
});
```

then `client.connect(transport)`, `client.listTools()`, and `client.callTool()`. Three implications:

- The bearer header is attached to every request the transport issues, including the `GET` SSE stream and the `DELETE` teardown. Authentication cannot be limited to `POST`.
- The client caches one connection per warm serverless instance and resets that cache when a call throws. A server restart or an evicted session surfaces as one failed request followed by a successful re-initialize, not a permanent outage.
- The bearer token never leaves the server side. It is read from the environment inside the serverless function and is never returned to the browser.

## Production deployment

### TLS is mandatory

The listener serves plaintext HTTP and does not terminate TLS, matching the REST entrypoint. The bearer token travels in a request header on every call, so any remote hop must be HTTPS. Terminate TLS at a reverse proxy or load balancer and keep the backend hop on loopback or a trusted host-local network. Do not publish the plaintext port to the internet.

### Bearer token

Use a high-entropy random secret of at least 32 bytes, delivered through your secret manager rather than a committed file:

```bash
openssl rand -hex 32
```

Rotate it by restarting the server with the new value and updating `NEOX_MCP_BEARER` on the explorer. Because authentication is a single shared token, rotation is the only revocation mechanism — there is no per-client credential to disable.

### Reverse proxy settings

The `GET` endpoint is a long-lived SSE stream. A proxy that buffers responses or applies a short read timeout will break it in ways that look like intermittent tool-call failures:

- Disable response buffering for `MCP_HTTP_PATH` (`proxy_buffering off` in nginx).
- Set the proxy read timeout above `MCP_HTTP_SESSION_TTL_MS`.
- Preserve the `Authorization`, `Mcp-Session-Id`, and `MCP-Protocol-Version` headers in both directions. Stripping `Mcp-Session-Id` makes every request after `initialize` fail with `400`.

### Sessions are in memory: the multi-replica limitation

Session state lives in the process. Nothing is shared through Redis, a database, or any other external store. This is a real constraint, not a detail to work around later:

- **Single replica.** Works as documented. A restart drops all sessions; clients re-initialize on their next call.
- **Multiple replicas without sticky sessions.** Broken in a way that is annoying to diagnose. A client initializes against replica A, receives a session id, and its next request round-robins to replica B, which has never seen that id and answers `404`. Under load this looks like sporadic failures rather than a clean outage.
- **Multiple replicas with sticky sessions.** Workable. Configure the load balancer to hash on the `Mcp-Session-Id` header (or use cookie-based affinity if the client preserves cookies — the MCP client does not, so header hashing is the reliable option). A replica going away still drops its sessions.
- **Clients that tolerate re-initialization.** The shipped explorer client resets its cached connection when a call fails, so it recovers on the next request. That makes a non-sticky multi-replica deployment *survivable* rather than *correct*: expect a visible failed turn each time the session is lost.

`MCP_HTTP_MAX_SESSIONS` and `MCP_HTTP_SESSION_TTL_MS` bound the memory a single replica can accumulate. They do not make sessions portable between replicas. If you need horizontal scale without sticky routing, that requires an eventStore-backed session design this deployment does not implement today.

### Other operational notes

- Keep `NEO_ENABLE_WRITES=false`. The tools reachable over this transport are read-only, and there is no signer in the MCP HTTP path.
- Rate limiting is enabled by default outside test environments via `RATE_LIMITING_ENABLED`, `MAX_REQUESTS_PER_MINUTE`, and `MAX_REQUESTS_PER_HOUR`.
- Run the MCP HTTP service and the REST API as separate processes or containers when both are needed. They bind different ports and have independent auth.
- Set `MCP_HTTP_ALLOWED_ORIGINS` if, and only if, a browser will connect directly. A server-side client such as the explorer's serverless function sends no `Origin` header.

## Docker

`docker/docker-compose.yml` defines a `neo-mcp-http` service that runs the MCP HTTP entrypoint from the same production image as the REST service. It requires a bearer token:

```bash
export HTTP_API_KEY="$(openssl rand -hex 32)"       # REST service
export MCP_HTTP_BEARER="$(openssl rand -hex 32)"    # MCP HTTP service
docker compose -f docker/docker-compose.yml up -d
```

Start only the MCP HTTP service — the documented remote-agent deployment. Compose interpolates the whole file before it selects services, so the REST service's mandatory `HTTP_API_KEY` must still be set even though its container is never started here. Any non-empty placeholder satisfies the interpolation guard; the "at least 32 bytes" length check only runs when the REST container itself starts, which this command never does:

```bash
HTTP_API_KEY=unused-when-starting-only-the-mcp-service \
MCP_HTTP_BEARER="$(openssl rand -hex 32)" \
  docker compose -f docker/docker-compose.yml up -d neo-mcp-http
```

Service defaults:

- The container listens on `0.0.0.0:3001`; the host publishes `127.0.0.1:3001`. Override with `MCP_HTTP_BIND_ADDRESS` and `MCP_HTTP_PORT`.
- `MCP_HTTP_BEARER` is required, because the container binds a non-loopback address.
- `NEO_ENABLE_WRITES` is pinned to `false` in the service definition.
- The root filesystem is read-only, capabilities are dropped, and privilege escalation is disabled, matching the REST service.
- The healthcheck polls `http://127.0.0.1:3001/healthz` inside the container.
- `/app/wallets` uses a dedicated `neo-mcp-http-wallets` volume rather than sharing the REST service's wallet volume, so the remotely reachable service has no view of records written by the local REST service.

Publishing on all interfaces is for a TLS-terminating proxy only. This also starts only `neo-mcp-http`, so it needs the same `HTTP_API_KEY` placeholder for the same whole-file interpolation reason:

```bash
HTTP_API_KEY=unused-when-starting-only-the-mcp-service \
MCP_HTTP_BIND_ADDRESS=0.0.0.0 MCP_HTTP_BEARER="$MCP_HTTP_BEARER" \
  docker compose -f docker/docker-compose.yml up -d neo-mcp-http
```

The registry overlay covers this service too, so `docker compose -f docker/docker-compose.yml -f docker/docker-compose.registry.yml` runs the pinned digest for both services rather than building either from the checkout.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Server exits at startup complaining the bearer is required | `MCP_HTTP_HOST` is not a loopback address and `MCP_HTTP_BEARER` is unset | Set the token, or bind to `127.0.0.1` |
| `401` on every request | Missing or mismatched `Authorization: Bearer` header | Confirm `NEOX_MCP_BEARER` matches `MCP_HTTP_BEARER` exactly, with no trailing newline |
| `404` on requests after a successful `initialize` | Session expired, was evicted at `MCP_HTTP_MAX_SESSIONS`, the server restarted, or a proxy stripped `Mcp-Session-Id` | Let the client re-initialize; check proxy header passthrough; raise `MCP_HTTP_SESSION_TTL_MS` |
| `400 Bad Request` on `tools/list` | Non-`initialize` request arrived with no session id | Ensure the client completed `initialize` and that `Mcp-Session-Id` survives the proxy |
| `406 Not Acceptable` | `Accept` header does not list both `application/json` and `text/event-stream` | Only affects hand-rolled `curl` calls; the SDK client sets this correctly |
| `415 Unsupported Media Type` | `Content-Type` on `POST` is not `application/json` | Set the header correctly |
| `403 Forbidden: origin not allowed` | The request carried an `Origin` header that is not in `MCP_HTTP_ALLOWED_ORIGINS` | Add the origin to the allowlist, or connect from a server-side client that sends no `Origin` |
| `503 Server session capacity reached` | `MCP_HTTP_MAX_SESSIONS` concurrent sessions already exist | Raise the cap, or find the client that is initializing without ever calling `DELETE`; idle sessions clear after `MCP_HTTP_SESSION_TTL_MS` |
| `405 Method Not Allowed` | A method other than `POST`, `GET`, or `DELETE` was used on `MCP_HTTP_PATH` | Use a supported method |
| Explorer returns `503 {"unavailable":true,"reason":"mcp_unconfigured"}` | `NEOX_MCP_URL` is unset in the explorer environment | Set it to the full endpoint URL including the path |
| Explorer returns `503 {"unavailable":true,"reason":"agent_unconfigured"}` | `DEEPSEEK_API_KEY` is unset | Set the model provider key; this is unrelated to the MCP transport |
| Tool calls hang, then fail after 45 seconds | `TOOL_TIMEOUT_MS` in the explorer client elapsed — usually a slow or unreachable Neo RPC endpoint | Check `NEO_MAINNET_RPC` / `NEO_TESTNET_RPC` reachability and `NEO_RPC_TIMEOUT_MS` |
| Intermittent failures behind a load balancer | Multiple replicas without sticky sessions | Route on `Mcp-Session-Id`, or run a single replica |

## Related documentation

- [README](../README.md) — package overview and full configuration table
- [API reference](./API.md) — MCP tool and REST route reference
- [Deployment guide](./DEPLOYMENT.md) — stdio and REST deployment
- [Docker guide](./DOCKER.md) — image, volume, and helper-script details
