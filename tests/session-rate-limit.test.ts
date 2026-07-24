import {
  resolveRateLimitKey,
  bindRateLimitSessionId,
  chargeSessionRateLimit,
} from '../src/utils/session-rate-limit';
import { rateLimiter } from '../src/utils/rate-limiter';

describe('session rate-limit keying', () => {
  test('maps the same scope object to one stable key and distinct scopes to distinct keys', () => {
    const scopeA = {};
    const scopeB = {};

    const a1 = resolveRateLimitKey(scopeA);
    const a2 = resolveRateLimitKey(scopeA);
    const b1 = resolveRateLimitKey(scopeB);

    // Same session (same scope identity) => one stable bucket.
    expect(a1).toBe(a2);
    // Distinct sessions => distinct buckets: no shared process-wide bucket.
    expect(b1).not.toBe(a1);
    // The bucket is not the shared constant that made every session collide.
    expect(a1).not.toBe('mcp-client');
  });

  test('falls back to a shared constant only when no scope is supplied', () => {
    expect(resolveRateLimitKey(undefined)).toBe('mcp-client');
  });

  test('binds a real MCP session id as the bucket key before first use', () => {
    const scope = {};

    bindRateLimitSessionId(scope, 'abc-123');

    expect(resolveRateLimitKey(scope)).toBe('mcp-session:abc-123');
  });

  test('binding is first-writer-wins so a session never splits across two buckets', () => {
    const scope = {};

    // A charge lands before the session id is known and mints a synthetic key.
    const minted = resolveRateLimitKey(scope);
    // A late bind must NOT override it, or pre-bind and post-bind charges would
    // hit two different buckets.
    bindRateLimitSessionId(scope, 'late-id');

    expect(resolveRateLimitKey(scope)).toBe(minted);
  });

  test('binding is a no-op without a scope or id (the stdio path)', () => {
    expect(() => bindRateLimitSessionId(undefined, 'x')).not.toThrow();

    const scope = {};
    bindRateLimitSessionId(scope, undefined);
    // No id bound => a stable synthetic key, not a session-id-named one.
    expect(resolveRateLimitKey(scope)).toMatch(/^mcp-session-\d+$/);
  });

  test('chargeSessionRateLimit bills the scope bucket on the shared limiter', () => {
    const scope = {};
    const spy = jest.spyOn(rateLimiter, 'checkLimit').mockReturnValue(true);
    try {
      chargeSessionRateLimit(scope);
      expect(spy).toHaveBeenCalledWith(resolveRateLimitKey(scope));
    } finally {
      spy.mockRestore();
    }
  });
});
