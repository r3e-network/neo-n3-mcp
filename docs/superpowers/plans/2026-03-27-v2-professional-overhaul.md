# Neo N3 MCP Server v2.0 — Professional Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Neo N3 MCP server from v1.7.3 (broken build, vendored deps, weak typing) into a professional, production-ready v2.0.0 npm package.

**Architecture:** Replace the vendored `neon-js` (which exports `any`) with the real `@cityofzion/neon-js@5.x` from npm, which ships proper TypeScript types. This single change eliminates the root cause of most `any` types. Then harden runtime (rate limiting, config validation, log rotation), clean the package surface, fix all tests, and update docs.

**Tech Stack:** TypeScript 5.8, Node.js >= 18, @cityofzion/neon-js 5.x, @modelcontextprotocol/sdk 1.26+, zod 3.24+, Jest 29

---

## Task 1: Replace Vendored neon-js with npm Package

**Files:**
- Modify: `package.json`
- Delete: `vendor/neon-js/` (entire directory)
- Modify: `.npmignore` (remove vendor references)
- Modify: `tsconfig.json` (if needed for new types)

This is the foundation — the vendored neon-js has `declare const neonJs: any; export = neonJs;` as its entire type definition. The real npm package ships proper types that will cascade type safety through the entire codebase.

- [ ] **Step 1: Check current neon-js API usage to understand compatibility needs**

Run: `grep -rn 'neonJs\.' src/ | head -80`

Document which neon-js APIs are used:
- `neonJs.rpc.RPCClient` — RPC client constructor
- `neonJs.wallet.Account` — account creation/import
- `neonJs.sc.*` — smart contract operations
- `neonJs.u.*` — utility functions (hex conversion, etc.)
- `neonJs.experimental.*` — experimental features (deployContract)

- [ ] **Step 2: Install the real neon-js from npm**

```bash
cd /home/neo/git/neo-n3-mcp
npm uninstall @cityofzion/neon-js
npm install @cityofzion/neon-js@5.8.1
```

- [ ] **Step 3: Remove the vendor directory**

```bash
rm -rf vendor/
```

- [ ] **Step 4: Update package.json — remove bundledDependencies and vendor reference**

Remove the `bundledDependencies` array entirely. The dependency line should now read:
```json
"@cityofzion/neon-js": "^5.8.1"
```
instead of `"file:vendor/neon-js"`.

- [ ] **Step 5: Update .npmignore — remove vendor references**

Remove any line referencing `vendor/` from `.npmignore`.

- [ ] **Step 6: Run type-check to see what breaks with real types**

```bash
npm run type-check 2>&1 | head -100
```

This will show us which neon-js API calls need updating for v5.x compatibility (the vendored version was 3.11.x). Document every error.

- [ ] **Step 7: Fix neon-js v3 → v5 API migration issues**

Common migration patterns from neon-js 3.x to 5.x:
- `new neonJs.rpc.RPCClient(url)` — likely same API
- `neonJs.wallet.Account` → check if constructor changed
- `neonJs.sc.createScript()` → may have new signature
- `neonJs.experimental.deployContract()` → check if still experimental
- `neonJs.u.HexString` → utility changes

Fix each compilation error, adapting to the v5 API. The neon-js changelog and types will guide this.

- [ ] **Step 8: Run type-check again to verify clean compilation**

```bash
npm run type-check
```

Expected: 0 errors. If errors remain, fix them before proceeding.

- [ ] **Step 9: Run unit tests**

```bash
npm run test:unit
```

Many tests mock neon-js extensively. Some mocks may need updating for v5 API shapes. Fix failing tests.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat!: replace vendored neon-js with @cityofzion/neon-js@5.x from npm

BREAKING CHANGE: neon-js is no longer bundled. It's now a regular npm
dependency, reducing package size and getting proper TypeScript types.

