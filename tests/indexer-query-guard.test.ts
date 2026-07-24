/**
 * Adversarial tests for the Phase 1 indexer query guard
 * (src/indexer/indexer-query-guard.ts).
 *
 * The guard is the security boundary for the generic `query_indexer` tool: it must
 * reject every malformed, unknown, or injection-shaped input with a typed
 * `ValidationError` and never let anything escape as an uncaught crash. Each adversarial
 * case is annotated with the threat (Txx from the build contract) it pins; if the
 * corresponding guard were removed the case would stop throwing (or stop clamping) and the
 * assertion here would fail.
 */

import { assertAllowedMethod, buildMethodParams } from '../src/indexer/indexer-query-guard';
import { METHOD_CATALOG, type MethodDescriptor } from '../src/indexer/indexer-catalog';
import { ValidationError } from '../src/utils/errors';

// A checksum-valid Neo N3 mainnet address (also used in tests/validation.test.ts).
const VALID_ADDRESS = 'NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY';
// The GAS token script hash (20 bytes / 40 hex, 0x-prefixed).
const VALID_SCRIPT_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
// A well-formed 32-byte hash (64 hex, 0x-prefixed).
const VALID_HASH = `0x${'a'.repeat(64)}`;

function desc(method: string): MethodDescriptor {
  const d = METHOD_CATALOG.get(method);
  if (!d) {
    throw new Error(`test setup error: unknown catalog method ${method}`);
  }
  return d;
}

describe('assertAllowedMethod — method allowlist (T1/T2)', () => {
  it('returns the descriptor for a vetted read-only method', () => {
    const d = assertAllowedMethod('get_address_summary');
    expect(d.rpcMethod).toBe('GetAddressByAddress');
  });

  it('rejects a write/admin mutator method (T1)', () => {
    // Guard: METHOD_CATALOG.has() — remove it and admin methods would proxy through.
    expect(() => assertAllowedMethod('InsertVerifiedContract')).toThrow(ValidationError);
  });

  it('rejects a made-up / dangerous method name (T2)', () => {
    expect(() => assertAllowedMethod('DropDatabase')).toThrow(ValidationError);
    expect(() => assertAllowedMethod('GetNeoFsImage')).toThrow(ValidationError);
  });

  it('rejects a raw upstream rpcMethod passed as the key (only tool keys are allowed)', () => {
    // 'GetAddressByAddress' is an rpcMethod value, not a catalog KEY, so it is rejected.
    expect(() => assertAllowedMethod('GetAddressByAddress')).toThrow(ValidationError);
  });

  it('rejects an empty or non-string method without crashing', () => {
    expect(() => assertAllowedMethod('')).toThrow(ValidationError);
    expect(() => assertAllowedMethod(undefined as unknown as string)).toThrow(ValidationError);
    expect(() => assertAllowedMethod(123 as unknown as string)).toThrow(ValidationError);
  });

  it('names the permitted methods in the rejection message (LLM self-correction)', () => {
    let message = '';
    try {
      assertAllowedMethod('nope');
    } catch (error) {
      message = (error as ValidationError).message;
    }
    expect(message).toContain('get_address_summary');
    expect(message).toContain('Permitted methods');
  });
});

