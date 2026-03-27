import { RateLimiter } from '../src/utils/rate-limiter';
import { RateLimitError } from '../src/utils/errors';

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

  it('throws RateLimitError with retryAfter details', () => {
    const limiter = new RateLimiter(1, 60000, true);
    limiter.checkLimit('test-client');
    try {
      limiter.checkLimit('test-client');
      fail('Expected RateLimitError');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      const rateError = error as RateLimitError;
      expect(rateError.details).toBeDefined();
      expect((rateError.details as Record<string, unknown>).retryAfter).toBeGreaterThan(0);
    }
  });

  it('does not limit when disabled', () => {
    const limiter = new RateLimiter(1, 60000, false);
    expect(limiter.checkLimit('test-client')).toBe(true);
    expect(limiter.checkLimit('test-client')).toBe(true);
  });

  it('tracks clients independently', () => {
    const limiter = new RateLimiter(2, 60000, true);
    limiter.checkLimit('client-a');
    limiter.checkLimit('client-a');
    // client-a is at limit, but client-b should still be allowed
    expect(limiter.checkLimit('client-b')).toBe(true);
    expect(() => limiter.checkLimit('client-a')).toThrow('Rate limit exceeded');
  });

  it('resets limit for a specific client', () => {
    const limiter = new RateLimiter(1, 60000, true);
    limiter.checkLimit('test-client');
    expect(() => limiter.checkLimit('test-client')).toThrow('Rate limit exceeded');
    limiter.resetLimit('test-client');
    expect(limiter.checkLimit('test-client')).toBe(true);
  });
});
