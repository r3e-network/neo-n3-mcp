import { jest } from '@jest/globals';
import { Cache } from '../../src/utils/cache';

describe('Cache Utility', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    // Create a new cache with a 100ms TTL for testing
    cache = new Cache<string>('test', 100);
  });

  test('should set and get a value', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return undefined for non-existent key', () => {
    expect(cache.get('non-existent')).toBeUndefined();
  });

  test('should expire items after TTL', async () => {
    cache.set('key2', 'value2');
    expect(cache.get('key2')).toBe('value2');

    // Wait for the cache to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('key2')).toBeUndefined();
  });

  test('should clear all items', () => {
    cache.set('key3', 'value3');
    cache.set('key4', 'value4');

    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');

    cache.clear();

    expect(cache.get('key3')).toBeUndefined();
    expect(cache.get('key4')).toBeUndefined();
  });

  test('should delete a specific item', () => {
    cache.set('key5', 'value5');
    cache.set('key6', 'value6');

    expect(cache.get('key5')).toBe('value5');
    expect(cache.get('key6')).toBe('value6');

    cache.remove('key5');

    expect(cache.get('key5')).toBeUndefined();
    expect(cache.get('key6')).toBe('value6');
  });

  test('should check if a key exists', () => {
    cache.set('key7', 'value7');

    expect(cache.has('key7')).toBe(true);
    expect(cache.has('non-existent')).toBe(false);
  });

  test('should not return expired items when checking existence', async () => {
    cache.set('key8', 'value8');
    expect(cache.has('key8')).toBe(true);

    // Wait for the cache to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.has('key8')).toBe(false);
  });

  test('should update TTL when setting an existing key', async () => {
    cache.set('key9', 'value9');

    // Wait for half the TTL
    await new Promise(resolve => setTimeout(resolve, 50));

    // Update the value
    cache.set('key9', 'updated-value9');

    // Wait for the original TTL to expire
    await new Promise(resolve => setTimeout(resolve, 60));

    // The item should still be in the cache with the updated value
    expect(cache.get('key9')).toBe('updated-value9');

    // Wait for the new TTL to expire
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now the item should be expired
    expect(cache.get('key9')).toBeUndefined();
  });
});