describe('buildMethodParams — typed param whitelist', () => {
  it('builds the exact upstream params for a valid address method', () => {
    const out = buildMethodParams(desc('get_address_summary'), { address: VALID_ADDRESS });
    expect(out).toEqual({ Address: VALID_ADDRESS });
  });

  it('accepts a 0x script hash for an address-typed param (dual form)', () => {
    const out = buildMethodParams(desc('get_address_summary'), { address: VALID_SCRIPT_HASH });
    expect(out).toEqual({ Address: VALID_SCRIPT_HASH });
  });

  it('rejects a malformed address, building no upstream object (T12)', () => {
    // Guard: validateAddressParam — remove it and 'not-an-address' would pass through.
    expect(() =>
      buildMethodParams(desc('get_address_summary'), { address: 'not-an-address' }),
    ).toThrow(ValidationError);
  });

  it('rejects an operator object smuggled as an address value (T12)', () => {
    expect(() =>
      buildMethodParams(desc('get_address_summary'), { address: { $ne: null } }),
    ).toThrow(ValidationError);
  });

  it('rejects a missing required param', () => {
    expect(() => buildMethodParams(desc('get_address_summary'), {})).toThrow(ValidationError);
  });

  it('rejects an extra unknown key rather than spreading it upstream (T18)', () => {
    // Guard: strict per-method key whitelist — remove it and { evil } would leak upstream.
    expect(() =>
      buildMethodParams(desc('get_address_summary'), {
        address: VALID_ADDRESS,
        evil: { $where: '1' },
      }),
    ).toThrow(ValidationError);
  });

  it('tolerates a network key without forwarding it (mainnet resolved by the handler)', () => {
    const out = buildMethodParams(desc('get_address_summary'), {
      address: VALID_ADDRESS,
      network: 'testnet',
    });
    expect(out).toEqual({ Address: VALID_ADDRESS });
    expect(out).not.toHaveProperty('network');
  });

  it('validates a script-hash param and normalizes to 0x form', () => {
    const out = buildMethodParams(desc('get_asset_by_contract'), {
      contractHash: VALID_SCRIPT_HASH,
    });
    expect(out).toEqual({ ContractHash: VALID_SCRIPT_HASH });
  });

  it('rejects a malformed script hash', () => {
    expect(() =>
      buildMethodParams(desc('get_asset_by_contract'), { contractHash: '0xdead' }),
    ).toThrow(ValidationError);
  });

  it('validates a hash param and normalizes to 0x form', () => {
    const out = buildMethodParams(desc('get_transaction'), { transactionHash: VALID_HASH });
    expect(out).toEqual({ TransactionHash: VALID_HASH });
  });

  it('rejects a malformed hash', () => {
    expect(() =>
      buildMethodParams(desc('get_transaction'), { transactionHash: 'zz' }),
    ).toThrow(ValidationError);
  });

  it('validates a blockHeight param', () => {
    const out = buildMethodParams(desc('get_block_by_height'), { blockHeight: 42 });
    expect(out).toEqual({ BlockHeight: 42 });
  });

  it('rejects a negative or non-integer blockHeight', () => {
    expect(() =>
      buildMethodParams(desc('get_block_by_height'), { blockHeight: -1 }),
    ).toThrow(ValidationError);
    expect(() =>
      buildMethodParams(desc('get_block_by_height'), { blockHeight: 1.5 }),
    ).toThrow(ValidationError);
  });

  it('validates an enum param against its permitted values', () => {
    const out = buildMethodParams(desc('list_assets'), { standard: 'NEP17' });
    expect(out).toMatchObject({ Standard: 'NEP17' });
  });

  it('rejects an enum value outside the permitted set', () => {
    expect(() =>
      buildMethodParams(desc('list_assets'), { standard: 'NEP42' }),
    ).toThrow(ValidationError);
  });

  it('validates a tokenId param and rejects out-of-charset / oversize ids', () => {
    const ok = buildMethodParams(desc('list_nep11_transfers_by_contract_token'), {
      contractHash: VALID_SCRIPT_HASH,
      tokenId: 'QUJD',
    });
    expect(ok).toMatchObject({ ContractHash: VALID_SCRIPT_HASH, TokenId: 'QUJD' });

    expect(() =>
      buildMethodParams(desc('list_nep11_transfers_by_contract_token'), {
        contractHash: VALID_SCRIPT_HASH,
        tokenId: 'bad token id!',
      }),
    ).toThrow(ValidationError);
    expect(() =>
      buildMethodParams(desc('list_nep11_transfers_by_contract_token'), {
        contractHash: VALID_SCRIPT_HASH,
        tokenId: 'A'.repeat(129),
      }),
    ).toThrow(ValidationError);
  });

  it('sanitizes a name param and rejects an oversize name', () => {
    const out = buildMethodParams(desc('search_contracts_by_name'), { name: 'flamingo' });
    expect(out).toMatchObject({ Name: 'flamingo' });
    expect(() =>
      buildMethodParams(desc('search_contracts_by_name'), { name: 'x'.repeat(65) }),
    ).toThrow(ValidationError);
  });

  it('builds only the vetted rpcKeys for a multi-param method', () => {
    const out = buildMethodParams(desc('list_nep17_transfers_by_address'), {
      address: VALID_ADDRESS,
      start: 1000,
      end: 2000,
      limit: 10,
      skip: 5,
    });
    expect(out).toEqual({ Address: VALID_ADDRESS, Start: 1000, End: 2000, Limit: 10, Skip: 5 });
  });

  it('omits an absent optional param (state root without a block height)', () => {
    const out = buildMethodParams(desc('get_state_root'), {});
    expect(out).toEqual({});
  });
});

