/**
 * Adversarial tests for the Phase 2 constrained-find guard
 * (src/indexer/indexer-find-guard.ts).
 *
 * This guard is the security boundary for the gated `find_indexer` tool: it lets a caller
 * author a SMALL Mongo-shaped filter, so it must reject every unlisted collection/field,
 * every operator outside a tiny allowlist, and every injection/DoS-shaped value — always
 * with a typed `ValidationError`, never an uncaught crash. Each case names the property it
 * pins; removing the corresponding guard clause would flip the assertion.
 *
 * Adversarial inputs are constructed with `JSON.parse` where the attack depends on an OWN
 * `__proto__`/operator key, because that is exactly how an MCP JSON payload reaches the guard
 * (an object literal `{ __proto__: ... }` would set the prototype instead of a key and would
 * not model the threat).
 */

import { validateFind, assertAllowedCollection } from '../src/indexer/indexer-find-guard';
import { COLLECTION_CATALOG } from '../src/indexer/indexer-collections';
import { ValidationError } from '../src/utils/errors';

describe('COLLECTION_CATALOG — shape & immutability', () => {
  it('is non-empty and deeply frozen (policy cannot be widened at runtime)', () => {
    expect(COLLECTION_CATALOG.size).toBeGreaterThan(0);
    expect(Object.isFrozen(COLLECTION_CATALOG)).toBe(true);
    const tx = COLLECTION_CATALOG.get('transactions');
    expect(tx).toBeDefined();
    expect(Object.isFrozen(tx)).toBe(true);
    expect(Object.isFrozen(tx!.filterFields)).toBe(true);
    expect(Object.isFrozen(tx!.sortFields)).toBe(true);
    // A frozen readonly array silently ignores mutation in non-strict paths; assert length.
    expect(tx!.filterFields).toEqual(['hash', 'sender', 'blockhash', 'blockIndex']);
    expect(tx!.rpcMethod).toBe('GetTransactionList');
  });

  it('every rpcMethod is a read-only Get* handler', () => {
    for (const desc of COLLECTION_CATALOG.values()) {
      expect(desc.rpcMethod).toMatch(/^Get[A-Za-z0-9]+$/);
      expect(desc.maxLimit).toBeGreaterThanOrEqual(desc.defaultLimit);
    }
  });
});

