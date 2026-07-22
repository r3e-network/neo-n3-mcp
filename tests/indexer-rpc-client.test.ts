import { callIndexerRpc } from '../src/contracts/indexer-rpc-client';
import { NeoNetwork } from '../src/services/neo-service';
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

describe('callIndexerRpc', () => {
  test('POSTs a JSON-RPC 2.0 envelope to ${base}/${network} and returns result', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, result: { address: 'Nxyz', firstusetime: 123 } }),
    );

    const result = await callIndexerRpc(
      NeoNetwork.MAINNET,
      'GetAddressByAddress',
      { Address: 'NiRqSd5MHdFmLnHYqQrChgSjnzUD5hEurR' },
      undefined,
      fetchMock as any,
    );

    expect(result).toEqual({ address: 'Nxyz', firstusetime: 123 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.n3index.dev/mainnet');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.headers['Content-Type']).toBe('application/json');

    const sent = JSON.parse(init.body as string);
    expect(sent.jsonrpc).toBe('2.0');
    expect(sent.method).toBe('GetAddressByAddress');
    expect(sent.params).toEqual({ Address: 'NiRqSd5MHdFmLnHYqQrChgSjnzUD5hEurR' });
    expect(typeof sent.id).toBe('number');
  });

  test('targets the testnet endpoint when the testnet network is requested', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1, result: [] }));
    await callIndexerRpc(NeoNetwork.TESTNET, 'GetRawTransactionByAddress', { Address: 'N', Limit: 5, Skip: 0 }, undefined, fetchMock as any);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.n3index.dev/testnet');
  });

  test('throws NetworkError on a JSON-RPC error envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'bad args' } }),
    );

    await expect(
      callIndexerRpc(NeoNetwork.MAINNET, 'GetAddressByAddress', {}, undefined, fetchMock as any),
    ).rejects.toBeInstanceOf(NetworkError);
    await expect(
      callIndexerRpc(NeoNetwork.MAINNET, 'GetAddressByAddress', {}, undefined, fetchMock as any),
    ).rejects.toThrow(/bad args/);
  });

  test('throws NetworkError on a non-200 HTTP status', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }));
    await expect(
      callIndexerRpc(NeoNetwork.MAINNET, 'GetAddressByAddress', {}, undefined, fetchMock as any),
    ).rejects.toThrow(/503/);
  });

  test('rejects an unsupported network without calling fetch', async () => {
    const fetchMock = jest.fn();
    await expect(
      callIndexerRpc('bogus' as NeoNetwork, 'GetAddressByAddress', {}, undefined, fetchMock as any),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('surfaces an aborted request as a timeout NetworkError', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    });

    const promise = callIndexerRpc(NeoNetwork.MAINNET, 'GetAddressByAddress', {}, undefined, fetchMock as any)
      .then((value) => value, (error) => error);

    try {
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(8000);
      const outcome = await promise;
      expect(outcome).toBeInstanceOf(NetworkError);
      expect((outcome as Error).message).toMatch(/timed out/i);
    } finally {
      jest.useRealTimers();
    }
  });
});
