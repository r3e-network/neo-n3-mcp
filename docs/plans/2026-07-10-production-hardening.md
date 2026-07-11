# Neo N3 MCP Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before reporting success.

**Goal:** Make the v2.0 server's tested, packaged, HTTP, and container surfaces match its production-readiness claims.

**Architecture:** Preserve the current service and MCP contracts. Harden configuration and HTTP boundaries at the entrypoint, make wallet persistence defensive and test-isolated, update dependencies within supported release lines, and remove legacy or generated files that are outside the published API.

**Tech Stack:** TypeScript 5, Node.js 22+, Jest 29, MCP TypeScript SDK 1.x, neon-js 5.x, Docker Compose.

---

### Task 1: Lock HTTP Boundary Behavior

**Files:**
- Modify: `tests/http-server.test.ts`
- Modify: `tests/config-validation.test.ts`
- Modify: `tests/server-init.test.ts`

- [ ] Add a request helper that can set headers and send oversized or malformed payloads.
- [ ] Add failing tests proving API-key authentication rejects missing and incorrect bearer tokens.
- [ ] Add failing tests proving health checks remain available without credentials.
- [ ] Add failing tests for non-JSON content, non-object JSON, malformed JSON, and bodies above the configured byte limit.
- [ ] Add failing tests for host, API-key, CORS, wallet-directory, and body-limit configuration validation.
- [ ] Run the targeted tests and confirm each new expectation fails for the intended missing behavior.

### Task 2: Harden HTTP and Configuration

**Files:**
- Modify: `src/config.ts`
- Modify: `src/http.ts`
- Modify: `src/http-server.ts`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] Add typed HTTP configuration with loopback-default binding, optional bearer authentication, explicit CORS origins, and a bounded JSON body size.
- [ ] Require an API key when the HTTP entrypoint binds to a non-loopback host.
- [ ] Compare bearer credentials with constant-time byte comparison.
- [ ] Return stable JSON errors with `400`, `401`, `413`, and `415` status codes for invalid requests.
- [ ] Apply no-store and content-type hardening headers and emit CORS headers only for configured origins.
- [ ] Run the targeted HTTP and configuration tests until green.

### Task 3: Harden and Isolate Wallet Persistence

**Files:**
- Modify: `tests/wallet-service.test.ts`
- Modify: `tests/mcp-test-utils.ts`
- Modify: `src/services/wallet-service.ts`
- Modify: `src/index.ts`
- Modify: `src/http.ts`

- [ ] Add failing tests for traversal-like wallet identifiers, private directory permissions, and atomic file replacement.
- [ ] Validate wallet addresses before constructing paths.
- [ ] create the wallet directory with owner-only permissions and write wallet files atomically with mode `0600`.
- [ ] Route the configured wallet directory into both entrypoints.
- [ ] Give spawned MCP test servers an isolated temporary wallet directory and remove it during teardown.
- [ ] Run wallet, MCP utility, and HTTP tests until green.

### Task 4: Secure Dependencies and Supported Runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `jest.config.js`
- Delete: `babel.config.cjs`

- [ ] Remove unused Axios and Babel test dependencies.
- [ ] Update neon-js, the MCP SDK, Zod 3, TypeScript 5, ts-jest, and Node typings within their existing major release lines.
- [ ] Set the supported runtime floor to Node.js 22.
- [ ] Regenerate the lockfile and run `npm audit` plus `npm audit --omit=dev`.
- [ ] Run typecheck, unit tests, deterministic MCP tests, build, and package dry-run.

### Task 5: Repair Docker, CI, and Release Gates