describe('assertAllowedCollection — collection allowlist', () => {
  it('returns the descriptor for a vetted collection', () => {
    const d = assertAllowedCollection('transactions');
    expect(d.rpcMethod).toBe('GetTransactionList');
  });

  it('rejects an unknown collection', () => {
    expect(() => assertAllowedCollection('drop_database')).toThrow(ValidationError);
  });

  it('rejects the internal Mongo collection name (only lowercase tool keys are allowed)', () => {
    // "Transaction" is the upstream Mongo name, not a catalog KEY, so it is rejected.
    expect(() => assertAllowedCollection('Transaction')).toThrow(ValidationError);
  });

  it('rejects an empty / non-string collection without crashing', () => {
    expect(() => assertAllowedCollection('')).toThrow(ValidationError);
    expect(() => assertAllowedCollection(undefined as unknown as string)).toThrow(ValidationError);
    expect(() => assertAllowedCollection(123 as unknown as string)).toThrow(ValidationError);
  });

  it('names the permitted collections in the rejection message (LLM self-correction)', () => {
    let message = '';
    try {
      assertAllowedCollection('nope');
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('transactions');
    expect(message).toContain('blocks');
  });
});

describe('validateFind — unknown collection', () => {
  it('rejects a find against an unknown collection', () => {
    expect(() => validateFind('mempool_secrets', { hash: '0x1' })).toThrow(ValidationError);
  });
});

describe('validateFind — field allowlist (T18)', () => {
  it('rejects an unknown / unindexed field', () => {
    expect(() => validateFind('transactions', { nonce: 1 })).toThrow(ValidationError);
    expect(() => validateFind('transactions', { data: 'x' })).toThrow(ValidationError);
  });

  it('rejects a field valid on another collection but not this one', () => {
    // `address` is filterable on `addresses`, not on `transactions`.
    expect(() => validateFind('transactions', { address: '0x1' })).toThrow(ValidationError);
  });

  it('rejects a dotted / nested field path', () => {
    expect(() => validateFind('transactions', { 'sender.evil': 1 })).toThrow(ValidationError);
  });

  it('names the allowed fields in the rejection message', () => {
    let message = '';
    try {
      validateFind('transactions', { bogus: 1 });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('sender');
    expect(message).toContain('blockIndex');
  });
});

describe('validateFind — operator allowlist (injection defense)', () => {
  const CASES: Array<[string, Record<string, unknown>]> = [
    ['$where', { sender: { $where: 'sleep(9999)' } }],
    ['$function', { sender: { $function: { body: 'x', args: [], lang: 'js' } } }],
    ['$regex', { sender: { $regex: '.*' } }],
    ['$expr', { sender: { $expr: { $eq: ['$a', '$b'] } } }],
    ['$text', { sender: { $text: { $search: 'x' } } }],
    ['$not', { sender: { $not: { $gt: 1 } } }],
    ['$elemMatch', { sender: { $elemMatch: { a: 1 } } }],
    ['$jsonSchema', { sender: { $jsonSchema: {} } }],
  ];

  it.each(CASES)('rejects a %s operator value', (_name, filter) => {
    expect(() => validateFind('transactions', filter)).toThrow(ValidationError);
  });

  it('rejects a top-level $or (logical operators are not field keys)', () => {
    expect(() =>
      validateFind('transactions', { $or: [{ sender: 'a' }, { sender: 'b' }] }),
    ).toThrow(ValidationError);
  });

  it('rejects a nested $or / $and inside a field expression', () => {
    expect(() => validateFind('transactions', { sender: { $and: [{ $gt: 1 }] } })).toThrow(
      ValidationError,
    );
  });

  it('rejects mixing an allowed operator with a stray non-operator key', () => {
    expect(() => validateFind('transactions', { blockIndex: { $gt: 1, foo: 2 } })).toThrow(
      ValidationError,
    );
  });

  it('rejects an empty operator object', () => {
    expect(() => validateFind('transactions', { sender: {} })).toThrow(ValidationError);
  });
});

describe('validateFind — nesting, arrays & exotic values', () => {
  it('rejects a two-level nested operator ($gt whose operand is itself an object)', () => {
    expect(() => validateFind('transactions', { blockIndex: { $gt: { $gt: 1 } } })).toThrow(
      ValidationError,
    );
  });

  it('rejects a bare array value (must use $in)', () => {
    expect(() => validateFind('transactions', { sender: ['a', 'b'] })).toThrow(ValidationError);
  });

  it('rejects $in with more than 20 items', () => {
    const many = Array.from({ length: 100 }, (_v, i) => `0x${i}`);
    expect(() => validateFind('transactions', { hash: { $in: many } })).toThrow(ValidationError);
  });

  it('rejects $in containing a nested object (no operators smuggled through elements)', () => {
    expect(() =>
      validateFind('transactions', { hash: { $in: [{ $where: 'x' }] } }),
    ).toThrow(ValidationError);
  });

  it('rejects a non-array $in operand', () => {
    expect(() => validateFind('transactions', { hash: { $in: 'not-an-array' } })).toThrow(
      ValidationError,
    );
  });

  it('rejects a non-boolean $exists operand', () => {
    expect(() => validateFind('transactions', { sender: { $exists: 'yes' } })).toThrow(
      ValidationError,
    );
  });

  it('rejects a null filter value', () => {
    expect(() => validateFind('transactions', { sender: null })).toThrow(ValidationError);
  });

  it('rejects a non-object filter (array / string / number)', () => {
    expect(() => validateFind('transactions', [1, 2, 3])).toThrow(ValidationError);
    expect(() => validateFind('transactions', 'sender=me')).toThrow(ValidationError);
    expect(() => validateFind('transactions', 42)).toThrow(ValidationError);
  });

  it('rejects an over-long scalar string (payload bound)', () => {
    const huge = 'a'.repeat(1000);
    expect(() => validateFind('transactions', { sender: huge })).toThrow(ValidationError);
  });
});

describe('validateFind — prototype-pollution defense', () => {
  it('rejects an own __proto__ key at the field level and does not pollute Object.prototype', () => {
    const evil = JSON.parse('{"__proto__": {"polluted": true}}');
    expect(() => validateFind('transactions', evil)).toThrow(ValidationError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a constructor / prototype field key', () => {
    expect(() => validateFind('transactions', JSON.parse('{"constructor": 1}'))).toThrow(
      ValidationError,
    );
    expect(() => validateFind('transactions', JSON.parse('{"prototype": 1}'))).toThrow(
      ValidationError,
    );
  });

  it('rejects an own __proto__ key inside an operator expression', () => {
    const evil = JSON.parse('{"sender": {"__proto__": 1}}');
    expect(() => validateFind('transactions', evil)).toThrow(ValidationError);
  });

  it('rejects __proto__ / $-keys in the sort spec', () => {
    expect(() => validateFind('transactions', {}, JSON.parse('{"__proto__": 1}'))).toThrow(
      ValidationError,
    );
    expect(() => validateFind('transactions', {}, { $currentDate: 1 })).toThrow(ValidationError);
  });
});

describe('validateFind — sort validation', () => {
  it('rejects a non-sortable field', () => {
    expect(() => validateFind('transactions', {}, { sender: -1 })).toThrow(ValidationError);
  });

  it('rejects an invalid sort direction', () => {
    expect(() => validateFind('transactions', {}, { blockIndex: 2 })).toThrow(ValidationError);
    expect(() => validateFind('transactions', {}, { blockIndex: 'sideways' })).toThrow(
      ValidationError,
    );
  });

  it('rejects any sort on a collection with no sortable fields', () => {
    // `assets` declares an empty sortFields list.
    expect(() => validateFind('assets', {}, { hash: 1 })).toThrow(ValidationError);
  });

  it('normalizes asc/desc tokens to 1 / -1', () => {
    const req = validateFind('transactions', {}, { blockIndex: 'desc', blocktime: 'asc' });
    expect(req.Sort).toEqual({ blockIndex: -1, blocktime: 1 });
  });
});

describe('validateFind — pagination clamps', () => {
  it('clamps limit 9999 down to the collection maxLimit', () => {
    const maxLimit = COLLECTION_CATALOG.get('transactions')!.maxLimit;
    const req = validateFind('transactions', {}, undefined, 9999);
    expect(req.Limit).toBe(maxLimit);
  });

  it('clamps limit 0 up to 1 and defaults when absent', () => {
    expect(validateFind('transactions', {}, undefined, 0).Limit).toBe(1);
    expect(validateFind('transactions', {}).Limit).toBe(
      COLLECTION_CATALOG.get('transactions')!.defaultLimit,
    );
  });

  it('clamps a deep skip down to MAX_SKIP (10000) and defaults to 0', () => {
    expect(validateFind('transactions', {}, undefined, 10, 10_000_000).Skip).toBe(10_000);
    expect(validateFind('transactions', {}).Skip).toBe(0);
  });

  it('rejects a non-integer limit/skip without crashing', () => {
    expect(() => validateFind('transactions', {}, undefined, 'lots')).toThrow(ValidationError);
    expect(() => validateFind('transactions', {}, undefined, 10, -5)).toThrow(ValidationError);
  });
});

describe('validateFind — the happy path builds the exact sanitized request', () => {
  it('rebuilds { Filter, Sort, Limit, Skip } (PascalCase) from a rich valid input', () => {
    const req = validateFind(
      'transactions',
      {
        sender: '0xabc',
        blockIndex: { $gte: 100, $lte: 200 },
        hash: { $in: ['0x1', '0x2'] },
        blockhash: { $exists: true },
      },
      { blockIndex: -1 },
      10,
      5,
    );

    expect(req).toEqual({
      Filter: {
        sender: '0xabc',
        blockIndex: { $gte: 100, $lte: 200 },
        hash: { $in: ['0x1', '0x2'] },
        blockhash: { $exists: true },
      },
      Sort: { blockIndex: -1 },
      Limit: 10,
      Skip: 5,
    });
  });

  it('returns freshly-built objects (no aliasing of the caller input)', () => {
    const filter = { sender: '0xabc', hash: { $in: ['0x1'] } };
    const req = validateFind('transactions', filter, {}, 10, 0);
    expect(req.Filter).not.toBe(filter);
    expect(req.Filter.hash).not.toBe(filter.hash);
    // Mutating the caller's object afterwards must not change the sanitized result.
    (filter as Record<string, unknown>).sender = 'MUTATED';
    expect(req.Filter.sender).toBe('0xabc');
  });

  it('treats an omitted/empty filter as match-all with defaulted paging', () => {
    const req = validateFind('addresses');
    expect(req.Filter).toEqual({});
    expect(req.Sort).toEqual({});
    expect(req.Limit).toBe(COLLECTION_CATALOG.get('addresses')!.defaultLimit);
    expect(req.Skip).toBe(0);
  });
});
