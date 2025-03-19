/**
 * Caching utility for Neo N3 MCP Server
 * Provides in-memory caching with TTL support
 */

import { logger } from './logger.js';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Generic cache class with TTL support
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private defaultTtl: number;
  private name: string;
  
  /**
   * Create a new cache
   * @param name Cache name for logging
   * @param defaultTtlMs Default TTL in milliseconds
   */
  constructor(name: string = 'default', defaultTtlMs: number = 60000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;
    this.name = name;
    
    // Log cache creation
    logger.debug(`Cache '${name}' created with ${defaultTtlMs}ms default TTL`);
  }
  
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug(`Cache '${this.name}' miss for key: ${key}`);
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      logger.debug(`Cache '${this.name}' expiration for key: ${key}`);
      this.cache.delete(key);
      return undefined;
    }
    
    logger.debug(`Cache '${this.name}' hit for key: ${key}`);
    return entry.value;
  }
  
  /**
   * Store a value in cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlMs Time to live in milliseconds (optional)
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtl;
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
    
    logger.debug(`Cache '${this.name}' set key: ${key} with TTL ${ttl}ms`);
  }
  
  /**
   * Get a value, or compute and cache it if not present
   * @param key Cache key
   * @param factory Function to produce value if not cached
   * @param ttlMs Time to live in milliseconds (optional)
   * @returns Value from cache or newly computed
   */
  async getOrCompute(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    logger.debug(`Cache '${this.name}' computing value for key: ${key}`);
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
  
  /**
   * Remove a specific key from cache
   * @param key Cache key
   */
  remove(key: string): void {
    this.cache.delete(key);
    logger.debug(`Cache '${this.name}' removed key: ${key}`);
  }
  
  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
    logger.debug(`Cache '${this.name}' cleared all entries`);
  }
  
  /**
   * Get all keys in the cache
   * @returns Array of keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Get number of entries in the cache
   * @returns Number of entries
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Check if cache contains a key
   * @param key Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  /**
   * Get entries iterator
   * @returns Entries iterator for [key, value] pairs
   */
  entries(): Array<[string, T]> {
    const result: Array<[string, T]> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() <= entry.expires) {
        result.push([key, entry.value]);
      }
    }
    
    return result;
  }
}

// Create common caches
export const contractCache = new Cache<any>('contract', 300000); // 5 minute TTL
export const transactionCache = new Cache<any>('transaction', 600000); // 10 minute TTL
export const rpcResultCache = new Cache<any>('rpc', 30000); // 30 second TTL 