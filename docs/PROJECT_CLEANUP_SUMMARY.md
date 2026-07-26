# Project Cleanup Summary

This document records the repository cleanup and production hardening completed for Neo MCP `3.0.0` in July 2026.

## Cleanup Outcome

The active package surface is now TypeScript-only and built with `tsc`. The cleanup removed obsolete build configuration, legacy indirection, and generated repair artifacts that were not part of the product.

Removed categories:

- the unused Babel configuration (`babel.config.cjs`)
- the obsolete example configuration (`config/docker.json`)
- the unused cache utility and handler registry (`src/utils/cache.ts` and `src/handlers/index.ts`)
- one-off test repair scripts such as `fix-tests*.js`, `fix-bo-test-2.js`, and `skip-tests*.js`
- generated test, MCP, repair, and diagnostic output files from the repository root
- redundant Docker ignore files that previously required build-context mutation

These files are not runtime prerequisites and should not be restored without a current, tested use case.

## Current Repository Surface

Primary maintained paths:

```text
src/                         TypeScript server implementation
tests/                       Unit, deterministic MCP, live, and stress tests
docker/                      Production and development container definitions
scripts/                     Release and Docker helper scripts
docs/                        User and operator documentation
website/                     Static project website
package.json                 Package metadata, scripts, and dependency policy
package-lock.json            Audited dependency lockfile
tsconfig.json                TypeScript build configuration
jest.config.js               Jest and ts-jest configuration
```

The published npm package is limited to `dist/`, `README.md`, and `LICENSE` through the `files` field in `package.json`.

## Runtime Hardening

- Node.js `>=22` is the supported runtime.
- HTTP binds to `127.0.0.1` by default.
- A non-loopback `HTTP_HOST` requires `HTTP_API_KEY`.
- Every configured HTTP API key must contain at least 32 bytes.
- Bearer authentication protects every HTTP route except `/live` and `/health` when a key is configured.
- `HTTP_CORS_ORIGINS` provides an optional exact-origin allowlist; wildcard CORS is not supported.
- `HTTP_MAX_BODY_BYTES` limits request bodies and defaults to 1 MiB.
- `NEO_RPC_TIMEOUT_MS` bounds each Neo RPC operation and defaults to 15 seconds.
- `WALLETS_DIR` controls persisted wallet storage and defaults to `./wallets`.
- Write operations require `confirm` to be the JSON boolean `true`.
- Block responses distinguish `blockCount` from the latest block height, calculated as `max(0, blockCount - 1)`.

## Container Hardening

`docker/docker-compose.yml` is the production Compose definition. It:

- requires `HTTP_API_KEY`
- publishes the host port on `127.0.0.1` by default
- runs the container HTTP listener on `0.0.0.0:3000`
- persists `/app/wallets` in the `neo-mcp-wallets` named volume
- uses a liveness check against `/live`
- limits Docker JSON logs to three 10 MiB files

`docker/docker-compose.dev.yml` binds only to loopback and provides a documented local-development key. That default is not suitable for shared or production environments.

Both Dockerfiles use Node.js 22 Alpine images. The production image builds `dist/` with development dependencies, then installs production dependencies in the final non-root image.

## Dependency Hardening

The package uses the maintained npm release of `@cityofzion/neon-js`. A scoped override pins only the transitive `lodash` dependency beneath `@cityofzion/neon-core` to `4.18.1`:

```json
{
  "overrides": {
    "@cityofzion/neon-core": {
      "lodash": "4.18.1"
    }
  }
}
```

Both of these checks are expected to complete without vulnerabilities:

```bash
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

Keep the override scoped and re-evaluate it when Neo dependencies are upgraded.

## Test Organization

The test scripts now separate deterministic validation from external-network and load checks:

| Command | Purpose |
| --- | --- |
| `npm run test:unit` | Deterministic unit tests; excludes `tests/mcp-*.test.ts` |
| `npm run build && npm run test:mcp` | Deterministic built-server smoke and lifecycle checks |
| `npm run test:all` | Unit tests, build, and deterministic MCP checks |
| `npm run test:mcp:live` | Opt-in public RPC checks |
| `npm run test:mcp:stress` | Explicit stress checks |

Live RPC variability is no longer mixed into the default suite. Test failures are not classified as expected security failures or silently skipped; deterministic checks must pass, and opt-in failures must be investigated in their network context.

## Release Hardening

`scripts/prepare-release.sh` now:

1. requires a clean working tree
2. installs the committed lockfile
3. runs type checking, deterministic unit tests, the build, and deterministic MCP tests
4. runs full and production-only audits
5. validates package contents and both Compose definitions
6. builds both images unless `--skip-docker` is supplied
7. updates the version without creating a commit or tag

GitHub Actions validates Node.js 22 and 24, package contents, dependency audits, Compose files, and both images. Published GitHub releases can publish npm and Docker artifacts. The repository does not contain an automated production deployment, dashboard, alerting configuration, or rollback automation.

## Verification Commands

```bash
npm run type-check
npm run test:unit -- --runInBand
npm run build
npm run test:mcp
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm pack --dry-run
HTTP_API_KEY=verification-key-0000000000000000 \
  docker compose -f docker/docker-compose.yml config
docker compose -f docker/docker-compose.dev.yml config
```

Production readiness still depends on operator-owned RPC capacity, secret storage, network controls, backups, observability, rollout, and rollback procedures. This cleanup establishes a hardened repository baseline; it does not certify a particular external deployment.
