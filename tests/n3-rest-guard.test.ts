/**
 * Adversarial tests for the Neo N3 n3index REST query guard
 * (src/indexer/n3-rest-guard.ts).
 *
 * The guard is the security boundary for the curated Neo N3 analytical tools. Its threat
 * model is SSRF / path traversal (the model must never author a path), query-key injection,
 * and access to any route not on the read-only allowlist. Every malformed, unknown, or
 * injection-shaped input must be rejected with a typed `ValidationError`, never escape as an
 * uncaught crash, and never place a raw/model string into the request path.
 */

import {
  assertAllowedN3Endpoint,
  buildN3EndpointRequest,
} from '../src/indexer/n3-rest-guard';
import {
  N3_REST_CATALOG,
  type EndpointDescriptor,
  type N3PathParamType,
} from '../src/indexer/n3-rest-catalog';
import { ValidationError } from '../src/utils/errors';

// A real, checksum-valid Neo N3 base58 mainnet address (34 chars).
const VALID_ADDRESS = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';
// An intentionally invalid-checksum address (well-formed shape, bad checksum).
const INVALID_ADDRESS = 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M';
// A real contract/token script hash (GAS): 0x + 40 hex.
const VALID_SCRIPT_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
// A well-formed 0x + 64 hex reference (transaction id / block hash).
const VALID_HASH = `0x${'b'.repeat(64)}`;

function desc(endpoint: string): EndpointDescriptor {
  const d = N3_REST_CATALOG.get(endpoint);
  if (!d) {
    throw new Error(`test setup error: unknown catalog endpoint ${endpoint}`);
  }
  return d;
}

function sampleForType(type: N3PathParamType): string | number {
  switch (type) {
    case 'n3Address':
      return VALID_ADDRESS;
    case 'scriptHash':
      return VALID_SCRIPT_HASH;
    case 'txid':
      return VALID_HASH;
    case 'blockRef':
      return 12345;
  }
}

describe('assertAllowedN3Endpoint — endpoint allowlist', () => {
  it('returns the descriptor for a vetted read-only endpoint', () => {
    const d = assertAllowedN3Endpoint('get_address_summary');
    expect(d.pathTemplate).toBe('accounts/{address}');
  });

  it('rejects an unknown / made-up endpoint key', () => {
    expect(() => assertAllowedN3Endpoint('drop_collection')).toThrow(ValidationError);
    expect(() => assertAllowedN3Endpoint('list_admins')).toThrow(ValidationError);
  });

  it('rejects a raw neo3fura JSON-RPC method name (only REST catalog keys allowed)', () => {
    // The old, broken transport used PascalCase RPC method names; they are not catalog keys.
    expect(() => assertAllowedN3Endpoint('GetAddressByAddress')).toThrow(ValidationError);
    expect(() => assertAllowedN3Endpoint('GetRawTransactionByAddress')).toThrow(ValidationError);
  });

  it('rejects a raw path template passed as the endpoint key (only catalog keys allowed)', () => {
    // A raw REST path is a path VALUE, never a catalog KEY, so it is rejected.
    expect(() => assertAllowedN3Endpoint('accounts/{address}')).toThrow(ValidationError);
    expect(() => assertAllowedN3Endpoint('../../admin')).toThrow(ValidationError);
  });

  it('rejects an empty or non-string endpoint without crashing', () => {
    expect(() => assertAllowedN3Endpoint('')).toThrow(ValidationError);
    expect(() => assertAllowedN3Endpoint(undefined as unknown as string)).toThrow(ValidationError);
    expect(() => assertAllowedN3Endpoint(123 as unknown as string)).toThrow(ValidationError);
  });

  it('names the permitted endpoints in the rejection message (LLM self-correction)', () => {
    let message = '';
    try {
      assertAllowedN3Endpoint('nope');
    } catch (error) {
      message = (error as ValidationError).message;
    }
    expect(message).toContain('get_address_summary');
    expect(message).toContain('Permitted endpoints');
  });
});

