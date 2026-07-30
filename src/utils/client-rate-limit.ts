// src/utils/client-rate-limit.ts
//
// --- Per-client rate-limit keying ---
//
// `rateLimiter` (src/utils/rate-limiter.ts) is a process-wide singleton, so the
// key handed to `checkLimit` decides who shares a bucket.
//
// MCP 2026-07-28 is stateless: the HTTP entry builds a fresh `NeoMcpServer` for
// every request. The HTTP factory binds each instance's scope to a stable,
// privacy-preserving client key derived at the trusted proxy boundary. The
// stdio server builds one instance and keeps one implicit client bucket.
//
// Every charge site in one request/connection passes that SAME scope object, so it
// shares exactly ONE bucket across all of them:
//   - the registration-inlined read/write tools (src/index.ts),
//   - the delegated/analytical tools (via callTool in tool-handler.ts),
//   - the resource reads (src/handlers/resource-handler.ts).

import { rateLimiter } from './rate-limiter';

/**
 * Bucket used only when no per-client scope is available. In practice every MCP
 * entrypoint supplies a scope; this is a defensive fallback, not a code path any
 * client is expected to take.
 */
const RATE_LIMIT_FALLBACK_KEY = 'mcp-client';

// Object-identity -> bucket key. Completed requests/connections are collected
// with their `NeoMcpServer`; the mapping never needs manual eviction.
const clientRateLimitKeys = new WeakMap<object, string>();
let clientRateLimitKeySeq = 0;

/**
 * Resolve a stable rate-limit bucket key for a request/connection scope.
 *
 * @param scope A per-request or per-connection object. The same object always maps to the same
 *   key; distinct objects get distinct keys. Falls back to a shared constant
 *   only when no scope object is available.
 */
export function resolveRateLimitKey(scope: object | undefined): string {
  if (!scope) {
    return RATE_LIMIT_FALLBACK_KEY;
  }
  let key = clientRateLimitKeys.get(scope);
  if (key === undefined) {
    clientRateLimitKeySeq += 1;
    key = `mcp-client-${clientRateLimitKeySeq}`;
    clientRateLimitKeys.set(scope, key);
  }
  return key;
}

/**
 * Bind a stable client identifier to a request/connection scope so separate
 * stateless server instances for the same client share one process-wide bucket.
 *
 * First-writer-wins and idempotent: if the scope already has a key (for example
 * a synthetic one minted by an earlier charge), it is kept so the client can
 * never split across two buckets. A no-op without a scope or id — the stdio path,
 * where a single implicit client needs no explicit identifier.
 */
export function bindRateLimitClientId(scope: object | undefined, clientId: string | undefined): void {
  if (!scope || !clientId) {
    return;
  }
  if (!clientRateLimitKeys.has(scope)) {
    clientRateLimitKeys.set(scope, `mcp-client:${clientId}`);
  }
}

/**
 * Charge one request against the client bucket for `scope`. Throws
 * `RateLimitError` when the client's window is exhausted. Consolidates the
 * charge so every MCP entrypoint bills the same bucket the same way.
 */
export function chargeClientRateLimit(scope: object | undefined): void {
  rateLimiter.checkLimit(resolveRateLimitKey(scope));
}