Migrates all API usage from neon-js 3.x to 5.x."
```

---

## Task 2: Eliminate Remaining `any` Types in Service Layer

**Files:**
- Create: `src/types/neo.ts`
- Modify: `src/services/neo-service.ts`
- Modify: `src/services/wallet-service.ts`
- Modify: `src/contracts/contract-service.ts`

After Task 1, many `any` types will be resolved by real neon-js types. This task handles the remaining ones — internal types for RPC responses, transfer history, application logs, etc.

- [ ] **Step 1: Audit remaining `any` types after Task 1**

```bash
grep -rn ': any' src/ | grep -v node_modules | grep -v '\.d\.ts'
```

Categorize each remaining `any` into:
1. Can be replaced with neon-js types (e.g., `Account`, `RPCClient`)
2. Needs a custom interface (RPC response shapes, transfer entries)
3. Should be `unknown` with type narrowing (external input)

- [ ] **Step 2: Create `src/types/neo.ts` with custom interfaces**

```typescript
/**
 * Custom type definitions for Neo N3 MCP Server
 * Types not provided by @cityofzion/neon-js
 */

/** NEP-17 transfer history entry from RPC getnep17transfers */
export interface Nep17TransferEntry {
  timestamp: number;
  assethash: string;
  transferaddress: string;
  amount: string;
  blockindex: number;
  transfernotifyindex: number;
  txhash: string;
}

/** NEP-17 transfers response from RPC */
export interface Nep17TransfersResponse {
  sent: Nep17TransferEntry[];
  received: Nep17TransferEntry[];
  address: string;
}

/** NEP-11 balance entry from RPC getnep11balances */
export interface Nep11BalanceEntry {
  assethash: string;
  tokens: Array<{
    tokenid: string;
    amount: string;
    lastupdatedblock: number;
  }>;
}

/** NEP-11 balances response from RPC */
export interface Nep11BalancesResponse {
  balance: Nep11BalanceEntry[];
  address: string;
}

/** NEP-11 transfer entry from RPC getnep11transfers */
export interface Nep11TransferEntry extends Nep17TransferEntry {
  tokenid?: string;
}

/** NEP-11 transfers response from RPC */
export interface Nep11TransfersResponse {
  sent: Nep11TransferEntry[];
  received: Nep11TransferEntry[];
  address: string;
}

/** Application log notification */
export interface AppLogNotification {
  contract: string;
  eventname: string;
  state: {
    type: string;
    value: unknown[];
  };
}

/** Application log execution */
export interface AppLogExecution {
  trigger: string;
  vmstate: string;
  exception: string | null;
  gasconsumed: string;
  stack: Array<{ type: string; value?: string | number | null }>;
  notifications: AppLogNotification[];
}

/** Application log response from RPC getapplicationlog */
export interface ApplicationLogResponse {
  txid: string;
  executions: AppLogExecution[];
}

/** Stack item from contract invocation result */
export interface StackItem {
  type: string;
  value?: string | number | boolean | null | StackItem[];
}

/** Balance result from getbalance-like operations */
export interface BalanceResult {
  address: string;
  balance: Array<{
    asset: string;
    symbol?: string;
    name?: string;
    amount: string;
    decimals?: number;
  }>;
}