describe('buildN3EndpointRequest — path construction (SSRF / traversal)', () => {
  it('substitutes a validated base58 address into the template exactly', () => {
    const out = buildN3EndpointRequest(desc('get_address_summary'), { address: VALID_ADDRESS });
    expect(out).toEqual({ path: `accounts/${VALID_ADDRESS}`, params: {} });
  });

  it('substitutes a validated script hash into a nested token template exactly', () => {
    const out = buildN3EndpointRequest(desc('list_token_holders'), { hash: VALID_SCRIPT_HASH });
    expect(out).toEqual({ path: `tokens/${VALID_SCRIPT_HASH}/holders`, params: {} });
  });

  it('substitutes a validated txid into the transaction template exactly', () => {
    const out = buildN3EndpointRequest(desc('get_transaction'), { txid: VALID_HASH });
    expect(out).toEqual({ path: `transactions/${VALID_HASH}`, params: {} });
  });

  it('accepts a decimal block index as a blockRef segment', () => {
    const out = buildN3EndpointRequest(desc('get_block'), { blockRef: 42 });
    expect(out).toEqual({ path: 'blocks/42', params: {} });
  });

  it('accepts a block hash as a blockRef segment', () => {
    const out = buildN3EndpointRequest(desc('get_block'), { blockRef: VALID_HASH });
    expect(out).toEqual({ path: `blocks/${VALID_HASH}`, params: {} });
  });

  it('rejects a path-traversal payload in an address param (T: SSRF)', () => {
    // Guard: validateAddress — remove it and '../../admin' would enter the path.
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), { address: '../../admin' }),
    ).toThrow(ValidationError);
  });

  it('rejects a slash / encoded-slash payload in an address param', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), { address: `${VALID_ADDRESS}/balances` }),
    ).toThrow(ValidationError);
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), { address: '..%2f..%2fadmin' }),
    ).toThrow(ValidationError);
  });

  it('rejects an invalid-checksum address that is otherwise well-shaped', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), { address: INVALID_ADDRESS }),
    ).toThrow(ValidationError);
  });

  it('rejects a traversal payload in a script-hash param', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_token'), { hash: '../../../etc/passwd' }),
    ).toThrow(ValidationError);
  });

  it('rejects a traversal payload in a txid param', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_transaction'), { txid: '../../../etc/passwd' }),
    ).toThrow(ValidationError);
  });

  it('rejects a traversal or non-numeric payload in a blockRef param', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_block'), { blockRef: '1/../../admin' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildN3EndpointRequest(desc('get_block'), { blockRef: 'latest' }),
    ).toThrow(ValidationError);
  });

  it('rejects an operator object smuggled as a path value (no crash)', () => {
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), {
        address: { $ne: null } as unknown as string,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects a missing required path param', () => {
    expect(() => buildN3EndpointRequest(desc('get_address_summary'), {})).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('get_transaction'), {})).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('get_block'), {})).toThrow(ValidationError);
  });

  it('never leaves an unsubstituted placeholder for any catalog endpoint', () => {
    for (const d of N3_REST_CATALOG.values()) {
      const input: Record<string, unknown> = {};
      if (d.pathParam) {
        input[d.pathParam.key] = sampleForType(d.pathParam.type);
      }
      if (d.queryParams) {
        for (const [qk, qs] of Object.entries(d.queryParams)) {
          if (qs.required) {
            input[qk] = qs.type === 'int' ? 1 : 'sample';
          }
        }
      }
      const { path } = buildN3EndpointRequest(d, input);
      expect(path.includes('{')).toBe(false);
      expect(path.includes('}')).toBe(false);
      expect(path.includes('..')).toBe(false);
      // The path must start with the trusted, non-placeholder prefix of its template.
      const staticPrefix = d.pathTemplate.split('{')[0];
      expect(path.startsWith(staticPrefix)).toBe(true);
    }
  });
});

describe('buildN3EndpointRequest — query-param allowlist', () => {
  it('clamps an oversize limit to the 100 cap', () => {
    const out = buildN3EndpointRequest(desc('list_blocks'), { limit: 9999 });
    expect(out).toEqual({ path: 'blocks', params: { limit: 100 } });
  });

  it('clamps an oversize offset to the 10000 cap', () => {
    const out = buildN3EndpointRequest(desc('list_transactions'), { offset: 999999 });
    expect(out).toEqual({ path: 'transactions', params: { offset: 10000 } });
  });

  it('passes through in-range pagination unchanged', () => {
    const out = buildN3EndpointRequest(desc('list_blocks'), { limit: 20, offset: 40 });
    expect(out).toEqual({ path: 'blocks', params: { limit: 20, offset: 40 } });
  });

  it('accepts a numeric-string limit and clamps it', () => {
    const out = buildN3EndpointRequest(desc('list_blocks'), { limit: '9999' });
    expect(out).toEqual({ path: 'blocks', params: { limit: 100 } });
  });

  it('rejects a negative or non-integer pagination value', () => {
    // Guard: validateInteger — remove it and a negative/float would leak upstream.
    expect(() => buildN3EndpointRequest(desc('list_blocks'), { limit: -5 })).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('list_blocks'), { limit: 1.5 })).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('list_blocks'), { offset: 'abc' })).toThrow(ValidationError);
  });

  it('rejects an unknown query key rather than forwarding it (injection)', () => {
    // Guard: strict per-endpoint key whitelist — remove it and { evil } would leak upstream.
    expect(() =>
      buildN3EndpointRequest(desc('list_blocks'), { limit: 20, evil: '1' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildN3EndpointRequest(desc('get_address_summary'), { address: VALID_ADDRESS, apikey: 'x' }),
    ).toThrow(ValidationError);
  });

  it('requires q for the search endpoint', () => {
    expect(() => buildN3EndpointRequest(desc('search'), {})).toThrow(ValidationError);
  });

  it('sanitizes and forwards a valid search query', () => {
    const out = buildN3EndpointRequest(desc('search'), { q: 'flamingo' });
    expect(out).toEqual({ path: 'search', params: { q: 'flamingo' } });
  });

  it('strips control/markup from a query string and rejects an empty result', () => {
    const out = buildN3EndpointRequest(desc('search'), { q: '  neo<b>x</b>token  ' });
    expect(out.params.q).toBe('neoxtoken');
    expect(() =>
      buildN3EndpointRequest(desc('search'), { q: '<script>alert(1)</script>' }),
    ).toThrow(ValidationError);
  });

  it('rejects an oversize query string', () => {
    expect(() =>
      buildN3EndpointRequest(desc('search'), { q: 'x'.repeat(257) }),
    ).toThrow(ValidationError);
  });

  it('rejects a non-string query value without crashing', () => {
    expect(() =>
      buildN3EndpointRequest(desc('search'), { q: { $where: '1' } as unknown as string }),
    ).toThrow(ValidationError);
  });

  it('validates the governance candidate filter alongside pagination', () => {
    const candidate = `02${'a'.repeat(64)}`;
    const out = buildN3EndpointRequest(desc('list_candidate_voters'), { candidate, limit: 10 });
    expect(out).toEqual({ path: 'governance/voters', params: { limit: 10, candidate } });
  });

  it('omits absent optional pagination params', () => {
    const out = buildN3EndpointRequest(desc('list_blocks'), {});
    expect(out).toEqual({ path: 'blocks', params: {} });
  });

  it('builds path + query together for an address + pagination endpoint', () => {
    const out = buildN3EndpointRequest(desc('list_address_transactions'), {
      address: VALID_ADDRESS,
      limit: 5,
    });
    expect(out).toEqual({
      path: `accounts/${VALID_ADDRESS}/transactions`,
      params: { limit: 5 },
    });
  });
});

