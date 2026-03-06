# Neo N3 MCP Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the Neo N3 MCP server for safer production use by fixing insecure wallet defaults, aligning runtime configuration/versioning, making RPC failures explicit, and validating the result with automated tests plus a Neo testnet smoke test.

**Architecture:** Keep the current MCP surface and service layout intact, but tighten unsafe defaults and centralize metadata/config behavior. Prefer surgical changes in `src/config.ts`, `src/utils/logger.ts`, `src/services/wallet-service.ts`, `src/services/neo-service.ts`, `src/http-server.ts`, and the related tests/docs rather than broad rewrites.

**Tech Stack:** TypeScript, Jest, `@modelcontextprotocol/sdk`, `@cityofzion/neon-js`

### Task 1: Add regression tests for hardening targets

**Files:**
- Modify: `tests/wallet-service.test.ts`
- Modify: `tests/neo-service.test.ts`
- Modify: `tests/server-init.test.ts`
- Create: `tests/config-logger.test.ts`

**Step 1: Write failing tests**
- Add tests asserting config accepts both `NEO_MAINNET_RPC`/`NEO_TESTNET_RPC` and `*_URL` aliases.
- Add tests asserting logger respects configured file path and enablement.
- Add tests asserting `WalletService` rejects missing passwords and persists a Neo-native encrypted key payload.
- Add tests asserting `NeoService.getBlockchainInfo()` and `NeoService.getBalance()` throw on unrecoverable RPC failure instead of returning fake success.

**Step 2: Run targeted tests to verify they fail**
Run: `npx jest tests/config-logger.test.ts tests/wallet-service.test.ts tests/neo-service.test.ts tests/server-init.test.ts --runInBand`
Expected: FAIL on current config aliases, wallet defaults, logger path handling, and RPC fallback behavior.

### Task 2: Harden config and logging

**Files:**
- Modify: `src/config.ts`
- Modify: `src/utils/logger.ts`

**Step 1: Implement env alias handling**
- Accept both `NEO_MAINNET_RPC` and `NEO_MAINNET_RPC_URL`.
- Accept both `NEO_TESTNET_RPC` and `NEO_TESTNET_RPC_URL`.
- Normalize logging config into explicit `enabled` + `filePath` semantics.

**Step 2: Run focused tests**
Run: `npx jest tests/config-logger.test.ts tests/server-init.test.ts --runInBand`
Expected: PASS

### Task 3: Secure wallet and HTTP flows

**Files:**
- Modify: `src/services/wallet-service.ts`
- Modify: `src/http-server.ts`
- Modify: `tests/wallet-service.test.ts`

**Step 1: Replace insecure defaults**
- Require explicit password for HTTP wallet creation/import.
- Remove the implicit `'password'` fallback.
- Persist wallet files with restrictive permissions.
- Use Neo-native encrypted key storage and keep the existing response field stable if practical.

**Step 2: Run focused tests**
Run: `npx jest tests/wallet-service.test.ts --runInBand`
Expected: PASS

### Task 4: Make RPC/runtime metadata consistent

**Files:**
- Modify: `src/services/neo-service.ts`
- Modify: `src/index.ts`
- Modify: `tsconfig.json`
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Implement minimal runtime fixes**
- Throw on unrecoverable blockchain/balance RPC failures.
- Source the MCP server version from `package.json` instead of hardcoding it.
- Tighten release validation scripts to run real checks.

**Step 2: Run focused tests**
Run: `npx jest tests/neo-service.test.ts tests/mcp-protocol-compliance.test.ts --runInBand`
Expected: PASS

### Task 5: Validate end-to-end and smoke test testnet

**Files:**
- Modify: `tests/mcp-integration-test.js` (only if required)
- Modify: `docs/TESTING.md` (only if required)

**Step 1: Run full verification**
Run: `npm run type-check && npm run build && npm test && npm run test:mcp && npm run test:integration`
Expected: all commands exit 0.

**Step 2: Run testnet smoke test**
Run a dedicated Node/Jest smoke script using the provided testnet key to:
- derive the account address,
- read current balance on testnet,
- optionally build a no-broadcast transaction preparation flow,
- verify the configured RPC endpoint is healthy.

**Step 3: Document exact results**
- Capture the testnet address and observable balances.
- Do not print or persist the secret key/WIF in logs or files.
