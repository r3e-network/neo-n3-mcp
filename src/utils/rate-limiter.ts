/**
 * Rate limiting utility for Neo N3 MCP Server
 * Prevents abuse by limiting request frequency
 */

import { config } from '../config.js';
import { logger } from './logger.js';
import { RateLimitError } from './errors.js';

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
  private maxRequests: number;
  private windowMs: number;
  private enabled: boolean;
  
  /**
   * Create a new rate limiter
   * @param maxRequests Maximum requests per window
   * @param windowMs Window size in milliseconds
   * @param enabled Whether rate limiting is enabled
   */
  constructor(maxRequests: number = 60, windowMs: number = 60000, enabled: boolean = true) {
    this.limits = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.enabled = enabled;
    
    logger.info(`Rate limiter initialized: ${maxRequests} requests per ${windowMs}ms (${enabled ? 'enabled' : 'disabled'})`);
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), windowMs);
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
    
    const now = Date.now();
    let entry = this.limits.get(clientId);
    
    // Clean up expired entry
    if (entry && entry.resetTime <= now) {
      this.limits.delete(clientId);
      entry = undefined;
    }
    
    // If no entry or expired, create new entry
    if (!entry) {
      this.limits.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }
    
    // Increment count
    entry.count++;
    
    // Check if over limit
    if (entry.count > this.maxRequests) {
      const retryAfterMs = entry.resetTime - now;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      
      logger.warn(`Rate limit exceeded for client ${clientId}`, {
        count: entry.count,
        maxRequests: this.maxRequests,
        windowMs: this.windowMs,
        retryAfter: retryAfterSec
      });
      
      throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfterSec} seconds.`, {
        limit: this.maxRequests,
        current: entry.count,
        retryAfter: retryAfterSec
      });
    }
    
    return true;
  }
  
  /**
   * Reset rate limit for a client
   * @param clientId Identifier for the client
   */
  resetLimit(clientId: string): void {
    this.limits.delete(clientId);
    logger.debug(`Rate limit reset for client ${clientId}`);
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [clientId, entry] of this.limits.entries()) {
      if (entry.resetTime <= now) {
        this.limits.delete(clientId);
        expiredCount++;
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
  updateSettings(maxRequests?: number, windowMs?: number): void {
    if (maxRequests !== undefined) {
      this.maxRequests = maxRequests;
    }
    
    if (windowMs !== undefined) {
      this.windowMs = windowMs;
    }
    
    logger.info(`Rate limiter settings updated: ${this.maxRequests} requests per ${this.windowMs}ms`);
  }
}

// Create instance with config values
export const rateLimiter = new RateLimiter(
  config.security.maxRequestsPerMinute,
  60000, // 1 minute window
  true  // Enabled by default
); 