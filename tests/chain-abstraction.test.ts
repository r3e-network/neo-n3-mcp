/**
 * Chain abstraction layer.
 *
 * The unified tool surface exposes two orthogonal axes to callers:
 *   chain:   'n3' | 'neox'
 *   network: 'mainnet' | 'testnet'
 *
 * Neither axis leaks a backend-specific identifier. Internally Neo N3 resolves
 * to `NeoNetwork` ('mainnet' | 'testnet') and Neo X resolves to the EVM network
 * id ('neox-mainnet' | 'neox-testnet'). These tests pin that mapping, the
 * capability table that says which chain supports which backend, and the
 * read-only boundary the Neo X node adapter must never cross.
 */

import {
  CHAIN_IDS,
  ChainId,
  assertChainSupportsBackend,
  chainDisplayName,
  isChainId,
  resolveChainNetwork,
  resolveN3Network,
  resolveNeoxNetwork,
  supportsBackend,
} from '../src/chains/chain-id';
import { NEOX_NODE_READ_METHODS, neoxNodeCall } from '../src/chains/neox-node-adapter';
import { EVM_FORBIDDEN_METHODS, EVM_READ_ONLY_METHODS } from '../src/contracts/evm-rpc-client';
import { NeoNetwork } from '../src/services/neo-service';
import { ValidationError } from '../src/utils/errors';

describe('chain identifiers', () => {
  it('exposes exactly the two supported chains', () => {
    expect(CHAIN_IDS).toEqual(['n3', 'neox']);
  });

  it('recognizes valid chain ids and rejects everything else', () => {
    expect(isChainId('n3')).toBe(true);
    expect(isChainId('neox')).toBe(true);
    expect(isChainId('N3')).toBe(false);
    expect(isChainId('neo3')).toBe(false);
    expect(isChainId('')).toBe(false);
    expect(isChainId(undefined)).toBe(false);
    expect(isChainId(null)).toBe(false);
    expect(isChainId(42)).toBe(false);
  });

  it('renders human-readable chain names', () => {
    expect(chainDisplayName('n3')).toBe('Neo N3');
    expect(chainDisplayName('neox')).toBe('Neo X');
  });
});

describe('resolveN3Network', () => {
  it('defaults to mainnet', () => {
    expect(resolveN3Network(undefined)).toBe(NeoNetwork.MAINNET);
  });

  it('accepts both networks case-insensitively', () => {
    expect(resolveN3Network('mainnet')).toBe(NeoNetwork.MAINNET);
    expect(resolveN3Network('TESTNET')).toBe(NeoNetwork.TESTNET);
    expect(resolveN3Network(' testnet ')).toBe(NeoNetwork.TESTNET);
  });

  it('rejects Neo X network ids so a chain mix-up cannot silently target mainnet', () => {
    expect(() => resolveN3Network('neox-mainnet')).toThrow(ValidationError);
    expect(() => resolveN3Network('neox-testnet')).toThrow(ValidationError);
    expect(() => resolveN3Network('devnet')).toThrow(ValidationError);
  });
});

describe('resolveNeoxNetwork', () => {
  it('defaults to Neo X mainnet', () => {
    expect(resolveNeoxNetwork(undefined)).toBe('neox-mainnet');
  });

  it('maps the orthogonal network axis onto the EVM network id', () => {
    expect(resolveNeoxNetwork('mainnet')).toBe('neox-mainnet');
    expect(resolveNeoxNetwork('testnet')).toBe('neox-testnet');
  });

  it('still accepts the explicit legacy neox-prefixed ids', () => {
    expect(resolveNeoxNetwork('neox-mainnet')).toBe('neox-mainnet');
    expect(resolveNeoxNetwork('neox-testnet')).toBe('neox-testnet');
  });

  it('rejects unknown networks', () => {
    expect(() => resolveNeoxNetwork('devnet')).toThrow(ValidationError);
  });
});

describe('resolveChainNetwork', () => {
  it('routes by chain to the matching backend network id', () => {
    expect(resolveChainNetwork('n3', 'testnet')).toBe('testnet');
    expect(resolveChainNetwork('neox', 'testnet')).toBe('neox-testnet');
    expect(resolveChainNetwork('n3', undefined)).toBe('mainnet');
    expect(resolveChainNetwork('neox', undefined)).toBe('neox-mainnet');
  });

  it('rejects an unknown chain before touching the network', () => {
    expect(() => resolveChainNetwork('eth' as ChainId, 'mainnet')).toThrow(ValidationError);
  });
});

describe('backend capability table', () => {
  it('reports node and explorer support per chain', () => {
    expect(supportsBackend('n3', 'node')).toBe(true);
    expect(supportsBackend('n3', 'explorer')).toBe(true);
    expect(supportsBackend('neox', 'node')).toBe(true);
    expect(supportsBackend('neox', 'explorer')).toBe(true);
  });

  it('names the chain and backend in the assertion failure', () => {
    expect(() => assertChainSupportsBackend('neox', 'wallet')).toThrow(ValidationError);
    expect(() => assertChainSupportsBackend('neox', 'wallet')).toThrow(/Neo X/);
    expect(() => assertChainSupportsBackend('neox', 'wallet')).toThrow(/wallet/);
    expect(() => assertChainSupportsBackend('n3', 'wallet')).not.toThrow();
  });
});

describe('Neo X node adapter read boundary', () => {
  it('only advertises methods that the EVM client allowlist permits', () => {
    for (const method of NEOX_NODE_READ_METHODS) {
      expect(EVM_READ_ONLY_METHODS.has(method)).toBe(true);
    }
  });

  it('advertises the reads the unified node tools need', () => {
    for (const method of [
      'eth_blockNumber',
      'eth_getBlockByNumber',
      'eth_getBlockByHash',
      'eth_getTransactionByHash',
      'eth_getTransactionReceipt',
      'eth_getBalance',
      'eth_getCode',
      'eth_call',
      'eth_chainId',
    ]) {
      expect(NEOX_NODE_READ_METHODS.has(method)).toBe(true);
    }
  });

  it('advertises no signing or broadcasting method', () => {
    for (const method of NEOX_NODE_READ_METHODS) {
      expect(EVM_FORBIDDEN_METHODS.has(method)).toBe(false);
    }
  });

  it('rejects a broadcast method before any network call is attempted', async () => {
    const fetchImpl = jest.fn();
    await expect(
      neoxNodeCall('mainnet', 'eth_sendRawTransaction', ['0xdeadbeef'], undefined, fetchImpl as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a read method that is not on the adapter allowlist', async () => {
    const fetchImpl = jest.fn();
    await expect(
      neoxNodeCall('mainnet', 'debug_traceTransaction', ['0x1'], undefined, fetchImpl as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('translates the orthogonal network axis before dispatching', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      expect(typeof url).toBe('string');
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x1b4' }),
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1b4' }),
      } as unknown as Response;
    });

    const result = await neoxNodeCall<string>(
      'mainnet',
      'eth_blockNumber',
      [],
      undefined,
      fetchImpl as never,
    );

    expect(result).toBe('0x1b4');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