**Files:**
- Modify: `docker/Dockerfile`
- Modify: `docker/Dockerfile.dev`
- Modify: `docker/docker-compose.yml`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/docker-build.sh`
- Modify: `scripts/docker-run.sh`
- Modify: `scripts/prepare-release.sh`
- Modify: `package.json`
- Delete: `config/docker.json`

- [ ] Remove references to the deleted `vendor/` tree and use Node.js 22 images.
- [ ] Correct Compose contexts, Dockerfile paths, bind mounts, and HTTP host/API-key settings.
- [ ] Remove obsolete Compose syntax, insecure example credentials, unused volumes, and placeholder deployment behavior.
- [ ] Make CI test failures fatal and replace duplicate transient audit tooling with the repository's audited lockfile gate.
- [ ] Separate live stress tests from deterministic `test:mcp` and `test:all` commands.
- [ ] Verify Compose rendering and build the production image from the repository root.

### Task 6: Delete Proven Dead and Generated Files

**Files:**
- Modify: `src/handlers/tool-handler.ts`
- Modify: `src/handlers/index.ts`
- Delete: `src/utils/cache.ts`
- Delete: root `fix-*.js`, `skip-*.js`, test-output text/log files, and `tools-dump.json`
- Modify: `.gitignore`

- [ ] Remove the unused low-level tool registration implementation after confirming no production import or package export reaches it.
- [ ] Remove unused cache exports after confirming no imports.
- [ ] Delete one-off repair scripts and checked-in command output that have no references.
- [ ] Ignore local diagnostic output patterns without hiding source fixtures.
- [ ] Re-run package-surface tests to prove the published API and tarball remain intact.

### Task 7: Final Verification and Review

**Files:**
- Modify only files required by review findings.

- [ ] Run `git diff --check` and `npm ci`.
- [ ] Run `npm run type-check`, `npm run test:unit -- --runInBand`, `npm run test:mcp`, and `npm run build`.
- [ ] Run `npm audit`, `npm audit --omit=dev`, and `npm pack --dry-run --json`.
- [ ] Run Docker Compose config checks, the production image build, and its health check.
- [ ] Review the complete diff for correctness, secrets, error leakage, dependency risk, and documentation drift.
- [ ] Fix any blocking findings and repeat the affected gates.

### Task 8: Remove Unverifiable Curated Integrations

**Files:**
- Modify: `src/contracts/contracts.ts`
- Modify: `src/index.ts`
- Modify: related contract/tool tests and current user-facing documentation

- [ ] Add failing registration and contract-catalog tests that reject the stale NeoFS, Flamingo, NeoCompound, GrandShare, GhostMarket, and NeoBurger surfaces.
- [ ] Delete unverified contract hashes, known-account labels, specialized service methods, and NeoFS MCP tools.
- [ ] Keep generic contract lookup and invocation available through an explicit script hash or address plus live manifest discovery.
- [ ] Run focused catalog, tool-registration, contract-service, and package-surface tests.

### Task 9: Bound Neo RPC Execution

**Files:**
- Modify: `src/config.ts`
- Modify: `src/services/neo-service.ts`
- Modify: related configuration and service tests

- [ ] Add failing tests proving a never-settling RPC rejects within the configured deadline without leaving a process-retaining timer.
- [ ] Add one reusable RPC deadline boundary and apply it to normal Neo and contract RPC calls.
- [ ] Preserve transaction polling semantics while ensuring each individual RPC attempt is bounded.
- [ ] Validate the timeout configuration and document its operator-facing behavior.

### Task 10: Reconcile Current Documentation and Release Surfaces

**Files:**
- Modify: `docs/RELEASE_GUIDE.md`
- Modify: `docs/WORKFLOW.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/PRODUCTION_READINESS_REPORT.md`
- Modify: current files under `website/docs/`

- [ ] Remove Node 18/20, obsolete Compose/test assets, unauthenticated metrics, fake monitoring, stale tool counts, and unsupported curated-contract claims.
- [ ] Keep historical changelogs, plans, and specifications unchanged.
- [ ] Verify relative links, npm scripts, documented files, and package/runtime versions against the repository.

## Explicit Non-Goals

- Rewriting Neo RPC, contract invocation, or transaction construction that already has regression coverage.
- Adding an HTTP framework, authentication dependency, database, or external secret manager.
- Changing tool names or Neo transaction semantics.
- Claiming live Neo RPC availability from deterministic CI; live stress checks remain explicit opt-in verification.
