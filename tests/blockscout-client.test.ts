import { fetchBlockscout, resolveNeoxNetwork } from '../src/contracts/blockscout-client';
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

describe('resolveNeoxNetwork', () => {
  test('normalizes accepted aliases', () => {
    expect(resolveNeoxNetwork('neox-mainnet')).toBe('neox-mainnet');
    expect(resolveNeoxNetwork('mainnet')).toBe('neox-mainnet');
    expect(resolveNeoxNetwork('neox-testnet')).toBe('neox-testnet');
    expect(resolveNeoxNetwork('testnet')).toBe('neox-testnet');
  });

  test('rejects unknown networks', () => {
    expect(() => resolveNeoxNetwork('ethereum')).toThrow(ValidationError);
  });
});

describe('fetchBlockscout', () => {
  test('builds the /api/v2 URL against the mainnet host and returns the body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ hash: '0xabc' }));

    const result = await fetchBlockscout(
      'neox-mainnet',
      'addresses/0x1111111111111111111111111111111111111111',
      {},
      undefined,
      fetchMock as any,
    );

    expect(result).toEqual({ hash: '0xabc' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://xexplorer.neo.org/api/v2/addresses/0x1111111111111111111111111111111111111111');
    expect(init.method).toBe('GET');
    expect(init.redirect).toBe('error');
  });

  test('appends query params and strips leading slashes from the path', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [] }));
    await fetchBlockscout('neox-mainnet', '/search', { q: 'usdt' }, undefined, fetchMock as any);
    expect(fetchMock.mock.calls[0][0]).toBe('https://xexplorer.neo.org/api/v2/search?q=usdt');
  });

  test('targets the testnet host for the testnet network', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [] }));
    await fetchBlockscout('neox-testnet', 'blocks/1', {}, undefined, fetchMock as any);
    expect(fetchMock.mock.calls[0][0]).toBe('https://xt4scan.ngd.network/api/v2/blocks/1');
  });

  test('resolves null on a 404', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));
    await expect(
      fetchBlockscout('neox-mainnet', 'transactions/0xdead', {}, undefined, fetchMock as any),
    ).resolves.toBeNull();
  });

  test('throws NetworkError on a 5xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 502 }));
    await expect(
      fetchBlockscout('neox-mainnet', 'transactions/0xdead', {}, undefined, fetchMock as any),
    ).rejects.toThrow(/502/);
  });

  test('wraps a network throw in NetworkError', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      fetchBlockscout('neox-mainnet', 'blocks/1', {}, undefined, fetchMock as any),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
