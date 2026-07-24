/**
 * Adversarial tests for the Neo X Blockscout query guard
 * (src/indexer/blockscout-query-guard.ts).
 *
 * The guard is the security boundary for the generic `x_query` tool. Its threat model is
 * SSRF / path traversal (the model must never author a path), query-key injection, and
 * write-route access. Every malformed, unknown, or injection-shaped input must be rejected
 * with a typed `ValidationError`, never escape as an uncaught crash, and never place a
 * raw/model string into the request path.
 */

import {
  assertAllowedEndpoint,
  buildEndpointRequest,
} from '../src/indexer/blockscout-query-guard';
import {
  X_ENDPOINT_CATALOG,
  type EndpointDescriptor,
  type EvmPathParamType,
} from '../src/indexer/blockscout-catalog';
import { ValidationError } from '../src/utils/errors';

// A well-formed lowercase EVM address (0x + 40 hex).
const VALID_ADDRESS = `0x${'a'.repeat(40)}`;
// A well-formed EVM 32-byte hash (0x + 64 hex).
const VALID_HASH = `0x${'b'.repeat(64)}`;

function desc(endpoint: string): EndpointDescriptor {
  const d = X_ENDPOINT_CATALOG.get(endpoint);
  if (!d) {
    throw new Error(`test setup error: unknown catalog endpoint ${endpoint}`);
  }
  return d;
}

function sampleForType(type: EvmPathParamType): string | number {
  switch (type) {
    case 'evmAddress':
      return VALID_ADDRESS;
    case 'evmHash':
      return VALID_HASH;
    case 'blockRef':
      return 12345;
  }
}

describe('assertAllowedEndpoint — endpoint allowlist', () => {
  it('returns the descriptor for a vetted read-only endpoint', () => {
    const d = assertAllowedEndpoint('get_address');
    expect(d.pathTemplate).toBe('addresses/{address}');
  });

  it('rejects an unknown / made-up endpoint key', () => {
    expect(() => assertAllowedEndpoint('drop_database')).toThrow(ValidationError);
    expect(() => assertAllowedEndpoint('list_admins')).toThrow(ValidationError);
  });

  it('rejects a raw path template passed as the endpoint key (only catalog keys allowed)', () => {
    // A raw Blockscout path is a path VALUE, never a catalog KEY, so it is rejected.
    expect(() => assertAllowedEndpoint('addresses/{address}')).toThrow(ValidationError);
    expect(() => assertAllowedEndpoint('../../admin')).toThrow(ValidationError);
  });

  it('rejects an empty or non-string endpoint without crashing', () => {
    expect(() => assertAllowedEndpoint('')).toThrow(ValidationError);
    expect(() => assertAllowedEndpoint(undefined as unknown as string)).toThrow(ValidationError);
    expect(() => assertAllowedEndpoint(123 as unknown as string)).toThrow(ValidationError);
  });

  it('names the permitted endpoints in the rejection message (LLM self-correction)', () => {
    let message = '';
    try {
      assertAllowedEndpoint('nope');
    } catch (error) {
      message = (error as ValidationError).message;
    }
    expect(message).toContain('get_address');
    expect(message).toContain('Permitted endpoints');
  });
});