/** Chain configuration from getversion RPC */
export interface ChainConfig {
  tcpport?: number;
  wsport?: number;
  nonce?: number;
  useragent?: string;
  protocol?: {
    addressversion?: number;
    network?: number;
    validatorscount?: number;
    msperblock?: number;
    maxtraceableblocks?: number;
    maxvaliduntilblockincrement?: number;
    maxtransactionsperblock?: number;
    memorypoolmaxtransactions?: number;
    initialgasdistribution?: number;
  };
}
```

- [ ] **Step 3: Replace `any` types in `neo-service.ts`**

Apply these replacements throughout the file:

1. `private rpcClient: any` → use the actual neon-js `RPCClient` type (import from neon-js)
2. `(item: any)` in normalizeHash160FromStackItem → `(item: StackItem)`
3. `(entry: any)` in transfer/balance methods → use `Nep17TransferEntry`, `Nep11BalanceEntry`, etc.
4. `(applicationLog: any)` → `ApplicationLogResponse`
5. `(transaction: any)` → use neon-js transaction type or `Record<string, unknown>`
6. `fromAccount: any` → import and use `Account` type from neon-js
7. `args: any[]` → `unknown[]` (will be converted to ContractParam internally)
8. `Promise<any>` return types → specific return types or `Promise<Record<string, unknown>>`
9. `catch (error: any)` → `catch (error: unknown)` with type narrowing

- [ ] **Step 4: Replace `any` types in `wallet-service.ts`**

1. `Promise<any>` returns → define specific return types using `WalletInfo` interface
2. `(account: any, password: string)` → use neon-js `Account` type
3. `(address: string, walletInfo: any)` → type the wallet info parameter

- [ ] **Step 5: Replace `any` types in `contract-service.ts`**

1. `private rpcClient: any` → neon-js `RPCClient` type
2. `contractState?: any` → define `ContractState` or use neon-js manifest types
3. `(method: any)` → use neon-js ABI method type
4. `(parameter: any)` → use neon-js method parameter type
5. `args: any[]` → `unknown[]`
6. `fromAccount: any` → neon-js `Account` type
7. `manifest: any` → `Record<string, unknown>` or neon-js manifest type

- [ ] **Step 6: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 7: Run tests**

```bash
npm run test:unit
```

Expected: all tests pass. Fix any that break due to type changes.

- [ ] **Step 8: Commit**

```bash
git add src/types/neo.ts src/services/ src/contracts/
git commit -m "refactor: eliminate all any types in service layer

Create src/types/neo.ts with custom interfaces for RPC responses,
transfer history, application logs, and balance results.

Replace every 'any' in neo-service, wallet-service, and
contract-service with proper types from neon-js or custom interfaces."
```

---

## Task 3: Eliminate `any` Types in Handlers, HTTP, and Utils

**Files:**
- Modify: `src/handlers/tool-handler.ts`
- Modify: `src/index.ts`
- Modify: `src/http-server.ts`
- Modify: `src/utils/error-handler.ts`
- Modify: `src/utils/logger.ts`
- Modify: `src/utils/rate-limiter.ts`
- Modify: `src/utils/cache.ts`

- [ ] **Step 1: Fix `any` types in `tool-handler.ts`**

1. `async function handleXxx(input: any, ...)` → `input: Record<string, unknown>`
2. `Promise<any>` returns → define `ToolResult` type: `{ content: Array<{ type: string; text: string }>; isError?: boolean }`
3. `catch (error: any)` → `catch (error: unknown)`
4. `export async function callTool(name: string, input: any, ...)` → `input: Record<string, unknown>`

- [ ] **Step 2: Fix `any` types in `index.ts`**

1. `handler: (args: any) => Promise<any>` → `handler: (args: Record<string, unknown>) => Promise<ToolResult>`
2. All `catch (error: any)` → `catch (error: unknown)` with `error instanceof Error ? error.message : String(error)` pattern

- [ ] **Step 3: Fix `any` types in `http-server.ts`**

1. `let body: any = {}` → `let body: Record<string, unknown> = {}`
2. `let result: any` → `let result: Record<string, unknown> | string`
3. Remove `(this.contractService as any)` casts — add proper method signatures to ContractService or use type narrowing

- [ ] **Step 4: Fix `any` types in utils**

In `error-handler.ts`:
1. `handleError(error: any)` → `handleError(error: unknown)`
2. `createSuccessResponse(data: any)` → `createSuccessResponse(data: unknown)`
3. `createToolResponse(data: any)` → `createToolResponse(data: unknown)`

In `logger.ts`:
1. `(config as any)?.logging` → remove cast, access `config.logging` directly (it exists on the config object)
2. `context?: Record<string, any>` → `context?: Record<string, unknown>`

In `rate-limiter.ts`:
1. `(config as any)?.security` → fix to use `config.rateLimiting` directly (the config object has this field)

In `cache.ts`:
1. `new Cache<any>(...)` → use specific types for each cache instance

- [ ] **Step 5: Verify zero `any` in src/**

```bash
grep -rn ': any' src/ | grep -v node_modules | grep -v '\.d\.ts' | grep -v '// any ok:'
```

Expected: 0 matches.

- [ ] **Step 6: Run full type-check and tests**

```bash
npm run type-check && npm run test:unit
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "refactor: eliminate all any types in handlers, HTTP server, and utils

