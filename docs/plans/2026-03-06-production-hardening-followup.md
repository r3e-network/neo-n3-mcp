# Production Hardening Follow-up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce production noise and residual reliability issues by tightening logging behavior, fixing test/runtime teardown leaks, and aligning runtime defaults and docs with the actual HTTP/MCP deployment model.

**Architecture:** Keep the existing MCP and HTTP architecture intact and make surgical changes in the logger, long-running server/test lifecycle, and configuration entrypoints. Prefer root-cause fixes that remove noisy output and resource leaks without changing public APIs unless the behavior is clearly inconsistent today.

**Tech Stack:** TypeScript, Jest, Node.js, `@modelcontextprotocol/sdk`, `@cityofzion/neon-js`

### Task 1: Reproduce and isolate logger noise

**Files:**
- Modify: `src/utils/logger.ts`
- Test: `tests/config-logger.test.ts`
- Check: `tests/http-server.test.ts`

**Step 1: Write or refine failing tests**
- Add or refine tests that describe when console logging should be silent in test mode and when explicit opt-in logging should still work.

**Step 2: Run focused tests to verify the current noisy behavior**
- Run: `npx jest tests/config-logger.test.ts tests/http-server.test.ts --runInBand`
- Expected: output or assertions show logger noise / wrong default behavior.

**Step 3: Implement the minimal logger/config fix**
- Make logger console/file defaults environment-aware and keep explicit env overrides authoritative.

**Step 4: Run focused tests to verify green**
- Run: `npx jest tests/config-logger.test.ts tests/http-server.test.ts --runInBand`
- Expected: PASS with quieter output.

### Task 2: Reproduce and isolate teardown/open-handle leaks

**Files:**
- Modify: `src/index.ts`
- Modify: `src/http-server.ts`
- Modify: test files only if teardown helpers are missing or inconsistent
- Test: `tests/mcp-stress.test.ts`
- Test: `tests/mcp-comprehensive.test.ts`

**Step 1: Reproduce the leak signal with evidence**
- Run: `npm run test:mcp -- --runInBand --detectOpenHandles`
- Expected: identify servers, timers, sockets, or client handles that survive test completion.

**Step 2: Trace lifecycle boundaries**
- Verify startup/shutdown paths for MCP and HTTP servers, signal handlers, sockets, timers, and any lazy init caches.

**Step 3: Implement the minimal lifecycle fix**
- Ensure long-lived handles are closed/unref’d and tests consistently stop servers/clients.

**Step 4: Run the leak-focused tests again**
- Run: `npm run test:mcp -- --runInBand --detectOpenHandles`
- Expected: PASS with reduced/no teardown warnings.

### Task 3: Align runtime defaults and deployment docs

**Files:**
- Modify: `src/config.ts`
- Modify: `src/http.ts`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/PRODUCTION_CHECKLIST.md`

**Step 1: Identify mismatches**
- Check default network selection, port handling, logging defaults, and HTTP/MCP startup examples.

**Step 2: Implement minimal consistency fixes**
- Keep backward compatibility, but make defaults explicit and production-safe.

**Step 3: Update docs**
- Document effective defaults and recommended production env settings.

**Step 4: Verify docs and runtime behavior together**
- Run: `npm run type-check && npm run build`
- Optionally smoke `npm run start:http` with explicit env.

### Task 4: Final verification

**Files:**
- Verify the touched files above

**Step 1: Run targeted regression commands**
- `npx jest tests/config-logger.test.ts tests/http-server.test.ts --runInBand`
- `npm run test:mcp -- --runInBand`

**Step 2: Run full verification**
- `npm run type-check && npm run build && npm test && npm run test:mcp && npm run test:integration`

**Step 3: Run a final HTTP smoke if runtime config changed**
- Start testnet HTTP server locally and exercise `/health` plus one named-contract failure case.
