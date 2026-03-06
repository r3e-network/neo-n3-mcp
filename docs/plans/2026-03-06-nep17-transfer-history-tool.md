# NEP-17 Transfer History Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-ready `get_nep17_transfers` capability across NeoService, MCP, and HTTP so clients can query account transfer history with the same known-account enrichment used elsewhere.

**Architecture:** Reuse `NeoService` as the single source of truth and call the Neo RPC `getnep17transfers` method with additive enrichment only. Preserve the raw RPC payload while adding `direction`, `asset`, `from`, `to`, `counterparty`, and `timestampIso` fields to each entry so downstream clients can render transfers safely and consistently.

**Tech Stack:** TypeScript, Jest, Neo RPC `getnep17transfers`, MCP tool handlers, HTTP server.

### Task 1: Define the public contract

**Files:**
- Modify: `tests/neo-service.test.ts`
- Modify: `tests/tool-handler.test.ts`
- Modify: `tests/http-server.test.ts`
- Reference: `src/services/neo-service.ts`

**Step 1: Write a failing service test**
Add a `NeoService` test for `getNep17Transfers(address)` that expects raw `sent`/`received` entries plus additive enriched fields (`direction`, `asset`, `from`, `to`, `counterparty`, `timestampIso`).

**Step 2: Run the focused service test and verify it fails**
Run: `npx jest tests/neo-service.test.ts --runInBand`
Expected: FAIL because `getNep17Transfers` does not exist yet.

**Step 3: Write failing MCP and HTTP contract tests**
Add:
- `tests/tool-handler.test.ts` coverage for `get_nep17_transfers`
- `tests/http-server.test.ts` coverage for `GET /api/accounts/:address/nep17-transfers`

**Step 4: Run focused public-surface tests and verify they fail**
Run: `npx jest tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: FAIL because the new surface is not wired yet.

### Task 2: Implement NeoService support

**Files:**
- Modify: `src/services/neo-service.ts`

**Step 1: Add a private transfer-entry enrichment helper**
Use the existing known-account and asset helpers to enrich each entry without mutating the original RPC fields.

**Step 2: Add `getNep17Transfers(address, options?)`**
Map optional `fromTimestampMs` / `toTimestampMs` to the RPC positional parameters and return the additive enriched payload.

**Step 3: Re-run the focused service test**
Run: `npx jest tests/neo-service.test.ts --runInBand`
Expected: PASS.

### Task 3: Wire MCP and HTTP

**Files:**
- Modify: `src/handlers/tool-handler.ts`
- Modify: `src/http-server.ts`
- Modify: `src/index.ts`

**Step 1: Add MCP handler and tool schema**
Expose `get_nep17_transfers` with `address`, optional timestamps, and network selection.

**Step 2: Add HTTP parity route**
Expose `GET /api/accounts/:address/nep17-transfers?fromTimestampMs=...&toTimestampMs=...`.

**Step 3: Re-run the focused public-surface tests**
Run: `npx jest tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS.

### Task 4: Update docs and suite expectations

**Files:**
- Modify: `README.md`
- Modify: `docs/API.md`
- Modify: MCP test files that assert tool counts or enumerations

**Step 1: Update the documented tool inventory**
Change counts and list the new tool in the blockchain/account history surfaces.

**Step 2: Document the RPC/plugin caveat**
Note that `getnep17transfers` depends on node support and may fail on minimal nodes.

**Step 3: Re-run the tests that assert tool metadata/counts**
Run: `npx jest tests/mcp-comprehensive.test.ts tests/mcp-latest-features.test.ts tests/mcp-protocol-compliance.test.ts --runInBand`
Expected: PASS.

### Task 5: Verify production readiness

**Files:**
- Reference: `package.json`

**Step 1: Run focused verification**
Run: `npx jest tests/neo-service.test.ts tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS.

**Step 2: Run full verification**
Run: `npm run type-check && npm run build && npm test && npm run test:mcp && npm run test:integration`
Expected: PASS.
