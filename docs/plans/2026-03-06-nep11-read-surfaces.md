# NEP-11 Read Surfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production-ready `get_nep11_balances` and `get_nep11_transfers` read-only capabilities across NeoService, MCP, and HTTP.

**Architecture:** Reuse the existing address validation, asset descriptor enrichment, and known-account transfer enrichment patterns already used for NEP-17. Preserve raw RPC payloads and add only additive metadata so clients can rely on either the raw node schema or the enriched convenience fields.

**Tech Stack:** TypeScript, Jest, Neo RPC `getnep11balances`, Neo RPC `getnep11transfers`, MCP tool handlers, HTTP server.

### Task 1: Define the public contract

**Files:**
- Modify: `tests/neo-service.test.ts`
- Modify: `tests/tool-handler.test.ts`
- Modify: `tests/http-server.test.ts`

**Step 1: Write failing service tests**
Add `NeoService` tests for `getNep11Balances(address)` and `getNep11Transfers(address)` with representative non-empty payloads.

**Step 2: Run the service test to verify RED**
Run: `npx jest tests/neo-service.test.ts --runInBand`
Expected: FAIL because the methods do not exist yet.

**Step 3: Write failing MCP and HTTP tests**
Add coverage for:
- `get_nep11_balances`
- `get_nep11_transfers`
- `GET /api/accounts/:address/nep11-balances`
- `GET /api/accounts/:address/nep11-transfers`

**Step 4: Run public-surface tests to verify RED**
Run: `npx jest tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: FAIL because the new surfaces are not wired yet.

### Task 2: Implement NeoService support

**Files:**
- Modify: `src/services/neo-service.ts`

**Step 1: Add additive balance enrichment**
For each NEP-11 balance entry, add an `asset` descriptor while preserving raw token arrays and counts.

**Step 2: Add additive transfer enrichment**
Reuse the transfer-history helper pattern to attach `direction`, `timestampIso`, `asset`, `from`, `to`, and `counterparty`.

**Step 3: Re-run service tests**
Run: `npx jest tests/neo-service.test.ts --runInBand`
Expected: PASS.

### Task 3: Wire MCP and HTTP

**Files:**
- Modify: `src/handlers/tool-handler.ts`
- Modify: `src/http-server.ts`
- Modify: `src/index.ts`

**Step 1: Add MCP handlers and schemas**
Expose both tools with address, optional timestamps for transfers, and network selection.

**Step 2: Add HTTP parity routes**
Expose:
- `GET /api/accounts/:address/nep11-balances`
- `GET /api/accounts/:address/nep11-transfers?fromTimestampMs=...&toTimestampMs=...`

**Step 3: Re-run public-surface tests**
Run: `npx jest tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS.

### Task 4: Update docs and inventory

**Files:**
- Modify: `README.md`
- Modify: `docs/API.md`
- Modify: MCP metadata/count tests if needed

**Step 1: Add both tools to inventories**
Update tool counts and endpoint summaries.

**Step 2: Document plugin caveat**
Note that NEP-11 balance and transfer history require node support for the TokensTracker RPC methods.

**Step 3: Re-run MCP metadata suites**
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