describe('buildN3EndpointRequest — hostile input never crashes', () => {
  it('rejects a non-object params input', () => {
    expect(() => buildN3EndpointRequest(desc('list_blocks'), 42 as unknown)).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('list_blocks'), 'x' as unknown)).toThrow(ValidationError);
    expect(() => buildN3EndpointRequest(desc('list_blocks'), [] as unknown)).toThrow(ValidationError);
  });

  it('treats null/undefined input as empty for a no-arg endpoint', () => {
    expect(buildN3EndpointRequest(desc('network_summary'), undefined)).toEqual({
      path: 'summary',
      params: {},
    });
    expect(buildN3EndpointRequest(desc('list_blocks'), null)).toEqual({ path: 'blocks', params: {} });
  });

  it('rejects any extra key on a no-arg endpoint (injection)', () => {
    expect(() =>
      buildN3EndpointRequest(desc('network_summary'), { $where: 'sleep(9999)' }),
    ).toThrow(ValidationError);
  });

  it('rejects a prototype-pollution style key', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "address": "0x00"}');
    expect(() => buildN3EndpointRequest(desc('get_address_summary'), hostile)).toThrow(ValidationError);
  });

  it('tolerates network/endpoint keys without forwarding them (mainnet resolved by handler)', () => {
    const out = buildN3EndpointRequest(desc('get_address_summary'), {
      address: VALID_ADDRESS,
      network: 'testnet',
      endpoint: 'get_address_summary',
    });
    expect(out).toEqual({ path: `accounts/${VALID_ADDRESS}`, params: {} });
    expect(out.params).not.toHaveProperty('network');
  });
});

describe('N3_REST_CATALOG — invariants', () => {
  it('is non-empty and deeply frozen', () => {
    expect(N3_REST_CATALOG.size).toBeGreaterThan(0);
    expect(Object.isFrozen(N3_REST_CATALOG)).toBe(true);
    for (const d of N3_REST_CATALOG.values()) {
      expect(Object.isFrozen(d)).toBe(true);
      if (d.pathParam) {
        expect(Object.isFrozen(d.pathParam)).toBe(true);
      }
      if (d.queryParams) {
        expect(Object.isFrozen(d.queryParams)).toBe(true);
        for (const spec of Object.values(d.queryParams)) {
          expect(Object.isFrozen(spec)).toBe(true);
        }
      }
    }
  });

  it('reports the expected verified endpoint count', () => {
    expect(N3_REST_CATALOG.size).toBe(19);
  });

  it('exposes exactly the vetted semantic endpoint keys', () => {
    expect([...N3_REST_CATALOG.keys()].sort()).toEqual(
      [
        'analytics_daily',
        'get_address_summary',
        'get_block',
        'get_contract',
        'get_token',
        'get_transaction',
        'list_address_balances',
        'list_address_transactions',
        'list_address_transfers',
        'list_blocks',
        'list_candidate_voters',
        'list_contract_calls',
        'list_contract_notifications',
        'list_contracts',
        'list_token_holders',
        'list_tokens',
        'list_transactions',
        'network_summary',
        'search',
      ].sort(),
    );
  });

  it('keeps every template placeholder consistent with its pathParam', () => {
    for (const [key, d] of N3_REST_CATALOG) {
      const hasPlaceholder = d.pathTemplate.includes('{');
      expect(`${key}:${hasPlaceholder}`).toBe(`${key}:${Boolean(d.pathParam)}`);
      if (d.pathParam) {
        expect(d.pathTemplate).toContain(`{${d.pathParam.key}}`);
      }
    }
  });
});
