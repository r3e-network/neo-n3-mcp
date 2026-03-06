# HTTP Parity Routes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the missing HTTP parity surface for transfer execution, fee estimation, GAS claiming, and flexible block lookup so the REST API matches the shipped MCP tool surface more closely.

**Architecture:** Extend `HttpServer` with a small set of explicit REST routes that delegate directly to the same `NeoService` and `ContractService` methods already used by MCP. Keep response and confirmation semantics aligned with MCP/HTTP behavior already established in this repo, and cover each route with focused Jest tests before implementation.

**Tech Stack:** TypeScript, Jest, Node `http`, `@cityofzion/neon-js`

### Task 1: Add failing HTTP route tests
- Modify `tests/http-server.test.ts`
- Add coverage for block lookup by hash through `GET /api/blocks/:hashOrHeight`
- Add coverage for `POST /api/transfers`
- Add coverage for `POST /api/transfers/estimate-fees`
- Add coverage for `POST /api/contracts/invoke/estimate-fees`
- Add coverage for `POST /api/accounts/claim-gas`
- Verify the new tests fail for missing routes or wrong behavior

### Task 2: Implement HTTP parity routes
- Modify `src/http-server.ts`
- Expand block lookup route to accept either numeric height or hash
- Add `POST /api/transfers` with `confirm=true` enforcement
- Add `POST /api/transfers/estimate-fees`
- Add `POST /api/contracts/invoke/estimate-fees`
- Add `POST /api/accounts/claim-gas` with `confirm=true` enforcement
- Reuse existing services and preserve current error handling style

### Task 3: Document the new REST surface
- Modify `README.md`
- Modify `docs/API.md`
- Modify `docs/DEPLOYMENT.md`
- Modify `docs/TESTING.md`
- Document the new endpoints and required request fields

### Task 4: Verify end-to-end
- Run `npx jest tests/http-server.test.ts --runInBand`
- Run `npm run type-check`
- Run `npm run build`
- Run `npm test`
- Run `npm run test:mcp`
- Run `npm run test:integration`
