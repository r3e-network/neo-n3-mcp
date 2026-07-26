// config.neox.*RpcUrls has always been a list, but resolveRpcUrl only ever read
// candidates[0], so the configured backups were dead weight. These tests pin the
// failover so the list means what it says.

import { callEvmRpc } from '../src/contracts/evm-rpc-client';
import { config } from '../src/config';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => null },
    body: null,
    json: async () => body,
  } as any;
}

describe('callEvmRpc endpoint failover', () => {
  const originalMainnetUrls = config.neox.mainnetRpcUrls;

  afterEach(() => {
    config.neox.mainnetRpcUrls = originalMainnetUrls;
  });

  test('falls back to the second configured node on a 5xx', async () => {
    config.neox.mainnetRpcUrls = ['https://evm-a.example', 'https://evm-b.example'];
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse('error code: 520', { ok: false, status: 520 }))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: '0x5208' }));

    const result = await callEvmRpc('neox-mainnet', 'eth_gasPrice', [], undefined, fetchMock as any);

    expect(result).toBe('0x5208');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://evm-a.example');
    expect(fetchMock.mock.calls[1][0]).toBe('https://evm-b.example');
  });

  test('falls back on a thrown connection failure', async () => {
    config.neox.mainnetRpcUrls = ['https://evm-a.example', 'https://evm-b.example'];
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }));

    await expect(
      callEvmRpc('neox-mainnet', 'eth_chainId', [], undefined, fetchMock as any),
    ).resolves.toBe('0x1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('does not failover on a revert: the node answered', async () => {
    // A revert is a property of the contract call, not of the node. Asking a second
    // node produces the same revert and doubles the user's wait.
    config.neox.mainnetRpcUrls = ['https://evm-a.example', 'https://evm-b.example'];
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: 3, message: 'execution reverted' } }),
    );

    await expect(
      callEvmRpc('neox-mainnet', 'eth_call', [{ to: '0x' + '11'.repeat(20) }, 'latest'], undefined, fetchMock as any),
    ).rejects.toThrow(/execution reverted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('surfaces the last transport error once every node is exhausted', async () => {
    config.neox.mainnetRpcUrls = ['https://evm-a.example', 'https://evm-b.example'];
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 502 }));

    await expect(
      callEvmRpc('neox-mainnet', 'eth_gasPrice', [], undefined, fetchMock as any),
    ).rejects.toThrow(/502/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('an aborted caller signal stops failover instead of walking the list', async () => {
    // Caller-initiated cancellation is not a node fault. Continuing down the list
    // would keep issuing requests the caller has already abandoned.
    config.neox.mainnetRpcUrls = ['https://evm-a.example', 'https://evm-b.example'];
    const controller = new AbortController();
    const fetchMock = jest.fn().mockImplementation(() => {
      controller.abort();
      const error: any = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      callEvmRpc('neox-mainnet', 'eth_gasPrice', [], controller.signal, fetchMock as any),
    ).rejects.toThrow(/timed out|abort/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
