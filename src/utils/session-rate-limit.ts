// src/utils/session-rate-limit.ts
//
// --- Per-session rate-limit keying ---
//
// `rateLimiter` (src/utils/rate-limiter.ts) is a process-wide singleton, so the
// key handed to `checkLimit` decides who shares a bucket. Charging one constant
// string ('mcp-client') meant that over the Streamable HTTP transport EVERY MCP
// session in the process drained ONE ~60 req/min bucket and starved the others,
// while under stdio it harmlessly named "the single client that spawned me".
//
// Each HTTP session gets its own `NeoMcpServer` (src/mcp-http-server.ts), and
// every `NeoMcpServer` builds its own `neoServices` Map (src/index.ts). The
// stdio server builds exactly one. Keying the bucket by that Map's object
// identity therefore gives each HTTP session an independent bucket and keeps the
// single stdio client on one stable bucket — its previous behavior, unchanged.
//
// Every charge site in a session passes that SAME scope object, so a session
// shares exactly ONE bucket across all of them:
//   - the registration-inlined read/write tools (src/index.ts),
//   - the delegated/analytical tools (via callTool in tool-handler.ts),
//   - the resource reads (src/handlers/resource-handler.ts).
//
// When the Streamable HTTP transport learns the real MCP session id it binds it
// to the scope (see `bindRateLimitSessionId`), so the bucket is named by the
// session id in rate-limit logs. The stdio entrypoint never binds one and falls
// back to a stable synthetic id, which is all a single implicit client needs.

import { rateLimiter } from './rate-limiter';

/**
 * Bucket used only when no per-session scope is available. In practice every MCP
 * entrypoint supplies a scope; this is a defensive fallback, not a code path any
 * session is expected to take.
 */
const RATE_LIMIT_FALLBACK_KEY = 'mcp-client';

// Object-identity → bucket key. A WeakMap so a closed session's entry is garbage
// collected with its `NeoMcpServer`; the mapping never needs manual eviction.
const sessionRateLimitKeys = new WeakMap<object, string>();
let sessionRateLimitKeySeq = 0;

/**
 * Resolve a stable, per-session rate-limit bucket key for a session scope (the
 * connection's `neoServices` Map).
 *
 * @param scope A per-session object. The same object always maps to the same
 *   key; distinct objects get distinct keys. Falls back to a shared constant
 *   only when no scope object is available.
 */
export function resolveRateLimitKey(scope: object | undefined): string {
  if (!scope) {
    return RATE_LIMIT_FALLBACK_KEY;
  }
  let key = sessionRateLimitKeys.get(scope);
  if (key === undefined) {
    sessionRateLimitKeySeq += 1;
    key = `mcp-session-${sessionRateLimitKeySeq}`;
    sessionRateLimitKeys.set(scope, key);
  }
  return key;
}

/**
 * Bind the real MCP session id (from the Streamable HTTP transport) to a session
 * scope so every subsequent charge for that scope is bucketed under a key named
 * by the session id.
 *
 * First-writer-wins and idempotent: if the scope already has a key (for example
 * a synthetic one minted by an earlier charge), it is kept so the session can
 * never split across two buckets. A no-op without a scope or id — the stdio path,
 * where a single implicit client needs no session id.
 */
export function bindRateLimitSessionId(scope: object | undefined, sessionId: string | undefined): void {
  if (!scope || !sessionId) {
    return;
  }
  if (!sessionRateLimitKeys.has(scope)) {
    sessionRateLimitKeys.set(scope, `mcp-session:${sessionId}`);
  }
}

/**
 * Charge one request against the per-session bucket for `scope`. Throws
 * `RateLimitError` when the session's window is exhausted. Consolidates the
 * charge so every MCP entrypoint bills the same bucket the same way.
 */
export function chargeSessionRateLimit(scope: object | undefined): void {
  rateLimiter.checkLimit(resolveRateLimitKey(scope));
}
