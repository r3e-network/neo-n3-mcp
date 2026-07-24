import {
  DEFAULT_PAGINATION,
  METHOD_CATALOG,
  type MethodDescriptor,
  type ParamType,
} from '../src/indexer/indexer-catalog';

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/** Read-only handler prefix invariant: every catalog method is a `Get*` reader. */
const READ_ONLY_PREFIX = /^Get[A-Z]/;

/**
 * Methods that must NEVER appear in the catalog: write/admin mutators (neo3fura
 * `adminMethods`), the SSRF-prone NeoFS image proxy, and native node passthroughs.
 */
const FORBIDDEN_RPC_METHODS = new Set<string>([
  'InsertVerifiedContract',
  'SetMarketCollectionWhitelist',
  'SetPopularTokenWhitelist',
  'SetPrimaryMarketPreSaleWhitelist',
  'TokenUriRename',
  'GetNeoFsImage',
]);

const VALID_PARAM_TYPES: ReadonlySet<ParamType> = new Set<ParamType>([
  'address',
  'scriptHash',
  'hash',
  'blockHeight',
  'name',
  'tokenId',
  'enum',
  'integer',
  'boolean',
]);

const VALID_CATEGORIES = new Set<MethodDescriptor['category']>([
  'address',
  'block',
  'transaction',
  'transfer',
  'asset',
  'contract',
  'governance',
  'state',
  'market',
]);

const entries = (): [string, MethodDescriptor][] => [...METHOD_CATALOG.entries()];

