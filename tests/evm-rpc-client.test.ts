import {
  callEvmRpc,
  assertReadOnlyEvmMethod,
  resolveNeoxEvmNetwork,
  neoxChainId,
  EVM_READ_ONLY_METHODS,
  EVM_FORBIDDEN_METHODS,
} from '../src/contracts/evm-rpc-client';
import { NetworkError, ValidationError } from '../src/utils/errors';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => null },
    body: null,
    json: async () => body,
  } as any;
}

describe('callEvmRpc read-only allowlist', () => {
  test('rejects eth_sendRawTransaction without touching the network', async () => {
    const fetchMock = jest.fn();
    await expect(
      callEvmRpc('neox-mainnet', 'eth_sendRawTransaction', ['0xdeadbeef'], undefined, fetchMock as any),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      callEvmRpc('neox-mainnet', 'eth_sendRawTransaction', ['0xdeadbeef'], undefined, fetchMock as any),
    ).rejects.toThrow(/forbidden/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects eth_sendTransaction and eth_signTransaction without touching the network', async () => {
    const fetchMock = jest.fn();
    for (const method of ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign']) {
      await expect(
        callEvmRpc('neox-mainnet', method, [], undefined, fetchMock as any),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects a non-allowlisted method (eth_getStorageAt)', async () => {
    const fetchMock = jest.fn();
    await expect(
      callEvmRpc('neox-mainnet', 'eth_getStorageAt', [], undefined, fetchMock as any),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('the forbidden set is disjoint from the allowlist and contains the broadcast methods', () => {
    for (const method of EVM_FORBIDDEN_METHODS) {
      expect(EVM_READ_ONLY_METHODS.has(method)).toBe(false);
    }
    expect(EVM_FORBIDDEN_METHODS.has('eth_sendRawTransaction')).toBe(true);
    expect(EVM_FORBIDDEN_METHODS.has('eth_sendTransaction')).toBe(true);
    expect(EVM_FORBIDDEN_METHODS.has('eth_signTransaction')).toBe(true);
  });

  test('assertReadOnlyEvmMethod passes allowlisted methods', () => {
    for (const method of EVM_READ_ONLY_METHODS) {
      expect(assertReadOnlyEvmMethod(method)).toBe(method);
    }
  });
});

describe('callEvmRpc transport', () => {
  test('POSTs a JSON-RPC 2.0 envelope to the configured mainnet RPC and returns result', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, result: '0x5208' }),
    );
    const result = await callEvmRpc('neox-mainnet', 'eth_estimateGas', [{ to: '0x' + '11'.repeat(20) }], undefined, fetchMock as any);
    expect(result).toBe('0x5208');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mainnet-1.rpc.banelabs.org');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');

    const sent = JSON.parse(init.body as string);
    expect(sent.jsonrpc).toBe('2.0');
    expect(sent.method).toBe('eth_estimateGas');
    expect(sent.params).toEqual([{ to: '0x' + '11'.repeat(20) }]);
  });

  test('targets the configured testnet RPC when the testnet network is requested', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }));
    await callEvmRpc('neox-testnet', 'eth_chainId', [], undefined, fetchMock as any);
    expect(fetchMock.mock.calls[0][0]).toBe('https://testnet-1.rpc.banelabs.org');
  });

  test('throws NetworkError on a JSON-RPC error envelope (e.g. a revert)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: 3, message: 'execution reverted' } }),
    );
    await expect(
      callEvmRpc('neox-mainnet', 'eth_call', [{ to: '0x' + '11'.repeat(20) }, 'latest'], undefined, fetchMock as any),
    ).rejects.toThrow(/execution reverted/);
  });

  test('throws NetworkError on a non-200 HTTP status', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 502 }));
    await expect(
      callEvmRpc('neox-mainnet', 'eth_gasPrice', [], undefined, fetchMock as any),
    ).rejects.toThrow(/502/);
  });
});

describe('neox network helpers', () => {
  test('resolves network aliases', () => {
    expect(resolveNeoxEvmNetwork('mainnet')).toBe('neox-mainnet');
    expect(resolveNeoxEvmNetwork('neox-testnet')).toBe('neox-testnet');
    expect(() => resolveNeoxEvmNetwork('ethereum')).toThrow(ValidationError);
  });

  test('exposes the configured chain ids', () => {
    expect(neoxChainId('neox-mainnet')).toBe(47763);
    expect(neoxChainId('neox-testnet')).toBe(12227332);
  });
});
