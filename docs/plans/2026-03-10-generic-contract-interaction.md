# Generic Contract Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the Neo N3 MCP server so clients can resolve contracts by name, script hash, or Neo address, invoke read/write methods generically, and inspect both contract status and transaction status through MCP tools and HTTP routes.

**Architecture:** Replace the current "famous contracts only" contract flow with a generic contract reference resolver inside `ContractService` that can map static aliases, direct hashes, and Neo addresses to a normalized on-chain contract target. Keep the existing famous-contract registry as optional metadata enrichment, then route MCP tools and HTTP endpoints through the generic resolver for contract info, invocation, fee estimation, and status checks.

**Tech Stack:** TypeScript, Jest, `@cityofzion/neon-js`, MCP SDK, Node.js HTTP server

### Task 1: Add service-level failing tests for generic contract references

**Files:**
- Modify: `tests/contract-service.test.ts`
- Modify: `src/contracts/contract-service.ts`

**Step 1: Write the failing test**

Add tests that assert `ContractService` can:
- resolve a contract target from a Neo address by converting it to a script hash
- return on-chain contract status/details for an arbitrary script hash
- invoke a contract by direct script hash without requiring a registry entry

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/contract-service.test.ts --runInBand`
Expected: FAIL because arbitrary references are rejected or contract status is unavailable.

**Step 3: Write minimal implementation**

Add normalized contract target resolution and generic contract-state lookup in `src/contracts/contract-service.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/contract-service.test.ts --runInBand`
Expected: PASS

### Task 2: Add handler-level failing tests for generic invoke and status tools

**Files:**
- Modify: `tests/tool-handler.test.ts`
- Modify: `src/handlers/tool-handler.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `invoke_contract` accepts `contract` or `nameOrAddress` style generic references
- `get_contract_info` returns status for arbitrary contract references
- a new contract status path can return contract deployment information and transaction wait/application log details remain consistent

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tool-handler.test.ts --runInBand`
Expected: FAIL because handlers only understand `contractName`/static registry semantics.

**Step 3: Write minimal implementation**

Update handler input normalization, descriptions, and output payloads to use the generic contract resolver.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tool-handler.test.ts --runInBand`
Expected: PASS

### Task 3: Add HTTP failing tests for generic contract routes

**Files:**
- Modify: `tests/http-server.test.ts`
- Modify: `src/http-server.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `GET /api/contracts/:reference` works for hashes and Neo addresses
- `POST /api/contracts/invoke` accepts generic contract references
- `GET /api/contracts/:reference/status` returns contract status

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/http-server.test.ts --runInBand`
Expected: FAIL because routes only handle limited name-based contract flows.

**Step 3: Write minimal implementation**

Refactor route parsing and contract calls to use the generic resolver and status API.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/http-server.test.ts --runInBand`
Expected: PASS

### Task 4: Refactor shared contract structures and preserve compatibility

**Files:**
- Modify: `src/contracts/contract-service.ts`
- Modify: `src/contracts/contracts.ts`
- Modify: `src/utils/validation.ts`

**Step 1: Write the failing test**

Add/extend tests for:
- backward compatibility with famous contract names
- manifest/operation metadata being optional for arbitrary contracts
- graceful status output when operation metadata is unavailable

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/contract-service.test.ts tests/tool-handler.test.ts --runInBand`
Expected: FAIL because arbitrary contract metadata is not represented cleanly.

**Step 3: Write minimal implementation**

Introduce a normalized contract target/status model with optional registry metadata.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/contract-service.test.ts tests/tool-handler.test.ts --runInBand`
Expected: PASS

### Task 5: Update docs and verify the integrated flow

**Files:**
- Modify: `README.md`
- Modify: `docs/API.md`

**Step 1: Write the failing test**

No automated doc test. Use verification only.

**Step 2: Run verification**

Run: `npm test -- tests/contract-service.test.ts tests/tool-handler.test.ts tests/http-server.test.ts --runInBand`
Expected: PASS

**Step 3: Write minimal implementation**

Document the new generic contract reference flow, invocation rules, and status endpoints.

**Step 4: Run full targeted verification**

Run: `npm run test:unit -- --runInBand`
Expected: PASS
