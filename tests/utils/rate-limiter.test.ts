import { jest } from '@jest/globals';
import { RateLimiter } from '../../src/utils/rate-limiter';

describe('Rate Limiter Utility', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create a new rate limiter with 5 requests per 100ms window
    rateLimiter = new RateLimiter(5, 100);
  });

  test('should allow requests within the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client1')).toBe(true);
    }
  });

  test('should block requests over the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client2')).toBe(true);
    }

    // The 6th request should throw a RateLimitError
    expect(() => {
      rateLimiter.checkLimit('client2');
    }).toThrow('Rate limit exceeded');
  });

  test('should reset after the time window', async () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client3')).toBe(true);
    }

    // The 6th request should throw a RateLimitError
    expect(() => {
      rateLimiter.checkLimit('client3');
    }).toThrow('Rate limit exceeded');

    // Wait for the time window to reset
    await new Promise(resolve => setTimeout(resolve, 110));

    // Now requests should be allowed again
    expect(rateLimiter.checkLimit('client3')).toBe(true);
  });

  test('should track different clients separately', () => {
    // Use up all requests for client4
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client4')).toBe(true);
    }

    // The 6th request should throw a RateLimitError
    expect(() => {
      rateLimiter.checkLimit('client4');
    }).toThrow('Rate limit exceeded');

    // client5 should still be able to make requests
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client5')).toBe(true);
    }

    // The 6th request for client5 should also throw
    expect(() => {
      rateLimiter.checkLimit('client5');
    }).toThrow('Rate limit exceeded');
  });

  test('should clean up old entries', async () => {
    // Make requests for client6
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.checkLimit('client6')).toBe(true);
    }

    // Wait for the time window to reset
    await new Promise(resolve => setTimeout(resolve, 110));

    // Force a cleanup by making a request for a different client
    rateLimiter.checkLimit('client7');

    // Check that client6's entry has been cleaned up
    expect((rateLimiter as any).limits.has('client6')).toBe(false);
  });

  test('should handle different rate limits', () => {
    // Create a rate limiter with 2 requests per 100ms
    const strictLimiter = new RateLimiter(2, 100);

    expect(strictLimiter.checkLimit('client8')).toBe(true);
    expect(strictLimiter.checkLimit('client8')).toBe(true);

    // The 3rd request should throw a RateLimitError
    expect(() => {
      strictLimiter.checkLimit('client8');
    }).toThrow('Rate limit exceeded');

    // Create a rate limiter with 10 requests per 100ms
    const looseLimiter = new RateLimiter(10, 100);

    for (let i = 0; i < 10; i++) {
      expect(looseLimiter.checkLimit('client9')).toBe(true);
    }

    // The 11th request should throw a RateLimitError
    expect(() => {
      looseLimiter.checkLimit('client9');
    }).toThrow('Rate limit exceeded');
  });
});
