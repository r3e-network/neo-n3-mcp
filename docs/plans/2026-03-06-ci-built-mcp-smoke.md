# CI Built MCP Smoke Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make CI validate the built MCP artifact explicitly by adding a lightweight post-build smoke test and locking that workflow behavior with a regression test.

**Architecture:** Keep the existing workflow structure, but add one narrow smoke command that runs only against `dist/index.js` after `npm run build`. The smoke test avoids live blockchain calls and only verifies server startup plus static MCP surfaces (`listTools`, `listResources`, `get_network_mode`), so it remains fast and reliable in CI.

**Tech Stack:** GitHub Actions, Jest, Node.js, `@modelcontextprotocol/sdk`

### Task 1: Lock CI expectation with a failing test

**Files:**
- Create: `tests/ci-workflow.test.ts`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write the failing test**
- Add a test that reads `.github/workflows/ci.yml` and asserts the build job includes a named smoke-test step running `npm run test:mcp:smoke` after the build step.

**Step 2: Run the focused test to verify it fails**
- Run: `npx jest tests/ci-workflow.test.ts --runInBand`
- Expected: FAIL because the workflow does not yet run the built MCP smoke command.

### Task 2: Add the lightweight built-artifact MCP smoke test

**Files:**
- Create: `tests/mcp-build-smoke.test.ts`
- Modify: `package.json`

**Step 1: Write the smoke test**
- Start `dist/index.js`, connect via MCP stdio, and assert `listTools`, `listResources`, and `get_network_mode` work.
- Reuse `tests/mcp-test-utils.ts` for lifecycle cleanup.

**Step 2: Add a dedicated npm script**
- Add `test:mcp:smoke` that runs only the new smoke test serially.

**Step 3: Run the smoke test against the built artifact**
- Run: `npx jest tests/mcp-build-smoke.test.ts --runInBand`
- Expected: PASS once `dist/index.js` exists.

### Task 3: Wire the build workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add the post-build smoke step**
- Insert a `Run built MCP smoke test` step in the `build` job after `Build project` and before artifact validation or immediately after artifact validation.

**Step 2: Re-run the workflow regression test**
- Run: `npx jest tests/ci-workflow.test.ts --runInBand`
- Expected: PASS.

### Task 4: Final verification

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `tests/ci-workflow.test.ts`
- Verify: `tests/mcp-build-smoke.test.ts`
- Verify: `package.json`

**Step 1: Build and run the smoke path**
- Run: `npm run build && npm run test:mcp:smoke`
- Expected: PASS.

**Step 2: Run the regular unit suite**
- Run: `npm test -- --runInBand`
- Expected: PASS with the new workflow regression test included.