describe('buildMethodParams — pagination clamp (T13/T14)', () => {
  it('clamps an oversize limit to the method max (T13)', () => {
    // Guard: clampPagination upper bound — remove it and 5000 would reach upstream.
    const out = buildMethodParams(desc('list_transactions'), { limit: 5000 });
    expect(out.Limit).toBe(200); // list_transactions.maxLimit
  });

  it('clamps an oversize limit to the default 100 cap for a default-paginated method', () => {
    const out = buildMethodParams(desc('list_blocks'), { limit: 5000 });
    expect(out.Limit).toBe(100); // DEFAULT_PAGINATION.maxLimit
  });

  it('clamps a deep skip to the method max (T14)', () => {
    // Guard: clampPagination upper bound — remove it and 1e9 would reach upstream.
    const out = buildMethodParams(desc('list_transactions'), { skip: 1e9 });
    expect(out.Skip).toBe(10_000); // maxSkip
  });

  it('clamps a below-min limit up to 1', () => {
    const out = buildMethodParams(desc('list_blocks'), { limit: 0 });
    expect(out.Limit).toBe(1);
  });

  it('defaults limit and skip when absent so upstream is always bounded', () => {
    const out = buildMethodParams(desc('list_blocks'), {});
    expect(out).toEqual({ Limit: 20, Skip: 0 });
  });

  it('rejects a non-integer / negative pagination value without crashing', () => {
    expect(() => buildMethodParams(desc('list_blocks'), { limit: 'lots' })).toThrow(
      ValidationError,
    );
    expect(() => buildMethodParams(desc('list_blocks'), { skip: -5 })).toThrow(ValidationError);
  });
});

describe('buildMethodParams — hostile input never crashes', () => {
  it('rejects a non-object params input', () => {
    expect(() => buildMethodParams(desc('list_blocks'), 42 as unknown)).toThrow(ValidationError);
    expect(() => buildMethodParams(desc('list_blocks'), 'x' as unknown)).toThrow(ValidationError);
    expect(() => buildMethodParams(desc('list_blocks'), [] as unknown)).toThrow(ValidationError);
  });

  it('treats null/undefined input as empty for a no-arg method', () => {
    expect(buildMethodParams(desc('block_count'), undefined)).toEqual({});
    expect(buildMethodParams(desc('block_count'), null)).toEqual({});
  });

  it('rejects any extra key on a no-arg method (T18)', () => {
    expect(() =>
      buildMethodParams(desc('block_count'), { $where: 'sleep(9999)' }),
    ).toThrow(ValidationError);
  });

  it('rejects a prototype-pollution style key', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "address": "x"}');
    expect(() => buildMethodParams(desc('get_address_summary'), hostile)).toThrow(ValidationError);
  });
});
