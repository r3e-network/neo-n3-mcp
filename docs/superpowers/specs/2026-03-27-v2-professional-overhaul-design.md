# Neo N3 MCP Server v2.0 — Professional Overhaul Design Spec

**Date**: 2026-03-27
**Target**: v2.0.0 (breaking changes allowed)
**Primary deployment**: npm package (`npx @r3e/neo-n3-mcp`)
**Target audience**: All skill levels (beginner to advanced Neo developers)

---

## 1. Build & Dependencies

### Problem
- TypeScript compilation fails with 100+ type errors from dependency conflicts
- `vendor/neon-js` bundled locally instead of using the npm-published package
- Unmet dependencies in `npm ls`

### Design
- **Replace `file:vendor/neon-js`** with `@cityofzion/neon-js` from npm (latest compatible version)
- **Pin `@types/node`** to a version compatible with TypeScript 5.8.x
- **Clean dependency tree**: remove unused devDependencies, ensure `npm ls` is clean
- **Verify `npm pack` output**: ensure only dist/, README, LICENSE, and package.json ship
- **Delete `vendor/` directory** entirely after migration

### Success Criteria
- `npm run build` succeeds with zero errors
- `npm run type-check` passes cleanly
- `npm ls` shows no unmet or extraneous dependencies
- `npm pack --dry-run` shows only intended files

---

## 2. Type Safety

### Problem
- 23+ `any` types in contract-service.ts, plus more in neo-service, wallet-service, http-server
- `rpcClient: any` means no IDE autocomplete or compile-time safety for the core RPC layer
- Strict mode enabled but undermined by `any` escape hatches

### Design
Create proper TypeScript interfaces in a new `src/types/` directory:

- **`rpc.ts`** — RPC client interface, RPC response types, block/transaction shapes
- **`wallet.ts`** — Account, EncryptedWallet, WalletInfo types
- **`contract.ts`** — ContractManifest, ContractOperation, InvocationResult types
- **`nep.ts`** — NEP-17 transfer, NEP-11 balance/transfer types
- **`http.ts`** — HTTP request body types, response envelope types

### Rules
- Zero `any` in production code (src/). Only allowed in test mocks.
- Use `unknown` + type narrowing where external data enters the system (RPC responses, HTTP bodies)
- Leverage neon-js types where available instead of re-inventing

### Success Criteria
- `grep -r ': any' src/` returns zero matches (excluding comments)
- All service methods have typed parameters and return types

---

## 3. Runtime Hardening

### 3a. Rate Limiting Integration

**Problem**: Rate limiter exists in `src/utils/rate-limiter.ts` but is never called.

**Design**:
- Wire rate limiter into `http-server.ts` as middleware (check before route handling)
- Wire rate limiter into tool handler (check before tool execution)
- Use client IP for HTTP, use "mcp-client" as key for MCP (single client)
- Return 429 with Retry-After header for HTTP; return MCP error for tools

### 3b. Config Validation at Startup

**Problem**: Invalid env vars silently ignored (e.g., `PORT=abc`).

**Design**:
- Add `validateConfig()` function called during server initialization
- Use zod schemas to validate all config values
- Fail fast with clear error message if config is invalid
- Validate RPC URL format (must be valid URL)
- Validate PORT is a number 1-65535
- Validate LOG_LEVEL is one of debug/info/warn/error

### 3c. Log Rotation

**Problem**: Log file grows unbounded.

**Design**:
- Implement size-based rotation in the existing logger (no new dependency)
- Rotate when file exceeds 10MB, keep last 3 rotated files
- Pattern: `neo-n3-mcp.log` -> `neo-n3-mcp.log.1` -> `neo-n3-mcp.log.2` -> `neo-n3-mcp.log.3`
- Check file size on each write batch (not every line — amortize cost)

### Success Criteria
- Rate limiter actually rejects requests when limit exceeded (test this)
- Server refuses to start with `PORT=abc` and prints clear error
- Log files rotate at 10MB boundary

---

## 4. Package Surface

### Problem
- Package may ship unnecessary files (vendor/, docs/, tests/)
- `bin` entry needs to work cleanly with `npx`
- TypeScript declarations need to ship for library consumers

### Design
- **`files` field in package.json**: `["dist/", "README.md", "LICENSE"]`
- **`bin` field**: `{ "neo-n3-mcp": "dist/index.js" }` with proper shebang
- **`types` field**: `"dist/index.d.ts"`
- **`exports` field**: proper ESM/CJS entry points
- **Shebang**: Add `#!/usr/bin/env node` to `src/index.ts` (preserved in build)
- **`engines`**: Keep `"node": ">=18"`
- **`repository`, `homepage`, `bugs`**: Ensure these are set for npm page

### Success Criteria
- `npx @r3e/neo-n3-mcp` works out of the box
- `npm pack` includes only dist/, README, LICENSE, package.json
- TypeScript consumers can import types

---

## 5. Documentation Updates

### Design
- **Update README**: Add troubleshooting section, update tool count if changed, verify all examples work
- **Update CHANGELOG**: Document all v2.0 changes
- **Update or replace PRODUCTION_READINESS_REPORT.md**: Reflect v2.0 state
- **Remove stale plan docs**: The 13 modified plan files in git status are noise
- **Add MIGRATION.md**: v1.x -> v2.0 migration guide (since breaking changes allowed)

### Success Criteria
- All docs reference v2.0
- README examples verified working
- No references to vendored neon-js

---

## 6. Testing

### Design
- **Fix all existing tests** to pass with the new neon-js dependency
- **Add type-safety tests**: Ensure service return types match expected interfaces
- **Verify MCP tests run**: Un-skip or fix any disabled MCP integration tests
- **Add rate limiter integration test**: Verify rejection behavior
- **Add config validation test**: Verify startup failure on bad config

### Success Criteria
- `npm run test:all` passes with zero failures
- No skipped tests without documented reason
- Coverage for all new code (rate limiting integration, config validation, log rotation)

---

## 7. HTTP Server (Deprioritized)

### Design
- Keep as optional entry point (`src/http.ts`)
- Fix any type errors so it compiles
- Do not invest in routing library or major refactoring
- Ensure `/health` and `/metrics` work correctly
- Document as "experimental" in README

### Success Criteria
- Compiles without errors
- `/health` returns 200
- Clearly marked as optional/experimental

---

## 8. Work Streams (Execution Order)

Dependencies flow top-to-bottom:

1. **Build & Dependencies** (must be first — nothing else works without a clean build)
2. **Type Safety** (enables confident refactoring in subsequent steps)
3. **Runtime Hardening** (rate limiting, config validation, log rotation)
4. **Package Surface** (clean up what ships)
5. **Testing** (verify everything works end-to-end)
6. **Documentation** (reflect final state)
7. **HTTP Server cleanup** (last, lowest priority)

---

## 9. Out of Scope

- No new tools or resources added
- No plugin/extension architecture
- No OpenAPI spec for HTTP server
- No E2E test framework introduction
- No performance optimization beyond what's needed for correctness
- No UI or dashboard

---

## 10. Breaking Changes (v1.x -> v2.0)

- Vendored neon-js replaced with npm dependency (install behavior changes)
- Config validation may reject previously-silent bad values
- Rate limiting now enforced (previously configured but ignored)
- Package `files` field may change what's available after install
- Some error message wording may change due to type improvements