describe('METHOD_CATALOG', () => {
  test('is non-empty', () => {
    expect(METHOD_CATALOG.size).toBeGreaterThan(0);
  });

  test('reports a stable verified method count', () => {
    // Phase 1 curated INCLUDE set, minus get_nep11_properties (TokenIds is an array,
    // not a scalar tokenId — cannot be faithfully represented and is dropped).
    expect(METHOD_CATALOG.size).toBe(48);
  });

  test('the catalog map is frozen', () => {
    expect(Object.isFrozen(METHOD_CATALOG)).toBe(true);
  });

  test('every descriptor (and its params) is deeply frozen', () => {
    for (const [key, desc] of entries()) {
      expect(Object.isFrozen(desc)).toBe(true);
      expect(Object.isFrozen(desc.params)).toBe(true);
      for (const spec of Object.values(desc.params)) {
        expect(Object.isFrozen(spec)).toBe(true);
      }
      if (desc.pagination) {
        expect(Object.isFrozen(desc.pagination)).toBe(true);
      }
      // Mutating a frozen descriptor must be a no-op (proves runtime immutability).
      const before = desc.rpcMethod;
      try {
        (desc as { rpcMethod: string }).rpcMethod = 'Mutated';
      } catch {
        /* strict-mode throw is also acceptable */
      }
      expect(METHOD_CATALOG.get(key)!.rpcMethod).toBe(before);
    }
  });

  test('every tool key is unique snake_case and non-empty', () => {
    for (const key of METHOD_CATALOG.keys()) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test('every rpcMethod is unique', () => {
    const seen = new Map<string, string>();
    for (const [key, desc] of entries()) {
      const prior = seen.get(desc.rpcMethod);
      expect(prior).toBeUndefined();
      seen.set(desc.rpcMethod, key);
    }
    expect(seen.size).toBe(METHOD_CATALOG.size);
  });

  test('every rpcMethod is PascalCase and a read-only Get* handler', () => {
    for (const [, desc] of entries()) {
      expect(desc.rpcMethod).toMatch(PASCAL_CASE);
      expect(desc.rpcMethod).toMatch(READ_ONLY_PREFIX);
    }
  });

  test('no write/admin/passthrough/NeoFS method is present', () => {
    for (const [, desc] of entries()) {
      expect(FORBIDDEN_RPC_METHODS.has(desc.rpcMethod)).toBe(false);
      // ori.* node passthroughs are dotted and would fail PascalCase, but assert intent.
      expect(desc.rpcMethod.startsWith('ori.')).toBe(false);
    }
  });

  test('every param rpcKey is PascalCase', () => {
    for (const [, desc] of entries()) {
      for (const spec of Object.values(desc.params)) {
        expect(spec.rpcKey).toMatch(PASCAL_CASE);
      }
    }
  });

  test('every param key is camelCase and its type is valid', () => {
    for (const [, desc] of entries()) {
      for (const [paramKey, spec] of Object.entries(desc.params)) {
        expect(paramKey).toMatch(/^[a-z][A-Za-z0-9]*$/);
        expect(VALID_PARAM_TYPES.has(spec.type)).toBe(true);
      }
    }
  });

  test('param rpcKeys are unique within each method', () => {
    for (const [, desc] of entries()) {
      const rpcKeys = Object.values(desc.params).map((s) => s.rpcKey);
      expect(new Set(rpcKeys).size).toBe(rpcKeys.length);
    }
  });

  test('every category is a valid MethodCategory', () => {
    for (const [, desc] of entries()) {
      expect(VALID_CATEGORIES.has(desc.category)).toBe(true);
    }
  });

  test('every summary is a non-empty single line', () => {
    for (const [, desc] of entries()) {
      expect(desc.summary.length).toBeGreaterThan(0);
      expect(desc.summary).not.toContain('\n');
    }
  });

  test('enum params declare a non-empty values list; non-enum params do not', () => {
    for (const [, desc] of entries()) {
      for (const spec of Object.values(desc.params)) {
        if (spec.type === 'enum') {
          expect(Array.isArray(spec.values)).toBe(true);
          expect(spec.values!.length).toBeGreaterThan(0);
        } else {
          expect(spec.values).toBeUndefined();
        }
      }
    }
  });

  test('pagination is present exactly when limit/skip params exist, and vice versa', () => {
    for (const [, desc] of entries()) {
      const hasLimit = 'limit' in desc.params;
      const hasSkip = 'skip' in desc.params;
      // limit and skip always travel together.
      expect(hasLimit).toBe(hasSkip);
      expect(Boolean(desc.pagination)).toBe(hasLimit);
      if (desc.pagination) {
        expect(desc.params.limit.rpcKey).toBe('Limit');
        expect(desc.params.skip.rpcKey).toBe('Skip');
      }
    }
  });

  test('pagination bounds are sane (1 <= defaultLimit <= maxLimit, maxSkip > 0)', () => {
    for (const [, desc] of entries()) {
      if (!desc.pagination) continue;
      const { defaultLimit, maxLimit, maxSkip } = desc.pagination;
      expect(defaultLimit).toBeGreaterThanOrEqual(1);
      expect(defaultLimit).toBeLessThanOrEqual(maxLimit);
      expect(maxSkip).toBeGreaterThan(0);
    }
  });

  test('DEFAULT_PAGINATION matches the contracted defaults and is frozen', () => {
    expect(DEFAULT_PAGINATION).toEqual({ defaultLimit: 20, maxLimit: 100, maxSkip: 10_000 });
    expect(Object.isFrozen(DEFAULT_PAGINATION)).toBe(true);
  });

  test('list_transactions widens maxLimit to 200 (handler self-caps)', () => {
    const desc = METHOD_CATALOG.get('list_transactions');
    expect(desc?.pagination?.maxLimit).toBe(200);
  });

  test('required params are flagged; count/single-get methods take no pagination', () => {
    // Spot-check the security-relevant shape of a few representative descriptors.
    expect(METHOD_CATALOG.get('get_address_summary')?.params.address.required).toBe(true);
    expect(METHOD_CATALOG.get('address_count')?.params).toEqual({});
    expect(METHOD_CATALOG.get('address_count')?.pagination).toBeUndefined();
  });

  test('verified upstream method names and rpcKeys for key methods', () => {
    // These exact names were confirmed against neo3fura biz/api arg structs.
    const expectations: Record<string, { rpcMethod: string; rpcKeys: Record<string, string> }> = {
      get_address_summary: { rpcMethod: 'GetAddressByAddress', rpcKeys: { address: 'Address' } },
      get_block_by_height: {
        rpcMethod: 'GetBlockByBlockHeight',
        rpcKeys: { blockHeight: 'BlockHeight' },
      },
      list_nep11_transfers_by_contract_token: {
        rpcMethod: 'GetNep11TransferByContractHashTokenId',
        rpcKeys: { contractHash: 'ContractHash', tokenId: 'TokenId' },
      },
      get_state_root: { rpcMethod: 'GetStateRoot', rpcKeys: { blockHeight: 'BlockHeight' } },
      list_voters_for_candidate: {
        rpcMethod: 'GetVotersByCandidateAddress',
        rpcKeys: { candidateAddress: 'CandidateAddress' },
      },
      list_assets: { rpcMethod: 'GetAssetInfos', rpcKeys: { standard: 'Standard' } },
    };
    for (const [key, exp] of Object.entries(expectations)) {
      const desc = METHOD_CATALOG.get(key);
      expect(desc).toBeDefined();
      expect(desc!.rpcMethod).toBe(exp.rpcMethod);
      for (const [paramKey, rpcKey] of Object.entries(exp.rpcKeys)) {
        expect(desc!.params[paramKey]?.rpcKey).toBe(rpcKey);
      }
    }
  });

  test('get_nep11_properties is intentionally absent (TokenIds array shape)', () => {
    expect(METHOD_CATALOG.has('get_nep11_properties')).toBe(false);
  });

  test('the Standard enum only permits NEP17 and NEP11', () => {
    expect(METHOD_CATALOG.get('list_assets')?.params.standard.values).toEqual(['NEP17', 'NEP11']);
  });
});
