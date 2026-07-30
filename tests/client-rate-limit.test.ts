import {
  resolveRateLimitKey,
  bindRateLimitClientId,
  chargeClientRateLimit,
} from '../src/utils/client-rate-limit';
import { rateLimiter } from '../src/utils/rate-limiter';

describe('client rate-limit keying', () => {
  test('maps the same scope object to one stable key and distinct scopes to distinct keys', () => {
    const scopeA = {};
    const scopeB = {};

    const a1 = resolveRateLimitKey(scopeA);
    const a2 = resolveRateLimitKey(scopeA);
    const b1 = resolveRateLimitKey(scopeB);

    // Same request/connection scope identity => one stable bucket.
    expect(a1).toBe(a2);
    // Distinct scopes => distinct buckets until a stable client id is bound.
    expect(b1).not.toBe(a1);
    // The bucket is not the defensive shared fallback.
    expect(a1).not.toBe('mcp-client');
  });

  test('falls back to a shared constant only when no scope is supplied', () => {
    expect(resolveRateLimitKey(undefined)).toBe('mcp-client');
  });

  test('binds a stable client id as the bucket key before first use', () => {
    const scope = {};

    bindRateLimitClientId(scope, 'abc-123');

    expect(resolveRateLimitKey(scope)).toBe('mcp-client:abc-123');
  });

  test('binding is first-writer-wins so one request never splits across two buckets', () => {
    const scope = {};

    // A charge lands before the client id is known and mints a synthetic key.
    const minted = resolveRateLimitKey(scope);
    // A late bind must NOT override it, or pre-bind and post-bind charges would
    // hit two different buckets.
    bindRateLimitClientId(scope, 'late-id');

    expect(resolveRateLimitKey(scope)).toBe(minted);
  });

  test('binding is a no-op without a scope or id (the stdio path)', () => {
    expect(() => bindRateLimitClientId(undefined, 'x')).not.toThrow();

    const scope = {};
    bindRateLimitClientId(scope, undefined);
    // No id bound => a stable synthetic key.
    expect(resolveRateLimitKey(scope)).toMatch(/^mcp-client-\d+$/);
  });

  test('chargeClientRateLimit bills the scope bucket on the shared limiter', () => {
    const scope = {};
    const spy = jest.spyOn(rateLimiter, 'checkLimit').mockReturnValue(true);
    try {
      chargeClientRateLimit(scope);
      expect(spy).toHaveBeenCalledWith(resolveRateLimitKey(scope));
    } finally {
      spy.mockRestore();
    }
  });
});
