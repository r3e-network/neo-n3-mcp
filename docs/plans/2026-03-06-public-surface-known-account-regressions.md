# Public Surface Known Account Regressions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lock known-account enrichment through the MCP and HTTP public surfaces so recipient display metadata stays stable in production.

**Architecture:** Reuse the existing `NeoService` enrichment as the single source of truth, then extend handler-level and HTTP-level tests to assert the additive flattened fields (`name`, `logo`, `kind`, `displayName`) survive serialization unchanged. Only patch handler or docs code if the new tests uncover a real contract gap.

**Tech Stack:** TypeScript, Jest, MCP handler tests, HTTP server tests.

### Task 1: Inspect exposed responses

**Files:**
- Modify: `tests/tool-handler.test.ts`
- Modify: `tests/http-server.test.ts`
- Reference: `src/services/neo-service.ts`

**Step 1: Read the existing test coverage**
Run: `sed -n '500,620p' tests/tool-handler.test.ts && sed -n '120,220p' tests/http-server.test.ts`
Expected: Existing application-log tests that assert parsed transfer basics but not flattened known-account metadata.

**Step 2: Identify the desired response fields**
Run: `sed -n '220,360p' src/services/neo-service.ts`
Expected: `parsed.to` and `parsed.from` additive fields including `displayName`, `name`, `logo`, `kind`, and `knownAccount`.

### Task 2: Add the failing handler and HTTP regressions

**Files:**
- Modify: `tests/tool-handler.test.ts`
- Modify: `tests/http-server.test.ts`

**Step 1: Write the failing MCP/tool test**
Add assertions that `get_application_log` exposes `parsed.to.name`, `parsed.to.logo`, and `parsed.to.displayName` for a known recipient.

**Step 2: Run the focused MCP/tool test to verify it fails or proves the surface already works**
Run: `npx jest tests/tool-handler.test.ts --runInBand`
Expected: Either a red failure that shows a serialization gap, or an immediate pass indicating the surface already carries the enrichment.

**Step 3: Write the failing HTTP test**
Add assertions that `/api/transactions/:txid/application-log` returns the same flattened recipient fields.

**Step 4: Run the focused HTTP test to verify it fails or proves the surface already works**
Run: `npx jest tests/http-server.test.ts --runInBand`
Expected: Either a red failure showing an HTTP contract gap, or a pass indicating no code change is needed.

### Task 3: Patch any surfaced contract gap

**Files:**
- Modify: `src/handlers/tool-handler.ts` (only if needed)
- Modify: `src/http-server.ts` (only if needed)
- Modify: `docs/API.md` (only if behavior/docs diverge)

**Step 1: Apply the minimal production fix**
Keep `NeoService` as the source of truth; preserve additive RPC fields and avoid handler-specific reshaping unless required.

**Step 2: Re-run the focused tests**
Run: `npx jest tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS.

### Task 4: Verify production readiness for this slice

**Files:**
- Reference: `package.json`

**Step 1: Run focused contract verification**
Run: `npx jest tests/neo-service.test.ts tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS.

**Step 2: Run full project verification**
Run: `npm run type-check && npm run build && npm test && npm run test:mcp && npm run test:integration`
Expected: PASS.
