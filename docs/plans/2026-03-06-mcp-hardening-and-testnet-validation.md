# MCP Hardening And Testnet Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Neo N3 MCP server metadata, configuration, and documentation consistent with the implemented surface, then validate the server against Neo testnet using a provided wallet.

**Architecture:** Keep the existing `McpServer` implementation in `src/index.ts`, but centralize tool/resource metadata and remove drift between runtime behavior and published docs. Add regression tests around MCP list metadata and server versioning, then validate the built server and a live testnet wallet flow.

**Tech Stack:** TypeScript, Jest, `@modelcontextprotocol/sdk`, `@cityofzion/neon-js`

### Task 1: Lock down MCP metadata behavior

**Files:**
- Modify: `tests/mcp-protocol-compliance.test.ts`
- Modify: `tests/mcp-comprehensive.test.ts`
- Modify: `tests/mcp-integration-test.js`

**Step 1: Write the failing tests**

Add assertions that:
- every listed tool has a non-empty `description`
- every listed fixed resource has a non-empty `description`
- server version matches the package version format and actual runtime version

**Step 2: Run tests to verify they fail**

Run: `npx jest tests/mcp-protocol-compliance.test.ts tests/mcp-comprehensive.test.ts --runInBand`
Expected: FAIL because tool/resource descriptions are currently omitted from registration.

**Step 3: Write minimal implementation**

Update MCP registration in `src/index.ts` to pass descriptions/metadata to `server.tool(...)` and `server.resource(...)` using the SDK overloads that preserve metadata in `listTools` and `listResources`.

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/mcp-protocol-compliance.test.ts tests/mcp-comprehensive.test.ts tests/mcp-integration-test.js --runInBand`
Expected: PASS

### Task 2: Remove version/config drift

**Files:**
- Modify: `src/index.ts`
- Modify: `src/config.ts`
- Modify: `README.md`
- Modify: `docs/PRODUCTION_READINESS_REPORT.md`

**Step 1: Write the failing test**

Add assertions that the server version exposed over MCP equals `package.json` and that documented env names match runtime config keys.

**Step 2: Run test to verify it fails**

Run: `npx jest tests/server-init.test.ts tests/mcp-protocol-compliance.test.ts --runInBand`
Expected: FAIL because runtime version is hardcoded to `1.6.0` and config reads different env variable names than docs advertise.

**Step 3: Write minimal implementation**

Use the package version in `src/index.ts`, support both documented and legacy RPC env vars in `src/config.ts`, and update docs that still claim `34 tools / 9 resources`.

**Step 4: Run tests to verify they pass**

Run: `npx jest tests/server-init.test.ts tests/mcp-protocol-compliance.test.ts --runInBand`
Expected: PASS

### Task 3: Validate the production path

**Files:**
- Modify: `tests/mcp-integration-test.js`
- Optional notes: `docs/TESTING.md`

**Step 1: Add/adjust validation**

Ensure the integration test logs and verifies tool/resource descriptions and server version so the protocol surface is exercised through the built artifact.

**Step 2: Run build and full tests**

Run:
- `npm run build`
- `npm run test`
- `npm run test:mcp`
- `npm run test:integration`

Expected: PASS

**Step 3: Run live testnet validation**

Run a small script against the built server and Neo testnet that:
- imports the provided wallet key
- derives the wallet address
- checks testnet balance
- exercises at least one safe read-only MCP call with `network: "testnet"`

Expected: successful connection, wallet import, derived address, and balance/read results without exposing the secret key in logs.
