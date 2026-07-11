# Testing Guide

Node.js `>=22` is required. Install the audited lockfile before running tests:

```bash
npm ci
```

## Test Commands

| Command | Scope | Network access |
| --- | --- | --- |
| `npm run test:unit` | Deterministic Jest unit tests; excludes `tests/mcp-*.test.ts` | No |
| `npm run build` | Clean TypeScript compilation to `dist/` | No |
| `npm run test:mcp` | Deterministic built-server smoke and stdio lifecycle tests | No |
| `npm run test:all` | Unit tests, build, then deterministic MCP tests | No |
| `npm run test:mcp:live` | Public RPC and broader MCP protocol checks | Yes |
| `npm run test:mcp:stress` | Explicit MCP load and stability suite | Some cases |
| `npm run test:integration` | Standalone built-server integration script with public RPC calls | Yes |
| `npm run test:coverage` | Unit-test coverage report | No |
| `npm run verify` | Type check, deterministic unit tests, build, and deterministic MCP tests | No |

`test:mcp`, `test:mcp:live`, `test:mcp:stress`, and `test:integration` execute `dist/index.js`; build first unless the current `dist/` is known to match the source.

## Deterministic Validation

Run the default local and CI-safe stack:

```bash
npm run test:all
```

For the release-oriented validation stack:

```bash
npm run verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm pack --dry-run
```

Run one unit test file:

```bash
npm run test:unit -- --runInBand tests/http-server.test.ts
```

Run the documentation and production-asset checks:

```bash
npx jest --runInBand \
  tests/documentation-surface.test.ts \
  tests/production-assets.test.ts
```

No minimum coverage threshold is configured in `jest.config.js`; coverage output is informational.

## Live and Stress Checks

Live RPC checks are deliberately excluded from `test:all` so normal validation is deterministic:

```bash
npm run build
npm run test:mcp:live
```

The standalone integration runner is also live:

```bash
npm run build
npm run test:integration
```

Run the stress suite explicitly when load behavior is in scope:

```bash
npm run build
npm run test:mcp:stress
```

Public RPC availability, node plugin support, and network latency can affect these opt-in suites. A live failure must be investigated; it is not treated as an expected or skipped unit-test result.

## Manual HTTP Testing

Start HTTP mode with one Neo network and a bearer key:

```bash
npm run build
export HTTP_API_KEY="$(openssl rand -hex 32)"
NEO_NETWORK=testnet npm run start:http
```

`/live` and `/health` do not require authentication:

```bash
curl http://127.0.0.1:3000/live
curl http://127.0.0.1:3000/health
```

Every other route requires the bearer token when `HTTP_API_KEY` is configured:

```bash
curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/metrics

curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/api/blockchain/height

curl -H "Authorization: Bearer $HTTP_API_KEY" \
  http://127.0.0.1:3000/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/balance
```

Create a wallet:

```bash
NEO_ENABLE_WALLET_ADMIN=true curl -X POST http://127.0.0.1:3000/api/wallets \
  -H "Authorization: Bearer $HTTP_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"password":"test-password-123"}'
```

Estimate transfer fees without broadcasting:

```bash
curl -X POST http://127.0.0.1:3000/api/transfers/estimate-fees \
  -H "Authorization: Bearer $HTTP_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"fromAddress":"Na...","toAddress":"Nb...","asset":"NEO","amount":"1"}'
```

State-changing routes create a pending idempotent intent:

```bash
curl -X POST http://127.0.0.1:3000/api/transfers \
  -H "Authorization: Bearer $HTTP_API_KEY" \
  -H "Idempotency-Key: manual-test-transfer-001" \
  -H 'Content-Type: application/json' \
  -d '{"network":"testnet","toAddress":"Nb...","asset":"NEO","amount":"1"}'
```

Approve the exact returned fingerprint with `HTTP_WRITE_APPROVAL_API_KEY`. Use testnet and a separately provisioned disposable signer for manual write-path validation.

## CI Coverage

`.github/workflows/ci.yml` runs:

- unit tests on Node.js 22 and 24
- coverage on Node.js 22
- a clean build and deterministic MCP tests
- package-content validation
- full and production-only dependency audits
- Compose validation plus development and production image builds

Live and stress MCP suites are not part of the default CI workflow.