Zero 'any' types remaining in production code. All external data
enters as 'unknown' with proper type narrowing."
```

---

## Task 4: Integrate Rate Limiting into Request Pipeline

**Files:**
- Modify: `src/utils/rate-limiter.ts` (fix config access)
- Modify: `src/http-server.ts` (add rate limit check)
- Modify: `src/handlers/tool-handler.ts` (add rate limit check)
- Create: `tests/rate-limiter-integration.test.ts`

- [ ] **Step 1: Write integration test for rate limiting**

```typescript
// tests/rate-limiter-integration.test.ts
import { RateLimiter } from '../src/utils/rate-limiter';

describe('Rate Limiter Integration', () => {
  it('allows requests under the limit', () => {
    const limiter = new RateLimiter(5, 60000, true);
    for (let i = 0; i < 5; i++) {
      expect(limiter.checkLimit('test-client')).toBe(true);
    }
  });

  it('throws RateLimitError when limit exceeded', () => {
    const limiter = new RateLimiter(3, 60000, true);
    limiter.checkLimit('test-client');
    limiter.checkLimit('test-client');
    limiter.checkLimit('test-client');
    expect(() => limiter.checkLimit('test-client')).toThrow('Rate limit exceeded');
  });

  it('does not limit when disabled', () => {
    const limiter = new RateLimiter(1, 60000, false);
    expect(limiter.checkLimit('test-client')).toBe(true);
    expect(limiter.checkLimit('test-client')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (rate-limiter module may have import issues)**

```bash
npx jest tests/rate-limiter-integration.test.ts --no-coverage
```

- [ ] **Step 3: Fix rate-limiter.ts config access**

Replace the broken config access at the bottom of `src/utils/rate-limiter.ts`:

```typescript
// Replace lines 154-168 with:
export const rateLimiter = new RateLimiter(
  config.rateLimiting.maxRequestsPerMinute,
  60000, // 1 minute window
  config.rateLimiting.enabled
);
```

- [ ] **Step 4: Add rate limit check to HTTP server**

In `src/http-server.ts`, add rate limiting at the top of the request handler:

```typescript
import { rateLimiter } from './utils/rate-limiter';

// Inside the request handler, before route matching:
const clientIp = req.socket.remoteAddress || 'unknown';
try {
  rateLimiter.checkLimit(clientIp);
} catch (error) {
  if (error instanceof RateLimitError) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(error.context?.retryAfter || 60) });
    res.end(JSON.stringify({ error: error.message }));
    return;
  }
}
```

- [ ] **Step 5: Add rate limit check to tool handler**

In `src/handlers/tool-handler.ts`, add rate limiting at the top of `callTool`:

```typescript
import { rateLimiter } from '../utils/rate-limiter';

// Inside callTool, before tool execution:
rateLimiter.checkLimit('mcp-client');
```

- [ ] **Step 6: Run tests**

```bash
npx jest tests/rate-limiter-integration.test.ts --no-coverage && npm run test:unit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/rate-limiter.ts src/http-server.ts src/handlers/tool-handler.ts tests/rate-limiter-integration.test.ts
git commit -m "feat: integrate rate limiting into HTTP and MCP request pipelines

Rate limiter was defined but never called. Now enforced on both
HTTP requests (by client IP) and MCP tool calls."
```

---

## Task 5: Add Config Validation at Startup

**Files:**
- Modify: `src/config.ts`
- Create: `tests/config-validation.test.ts`

- [ ] **Step 1: Write failing test for config validation**

```typescript
// tests/config-validation.test.ts
describe('Config Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts valid configuration', () => {
    process.env.NEO_NETWORK = 'mainnet';
    process.env.LOG_LEVEL = 'debug';
    expect(() => {
      jest.isolateModules(() => {
        const { validateConfig } = require('../src/config');
        validateConfig();
      });
    }).not.toThrow();
  });

  it('rejects invalid LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'verbose';
    expect(() => {
      jest.isolateModules(() => {
        const { validateConfig } = require('../src/config');
        validateConfig();
      });
    }).toThrow(/LOG_LEVEL/);
  });

  it('rejects non-numeric MAX_REQUESTS_PER_MINUTE', () => {
    process.env.MAX_REQUESTS_PER_MINUTE = 'abc';
    expect(() => {
      jest.isolateModules(() => {
        const { validateConfig } = require('../src/config');
        validateConfig();
      });
    }).toThrow(/MAX_REQUESTS_PER_MINUTE/);
  });

  it('rejects invalid RPC URL format', () => {
    process.env.NEO_MAINNET_RPC = 'not-a-url';
    expect(() => {
      jest.isolateModules(() => {
        const { validateConfig } = require('../src/config');
        validateConfig();
      });
    }).toThrow(/NEO_MAINNET_RPC/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/config-validation.test.ts --no-coverage
```

Expected: FAIL — `validateConfig` does not exist.

- [ ] **Step 3: Implement `validateConfig()` in `src/config.ts`**

Add at the bottom of `src/config.ts`:

```typescript
/**
 * Validate configuration values at startup.
 * Throws descriptive errors for invalid values.
 */
export function validateConfig(): void {
  // Validate LOG_LEVEL
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (process.env.LOG_LEVEL && !validLogLevels.includes(process.env.LOG_LEVEL.toLowerCase())) {
    throw new Error(
      `Invalid LOG_LEVEL "${process.env.LOG_LEVEL}". Must be one of: ${validLogLevels.join(', ')}`
    );
  }

  // Validate numeric rate limiting values
  if (process.env.MAX_REQUESTS_PER_MINUTE && isNaN(Number(process.env.MAX_REQUESTS_PER_MINUTE))) {
    throw new Error(
      `Invalid MAX_REQUESTS_PER_MINUTE "${process.env.MAX_REQUESTS_PER_MINUTE}". Must be a number.`
    );
  }

  if (process.env.MAX_REQUESTS_PER_HOUR && isNaN(Number(process.env.MAX_REQUESTS_PER_HOUR))) {
    throw new Error(
      `Invalid MAX_REQUESTS_PER_HOUR "${process.env.MAX_REQUESTS_PER_HOUR}". Must be a number.`
    );
  }

  // Validate RPC URLs
  const urlPattern = /^https?:\/\/.+/;
  const mainnetRpc = readEnv('NEO_MAINNET_RPC', 'NEO_MAINNET_RPC_URL');
  if (mainnetRpc && !urlPattern.test(mainnetRpc)) {
    throw new Error(
      `Invalid NEO_MAINNET_RPC "${mainnetRpc}". Must be a valid HTTP/HTTPS URL.`
    );
  }

  const testnetRpc = readEnv('NEO_TESTNET_RPC', 'NEO_TESTNET_RPC_URL');
  if (testnetRpc && !urlPattern.test(testnetRpc)) {
    throw new Error(
      `Invalid NEO_TESTNET_RPC "${testnetRpc}". Must be a valid HTTP/HTTPS URL.`
    );
  }
}
```

- [ ] **Step 4: Call `validateConfig()` from server entry points**

In `src/index.ts`, add near the top (after imports):
```typescript
import { config, NetworkMode, validateConfig } from './config';

// Validate configuration before starting
validateConfig();
```

In `src/http.ts`, add the same call.

- [ ] **Step 5: Run tests**

```bash
npx jest tests/config-validation.test.ts --no-coverage && npm run test:unit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/index.ts src/http.ts tests/config-validation.test.ts
git commit -m "feat: validate configuration at startup with clear error messages

Server now fails fast with descriptive errors for invalid LOG_LEVEL,
non-numeric rate limits, and malformed RPC URLs."
```

---

## Task 6: Implement Log Rotation

**Files:**
- Modify: `src/utils/logger.ts`
- Create: `tests/log-rotation.test.ts`

- [ ] **Step 1: Write failing test for log rotation**

```typescript
// tests/log-rotation.test.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Log Rotation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-log-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rotates log file when it exceeds max size', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');

    // Create a file larger than threshold
    fs.writeFileSync(logPath, 'x'.repeat(1024));

    rotateLogFile(logPath, 512, 3);

    expect(fs.existsSync(logPath + '.1')).toBe(true);
    // Original should be gone or empty (new stream will create it)
  });

  it('cascades rotation (1→2, 2→3)', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');

    // Create existing rotated files
    fs.writeFileSync(logPath, 'current');
    fs.writeFileSync(logPath + '.1', 'previous');

    rotateLogFile(logPath, 0, 3);

    expect(fs.readFileSync(logPath + '.2', 'utf-8')).toBe('previous');
    expect(fs.readFileSync(logPath + '.1', 'utf-8')).toBe('current');
  });

  it('deletes oldest file beyond maxFiles', () => {
    const { rotateLogFile } = require('../src/utils/logger');
    const logPath = path.join(tmpDir, 'test.log');

    fs.writeFileSync(logPath, 'current');
    fs.writeFileSync(logPath + '.1', 'one');
    fs.writeFileSync(logPath + '.2', 'two');
    fs.writeFileSync(logPath + '.3', 'three');

    rotateLogFile(logPath, 0, 3);

    expect(fs.existsSync(logPath + '.3')).toBe(true);
    expect(fs.existsSync(logPath + '.4')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/log-rotation.test.ts --no-coverage
```

Expected: FAIL — `rotateLogFile` does not exist.

- [ ] **Step 3: Implement `rotateLogFile` in `src/utils/logger.ts`**

Add before the Logger class:

```typescript
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES = 3;

/**
 * Rotate log file: current → .1 → .2 → .3 (oldest deleted)
 */
export function rotateLogFile(
  logPath: string,
  maxSize: number = MAX_LOG_SIZE,
  maxFiles: number = MAX_LOG_FILES
): void {
  try {
    if (!fs.existsSync(logPath)) return;

    const stats = fs.statSync(logPath);
    if (stats.size < maxSize) return;

    // Cascade: .2→.3, .1→.2, current→.1
    for (let i = maxFiles; i >= 1; i--) {
      const from = i === 1 ? logPath : `${logPath}.${i - 1}`;
      const to = `${logPath}.${i}`;
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
    }

    // Delete anything beyond maxFiles
    const beyond = `${logPath}.${maxFiles + 1}`;
    if (fs.existsSync(beyond)) {
      fs.unlinkSync(beyond);
    }
  } catch (error) {
    console.error(`Log rotation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

Then in the Logger's `log()` method, add a rotation check (amortized — every 100 writes):

```typescript
private writeCount = 0;

// Inside the log() method, after writing to file:
this.writeCount++;
if (this.writeCount % 100 === 0) {
  rotateLogFile(this.logFilePath);
  // If rotated, reopen the stream
  if (!fs.existsSync(this.logFilePath)) {
    this.logStream?.end();
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/log-rotation.test.ts --no-coverage && npm run test:unit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/logger.ts tests/log-rotation.test.ts
git commit -m "feat: implement log rotation (10MB max, 3 rotated files)

Checks file size every 100 writes and cascades rotation:
current → .1 → .2 → .3 (oldest deleted)."
```

---

## Task 7: Clean Package Surface

**Files:**
- Modify: `package.json`
- Modify: `.npmignore`
- Modify: `tests/package-surface.test.ts`

- [ ] **Step 1: Update package.json for v2.0**

```json
{
  "version": "2.0.0",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

Changes:
- Version → `2.0.0`
- Remove `config/docker.json` and `examples/core-functionality.js` from `files` (these are dev artifacts, not needed by npm consumers)
- Remove `bundledDependencies` entirely (neon-js is a normal dep now)
- Add `"author"` field if desired

- [ ] **Step 2: Verify npm pack output**

```bash
npm pack --dry-run 2>&1
```

Expected: only `dist/`, `README.md`, `LICENSE`, `package.json` in the tarball. No vendor/, docs/, tests/, examples/.

- [ ] **Step 3: Update `tests/package-surface.test.ts`**

Update the test to reflect v2.0 expectations:
- Remove checks for bundled neon-js
- Remove checks for `config/docker.json` and `examples/`
- Verify dist/ files are present
- Verify no vendor/ files included

- [ ] **Step 4: Verify shebang is preserved in build**

```bash
npm run build
head -1 dist/index.js
```

Expected: `#!/usr/bin/env node`

- [ ] **Step 5: Test npx simulation**

```bash
node dist/index.js --help 2>&1 || true
# Should at least not crash with "module not found" errors
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:unit
```

- [ ] **Step 7: Commit**

```bash
git add package.json .npmignore tests/package-surface.test.ts
git commit -m "feat!: clean package surface for v2.0.0

BREAKING CHANGE: version bumped to 2.0.0. Package no longer bundles
neon-js or ships config/examples in the npm tarball."
```

---

## Task 8: Fix and Verify All Tests

**Files:**
- Modify: various test files that reference vendored neon-js or broken types
- Modify: `tests/mcp-build-smoke.test.ts` (if build output changed)
- Modify: `tests/documentation-surface.test.ts` (if doc counts changed)

- [ ] **Step 1: Run full test suite and catalog failures**

```bash
npm run build && npm run test:all 2>&1 | tail -50
```

Document every failing test.

- [ ] **Step 2: Fix unit test failures**

Most likely failures:
- Tests mocking neon-js 3.x API shapes that changed in 5.x
- Tests expecting vendored neon-js behavior
- Tests checking package-surface for bundled vendor files

Fix each failing test to match the new v2.0 reality.

- [ ] **Step 3: Fix MCP smoke test**

```bash
npm run test:mcp:smoke
```

The smoke test spawns `dist/index.js` — ensure it works with the new neon-js dependency.

- [ ] **Step 4: Run MCP protocol tests**

```bash
npm run test:mcp 2>&1 | tail -30
```

Fix any failures.

- [ ] **Step 5: Run full test suite one final time**

```bash
npm run test:all
```

Expected: 0 failures.

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "test: fix all tests for v2.0 (neon-js 5.x, new types, clean surface)"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/PRODUCTION_READINESS_REPORT.md`
- Create: `docs/MIGRATION.md`

- [ ] **Step 1: Update README.md**

Changes needed:
- Update version references to 2.0.0
- Remove references to vendored neon-js
- Add troubleshooting section:
  ```markdown
  ## Troubleshooting

  ### Installation Issues
  - **neon-js fails to install**: Ensure you have Node.js >= 18. Run `npm cache clean --force` and retry.
  - **TypeScript errors**: This package ships with type definitions. Ensure your `@types/node` version matches your Node.js version.

  ### Runtime Issues
  - **"Rate limit exceeded"**: The server enforces rate limits (default: 60 req/min). Configure with `MAX_REQUESTS_PER_MINUTE`.
  - **"Invalid configuration"**: Check your environment variables. The server validates config at startup and will print which value is wrong.
  - **RPC connection errors**: Verify your RPC URL is reachable. Default mainnet: `https://mainnet1.neo.coz.io:443`
  ```
- Verify tool count is still 27 (or update if changed)

- [ ] **Step 2: Update CHANGELOG.md**

Add v2.0.0 entry at top:
```markdown
## [2.0.0] - 2026-03-27

### Breaking Changes
- Replaced vendored neon-js 3.x with `@cityofzion/neon-js@5.x` from npm
- Configuration validation now rejects invalid values at startup
- Rate limiting now enforced (was previously configured but ignored)
- Package no longer bundles neon-js or ships config/examples in npm tarball

### Improvements
- Full TypeScript type safety — zero `any` types in production code
- Proper neon-js types flow through entire codebase
- Rate limiting integrated into HTTP and MCP request pipelines
- Log rotation (10MB max, 3 rotated files)
- Config validation at startup with clear error messages
- Clean npm package surface (only dist/, README, LICENSE)

### Fixes
- Fixed rate limiter config access (was reading wrong config path)
- Fixed logger config access (was casting config to any)
```

- [ ] **Step 3: Update PRODUCTION_READINESS_REPORT.md**

Replace the stale v1.4.0 content with a v2.0.0 assessment reflecting current state.

- [ ] **Step 4: Create docs/MIGRATION.md**

```markdown
# Migration Guide: v1.x → v2.0

## Breaking Changes

### 1. neon-js Dependency
**Before:** neon-js was vendored and bundled in the npm package.
**After:** neon-js is a regular npm dependency (`@cityofzion/neon-js@5.x`).

**Action:** No action needed for most users. `npm install` will fetch neon-js automatically.

### 2. Configuration Validation
**Before:** Invalid env vars silently ignored.
**After:** Server fails fast with descriptive error for invalid values.

**Action:** Check your environment variables. In particular:
- `LOG_LEVEL` must be one of: debug, info, warn, error
- `MAX_REQUESTS_PER_MINUTE` must be a number
- RPC URLs must be valid HTTP/HTTPS URLs

### 3. Rate Limiting Enforcement
**Before:** Rate limiter was defined but never called.
**After:** Rate limiting is enforced on all requests.

**Action:** If you were relying on unlimited requests, set `RATE_LIMITING_ENABLED=false` or increase `MAX_REQUESTS_PER_MINUTE`.
```

- [ ] **Step 5: Clean up stale plan docs**

The git status shows 13 modified plan files under `docs/plans/`. These are internal development artifacts that shouldn't ship or clutter the repo. Either:
- Reset them: `git checkout -- docs/plans/`
- Or if they're truly stale, consider adding `docs/plans/` to `.gitignore`

- [ ] **Step 6: Commit**

```bash
git add README.md docs/
git commit -m "docs: update all documentation for v2.0.0

Add troubleshooting section, migration guide, updated changelog,
and refreshed production readiness report."
```

---

## Task 10: HTTP Server Cleanup (Deprioritized)

**Files:**
- Modify: `src/http-server.ts`

- [ ] **Step 1: Verify HTTP server compiles and basic routes work**

```bash
npm run type-check
```

Check that `src/http-server.ts` has no type errors after previous tasks.

- [ ] **Step 2: Remove any remaining `as any` casts**

If Task 3 left any casts in http-server.ts, resolve them properly now.

- [ ] **Step 3: Verify health and metrics endpoints**

```bash
# Start HTTP server in background
node dist/http.js &
HTTP_PID=$!
sleep 2

# Test health
curl -s http://localhost:3000/health | head -5

# Test metrics
curl -s http://localhost:3000/metrics | head -5

kill $HTTP_PID
```

- [ ] **Step 4: Commit if any changes were needed**

```bash
git add src/http-server.ts
git commit -m "fix: clean up HTTP server types and verify endpoints"
```

---

## Task 11: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Clean build from scratch**

```bash
rm -rf node_modules dist
npm install
npm run build
```

Expected: clean install and build with zero errors.

- [ ] **Step 2: Full test suite**

```bash
npm run test:all
```

Expected: all tests pass.

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Zero `any` audit**

```bash
grep -rn ': any' src/ | grep -v node_modules | grep -v '\.d\.ts'
```

Expected: 0 matches (or only in clearly documented exceptions).

- [ ] **Step 5: Package check**

```bash
npm pack --dry-run
```

Expected: clean tarball with only dist/, README.md, LICENSE, package.json.

- [ ] **Step 6: MCP smoke test**

```bash
npm run test:mcp:smoke
```

Expected: passes.

- [ ] **Step 7: Commit any remaining fixes and tag**

```bash
git add -A
git status
# If clean, tag the release:
git tag v2.0.0
```
