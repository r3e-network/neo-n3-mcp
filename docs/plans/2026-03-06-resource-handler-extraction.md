# Resource Handler Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract MCP resource registration out of `src/index.ts` into `src/handlers/resource-handler.ts` without changing any public resource URIs, payload shapes, or network-mode behavior.

**Architecture:** Keep `NeoN3McpServer` as the owner of service lifecycle and pass a narrow dependency object into `setupResourceHandlers`. The handler module becomes the single place that registers fixed status resources plus the block template resource, while `src/index.ts` delegates to it.

**Tech Stack:** TypeScript, Jest, Node.js, `@modelcontextprotocol/sdk`

### Task 1: Lock registration behavior with a failing test

**Files:**
- Create: `tests/resource-handler.test.ts`
- Modify: `src/handlers/resource-handler.ts`

**Step 1: Write the failing test**
- Assert that `setupResourceHandlers` registers the expected fixed resources and block template for `NetworkMode.BOTH`.
- Assert that `NetworkMode.TESTNET_ONLY` omits the mainnet status resource.
- Execute one registered handler and assert it returns JSON content with the original URI and payload.

**Step 2: Run the focused test to verify it fails**
- Run: `npx jest tests/resource-handler.test.ts --runInBand`
- Expected: FAIL because the placeholder handler currently registers nothing.

### Task 2: Implement the extracted handler module

**Files:**
- Modify: `src/handlers/resource-handler.ts`

**Step 1: Replace placeholder logic with real registration**
- Add a small dependency interface with `networkMode` and `getNeoService`.
- Register `neo://network/status`, conditional mainnet/testnet status resources, and `neo://block/{height}`.
- Preserve response content shape and `application/json` MIME type.

**Step 2: Re-run the focused test**
- Run: `npx jest tests/resource-handler.test.ts --runInBand`
- Expected: PASS.

### Task 3: Delegate from `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Step 1: Replace in-class registration details with delegation**
- Keep the existing `setupResources()` method, but make it call `setupResourceHandlers` with `this.server`, `config.networkMode`, and a bound `getNeoService` dependency.

**Step 2: Re-run targeted regressions**
- Run: `npx jest tests/resource-handler.test.ts tests/server-init.test.ts --runInBand`
- Expected: PASS.

### Task 4: Verify resource behavior end-to-end

**Files:**
- Verify: `src/handlers/resource-handler.ts`
- Verify: `src/index.ts`

**Step 1: Run a representative MCP resource suite**
- Run: `npx jest tests/mcp-latest-features.test.ts --runInBand`
- Expected: PASS for resource listing and reads after extraction.
