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
