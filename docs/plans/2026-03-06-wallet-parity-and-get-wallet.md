# Wallet Parity And Get Wallet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make wallet behavior consistent across MCP and HTTP, then add a missing MCP tool for retrieving persisted wallet metadata.

**Architecture:** Reuse `WalletService` as the single persistence/encryption path for wallet creation and encrypted imports. Keep stateless import behavior for no-password flows, and expose stored wallet retrieval through a new MCP `get_wallet` tool.

**Tech Stack:** TypeScript, Jest, `@modelcontextprotocol/sdk`, `@cityofzion/neon-js`

### Task 1: Centralize wallet import semantics
- Modify `src/services/wallet-service.ts`
- Modify `tests/wallet-service.test.ts`
- Allow `importWallet` to accept optional `password`
- Persist only when `password` is provided
- Preserve stateless derive-only behavior when `password` is omitted

### Task 2: Add MCP wallet retrieval and align runtime wiring
- Modify `src/handlers/tool-handler.ts`
- Modify `src/index.ts`
- Modify `tests/tool-handler.test.ts`
- Add `get_wallet`
- Route `create_wallet` / `import_wallet` through `WalletService` in the main runtime path
- Preserve compatibility aliases like `privateKeyOrWIF`

### Task 3: Align HTTP wallet behavior
- Modify `src/http-server.ts`
- Modify `tests/http-server.test.ts`
- Make `POST /api/wallets/import` accept optional `password`
- Accept `privateKeyOrWIF` as alias for `key`
- Keep `GET /api/wallets/:address` sanitized

### Task 4: Update docs and validate
- Modify `README.md`
- Modify `docs/API.md`
- Run `npm run build`
- Run `npm test`
- Run `npm run test:mcp`
- Run `npm run test:integration`
