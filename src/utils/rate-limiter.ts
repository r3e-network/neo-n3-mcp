/**
 * Rate limiting utility for Neo N3 MCP Server
 * Prevents abuse by limiting request frequency
 */

import { config } from '../config';
import { logger } from './logger';
import { RateLimitError } from './errors';

/**
 * Rate limit entry interface
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private hourlyLimits: Map<string, RateLimitEntry>;
  private maxRequests: number;
  private maxRequestsPerHour?: number;
  private windowMs: number;
  private enabled: boolean;
  
  /**
   * Create a new rate limiter
   * @param maxRequests Maximum requests per window
   * @param windowMs Window size in milliseconds
   * @param enabled Whether rate limiting is enabled
   */
  constructor(
    maxRequests: number = 60,
    windowMs: number = 60000,
    enabled: boolean = true,
    maxRequestsPerHour?: number
  ) {
    this.assertPositiveInteger(maxRequests, 'maxRequests');
    this.assertPositiveInteger(windowMs, 'windowMs');
    if (maxRequestsPerHour !== undefined) {
      this.assertPositiveInteger(maxRequestsPerHour, 'maxRequestsPerHour');
    }

    this.limits = new Map();
    this.hourlyLimits = new Map();
    this.maxRequests = maxRequests;
    this.maxRequestsPerHour = maxRequestsPerHour;
    this.windowMs = windowMs;
    this.enabled = enabled;
    
    logger.info(`Rate limiter initialized: ${maxRequests} requests per ${windowMs}ms (${enabled ? 'enabled' : 'disabled'})`);
    
    // Clean up expired entries periodically (unref so it doesn't block process exit)
    setInterval(() => this.cleanup(), Math.min(windowMs, 60000)).unref();
  }
  
  /**
   * Check if a client has exceeded their rate limit
   * @param clientId Identifier for the client (e.g., IP address)
   * @returns Whether the request should be allowed
   * @throws RateLimitError if limit exceeded
   */
  checkLimit(clientId: string): boolean {
    if (!this.enabled) {
      return true;
    }
    
    this.consumeWindow(this.limits, clientId, this.maxRequests, this.windowMs, 'minute');
    if (this.maxRequestsPerHour !== undefined) {
      this.consumeWindow(this.hourlyLimits, clientId, this.maxRequestsPerHour, 60 * 60 * 1000, 'hour');
    }
    
    return true;
  }
  
  /**
   * Reset rate limit for a client
   * @param clientId Identifier for the client
   */
  resetLimit(clientId: string): void {
    this.limits.delete(clientId);
    this.hourlyLimits.delete(clientId);
    logger.debug(`Rate limit reset for client ${clientId}`);
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const limits of [this.limits, this.hourlyLimits]) {
      for (const [clientId, entry] of limits.entries()) {
        if (entry.resetTime <= now) {
          limits.delete(clientId);
          expiredCount++;
        }
      }
    }
    
    if (expiredCount > 0) {
      logger.debug(`Rate limiter cleanup: removed ${expiredCount} expired entries`);
    }
  }
  
  /**
   * Enable or disable rate limiting
   * @param enabled Whether rate limiting should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Rate limiting ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Update rate limit settings
   * @param maxRequests Maximum requests per window
   * @param windowMs Window size in milliseconds
   */
  updateSettings(maxRequests?: number, windowMs?: number, maxRequestsPerHour?: number): void {
    if (maxRequests !== undefined) {
      this.assertPositiveInteger(maxRequests, 'maxRequests');
      this.maxRequests = maxRequests;
    }
    
    if (windowMs !== undefined) {
      this.assertPositiveInteger(windowMs, 'windowMs');
      this.windowMs = windowMs;
    }

    if (maxRequestsPerHour !== undefined) {
      this.assertPositiveInteger(maxRequestsPerHour, 'maxRequestsPerHour');
      this.maxRequestsPerHour = maxRequestsPerHour;
    }
    
    logger.info(`Rate limiter settings updated: ${this.maxRequests} requests per ${this.windowMs}ms`);
  }

  private consumeWindow(
    limits: Map<string, RateLimitEntry>,
    clientId: string,
    maxRequests: number,
    windowMs: number,
    window: 'minute' | 'hour'
  ): void {
    const now = Date.now();
    let entry = limits.get(clientId);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + windowMs };
      limits.set(clientId, entry);
    }

    entry.count++;
    if (entry.count <= maxRequests) {
      return;
    }

    const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    logger.warn(`Rate limit exceeded for client ${clientId}`, {
      count: entry.count,
      maxRequests,
      window,
      windowMs,
      retryAfter
    });
    throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, {
      limit: maxRequests,
      current: entry.count,
      retryAfter,
      window
    });
  }

  private assertPositiveInteger(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive integer`);
    }
  }
}

export const rateLimiter = new RateLimiter(
  config.rateLimiting.maxRequestsPerMinute,
  60000,
  config.rateLimiting.enabled,
  config.rateLimiting.maxRequestsPerHour
);