describe('buildEndpointRequest — path construction (SSRF / traversal)', () => {
  it('substitutes a validated address into the template exactly', () => {
    const out = buildEndpointRequest(desc('get_address'), { address: VALID_ADDRESS });
    expect(out).toEqual({ path: `addresses/${VALID_ADDRESS}`, params: {} });
  });

  it('substitutes a validated hash into a nested tx template exactly', () => {
    const out = buildEndpointRequest(desc('get_transaction_token_transfers'), {
      hash: VALID_HASH,
    });
    expect(out).toEqual({ path: `transactions/${VALID_HASH}/token-transfers`, params: {} });
  });

  it('accepts a decimal block number as a blockRef segment', () => {
    const out = buildEndpointRequest(desc('get_block'), { blockRef: 42 });
    expect(out).toEqual({ path: 'blocks/42', params: {} });
  });

  it('accepts a block hash as a blockRef segment', () => {
    const out = buildEndpointRequest(desc('get_block'), { blockRef: VALID_HASH });
    expect(out).toEqual({ path: `blocks/${VALID_HASH}`, params: {} });
  });

  it('rejects a path-traversal payload in an address param (T: SSRF)', () => {
    // Guard: validateEvmAddress — remove it and '../../admin' would enter the path.
    expect(() =>
      buildEndpointRequest(desc('get_address'), { address: '../../admin' }),
    ).toThrow(ValidationError);
  });

  it('rejects an encoded-slash payload in an address param', () => {
    expect(() =>
      buildEndpointRequest(desc('get_address'), { address: '0x..%2fadmin' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildEndpointRequest(desc('get_address'), { address: `${VALID_ADDRESS}/counters` }),
    ).toThrow(ValidationError);
  });

  it('rejects a traversal payload in a hash param', () => {
    expect(() =>
      buildEndpointRequest(desc('get_transaction'), { hash: '../../../etc/passwd' }),
    ).toThrow(ValidationError);
  });

  it('rejects a traversal payload in a blockRef param', () => {
    expect(() =>
      buildEndpointRequest(desc('get_block'), { blockRef: '1/../../admin' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildEndpointRequest(desc('get_block'), { blockRef: 'latest' }),
    ).toThrow(ValidationError);
  });

  it('rejects an operator object smuggled as a path value (no crash)', () => {
    expect(() =>
      buildEndpointRequest(desc('get_address'), { address: { $ne: null } as unknown as string }),
    ).toThrow(ValidationError);
  });

  it('rejects a missing required path param', () => {
    expect(() => buildEndpointRequest(desc('get_address'), {})).toThrow(ValidationError);
    expect(() => buildEndpointRequest(desc('get_transaction'), {})).toThrow(ValidationError);
  });

  it('never leaves an unsubstituted placeholder for any catalog endpoint', () => {
    for (const d of X_ENDPOINT_CATALOG.values()) {
      const input: Record<string, unknown> = {};
      if (d.pathParam) {
        input[d.pathParam.key] = sampleForType(d.pathParam.type);
      }
      if (d.queryParams) {
        for (const [qk, qs] of Object.entries(d.queryParams)) {
          if (qs.required) {
            input[qk] = qs.type === 'enum' ? (qs.values ?? [])[0] : 'sample';
          }
        }
      }
      const { path } = buildEndpointRequest(d, input);
      expect(path.includes('{')).toBe(false);
      expect(path.includes('}')).toBe(false);
      expect(path.includes('..')).toBe(false);
      // The path must start with the trusted, non-placeholder prefix of its template.
      const staticPrefix = d.pathTemplate.split('{')[0];
      expect(path.startsWith(staticPrefix)).toBe(true);
    }
  });
});

describe('buildEndpointRequest — query-param allowlist', () => {
  it('emits an allowlisted enum query value', () => {
    const out = buildEndpointRequest(desc('list_transactions'), { filter: 'validated' });
    expect(out).toEqual({ path: 'transactions', params: { filter: 'validated' } });
  });

  it('rejects a bad enum value', () => {
    // Guard: validateQueryValue enum membership — remove it and 'evil' would pass upstream.
    expect(() =>
      buildEndpointRequest(desc('list_transactions'), { filter: 'evil' }),
    ).toThrow(ValidationError);
  });

  it('rejects an unknown query key rather than forwarding it (injection)', () => {
    // Guard: strict per-endpoint key whitelist — remove it and { evil } would leak upstream.
    expect(() =>
      buildEndpointRequest(desc('list_transactions'), { filter: 'validated', evil: '1' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildEndpointRequest(desc('get_address'), { address: VALID_ADDRESS, apikey: 'x' }),
    ).toThrow(ValidationError);
  });

  it('requires q for the search endpoint', () => {
    expect(() => buildEndpointRequest(desc('search'), {})).toThrow(ValidationError);
  });

  it('sanitizes and forwards a valid search query', () => {
    const out = buildEndpointRequest(desc('search'), { q: 'flamingo' });
    expect(out).toEqual({ path: 'search', params: { q: 'flamingo' } });
  });

  it('strips control/markup from a query string and rejects an empty result', () => {
    // sanitizeString removes non-script tags but keeps their inner text, drops <script>
    // content entirely, and trims — so markup can never reach the upstream query string.
    const out = buildEndpointRequest(desc('list_smart_contracts'), { q: '  neo<b>x</b>token  ' });
    expect(out.params.q).toBe('neoxtoken');
    expect(() =>
      buildEndpointRequest(desc('list_smart_contracts'), { q: '<script>alert(1)</script>' }),
    ).toThrow(ValidationError);
  });

  it('rejects an oversize query string', () => {
    expect(() =>
      buildEndpointRequest(desc('list_smart_contracts'), { q: 'x'.repeat(257) }),
    ).toThrow(ValidationError);
  });

  it('rejects a non-string query value without crashing', () => {
    expect(() =>
      buildEndpointRequest(desc('search'), { q: { $where: '1' } as unknown as string }),
    ).toThrow(ValidationError);
  });

  it('omits an absent optional query param', () => {
    const out = buildEndpointRequest(desc('list_transactions'), {});
    expect(out).toEqual({ path: 'transactions', params: {} });
  });

  it('builds path + query together for an address+filter endpoint', () => {
    const out = buildEndpointRequest(desc('list_address_transactions'), {
      address: VALID_ADDRESS,
      filter: 'to',
    });
    expect(out).toEqual({
      path: `addresses/${VALID_ADDRESS}/transactions`,
      params: { filter: 'to' },
    });
  });

  it('validates the token-list combined name + type filters', () => {
    const out = buildEndpointRequest(desc('list_tokens'), { q: 'gas', type: 'ERC-20' });
    expect(out).toEqual({ path: 'tokens', params: { q: 'gas', type: 'ERC-20' } });
    expect(() =>
      buildEndpointRequest(desc('list_tokens'), { q: 'gas', type: 'ERC-999' }),
    ).toThrow(ValidationError);
  });
});

describe('buildEndpointRequest — hostile input never crashes', () => {
  it('rejects a non-object params input', () => {
    expect(() => buildEndpointRequest(desc('list_blocks'), 42 as unknown)).toThrow(ValidationError);
    expect(() => buildEndpointRequest(desc('list_blocks'), 'x' as unknown)).toThrow(ValidationError);
    expect(() => buildEndpointRequest(desc('list_blocks'), [] as unknown)).toThrow(ValidationError);
  });

  it('treats null/undefined input as empty for a no-arg endpoint', () => {
    expect(buildEndpointRequest(desc('stats'), undefined)).toEqual({ path: 'stats', params: {} });
    expect(buildEndpointRequest(desc('list_blocks'), null)).toEqual({ path: 'blocks', params: {} });
  });

  it('rejects any extra key on a no-arg endpoint (injection)', () => {
    expect(() =>
      buildEndpointRequest(desc('stats'), { $where: 'sleep(9999)' }),
    ).toThrow(ValidationError);
  });

  it('rejects a prototype-pollution style key', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "address": "0x00"}');
    expect(() => buildEndpointRequest(desc('get_address'), hostile)).toThrow(ValidationError);
  });

  it('tolerates network/endpoint keys without forwarding them (mainnet resolved by handler)', () => {
    const out = buildEndpointRequest(desc('get_address'), {
      address: VALID_ADDRESS,
      network: 'neox-testnet',
      endpoint: 'get_address',
    });
    expect(out).toEqual({ path: `addresses/${VALID_ADDRESS}`, params: {} });
    expect(out.params).not.toHaveProperty('network');
  });
});

describe('X_ENDPOINT_CATALOG — invariants', () => {
  it('is non-empty and deeply frozen', () => {
    expect(X_ENDPOINT_CATALOG.size).toBeGreaterThan(0);
    expect(Object.isFrozen(X_ENDPOINT_CATALOG)).toBe(true);
    for (const d of X_ENDPOINT_CATALOG.values()) {
      expect(Object.isFrozen(d)).toBe(true);
      if (d.queryParams) {
        expect(Object.isFrozen(d.queryParams)).toBe(true);
        for (const spec of Object.values(d.queryParams)) {
          expect(Object.isFrozen(spec)).toBe(true);
        }
      }
    }
  });

  it('reports the expected verified endpoint count', () => {
    expect(X_ENDPOINT_CATALOG.size).toBe(33);
  });

  it('keeps every template placeholder consistent with its pathParam', () => {
    for (const [key, d] of X_ENDPOINT_CATALOG) {
      const hasPlaceholder = d.pathTemplate.includes('{');
      expect(`${key}:${hasPlaceholder}`).toBe(`${key}:${Boolean(d.pathParam)}`);
      if (d.pathParam) {
        expect(d.pathTemplate).toContain(`{${d.pathParam.key}}`);
      }
    }
  });
});
