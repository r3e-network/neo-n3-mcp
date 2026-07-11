import { N3IndexClient } from '../src/contracts/n3index-client';
import { NeoNetwork } from '../src/services/neo-service';
import { ValidationError } from '../src/utils/errors';

describe('N3IndexClient', () => {
  test('keeps the request timeout active while consuming the response body', async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return {
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        }),
      } as any;
    });
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);
    const request = client
      .resolveByName(NeoNetwork.MAINNET, 'NeoXBridgeManagement')
      .then((value) => value, (error) => error);

    try {
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(3000);

      expect(requestSignal?.aborted).toBe(true);
      await expect(request).resolves.toEqual(expect.objectContaining({
        message: expect.stringMatching(/timed out/i),
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  test('resolves exact display names but rejects fuzzy substring matches', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
          display_name: 'NeoXBridgeManagement',
          symbol: '',
          logo_url: 'https://x.neo.org/favicon.ico',
          network: 'mainnet',
          source: 'manual',
        },
      ],
    } as any);

    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.resolveByName(NeoNetwork.MAINNET, 'NeoXBridgeManagement')).resolves.toMatchObject({
      contractHash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
      displayName: 'NeoXBridgeManagement',
    });
    await expect(client.resolveByName(NeoNetwork.MAINNET, 'bridge')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('matches exact names from the compatibility endpoint metadata catalog', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          contract_hash: '0x00fb9575f220727f71a1537f75e83af9387628ff',
          display_name: 'fBNBv2',
          symbol: '',
          network: 'mainnet',
        },
        {
          contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
          display_name: 'NeoXBridgeManagement',
          symbol: '',
          network: 'mainnet',
        },
      ],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await client.resolveByName(NeoNetwork.MAINNET, 'NeoXBridgeManagement');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe('error');
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.has('or')).toBe(false);
    expect(requestUrl.searchParams.has('display_name')).toBe(false);
    expect(requestUrl.searchParams.has('symbol')).toBe(false);
    expect(requestUrl.searchParams.get('limit')).toBe('10000');
    expect(requestUrl.searchParams.has('offset')).toBe(false);
  });

  test('rejects ambiguous exact metadata names instead of selecting by row order', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
          display_name: 'SharedName',
          symbol: '',
          network: 'mainnet',
        },
        {
          contract_hash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
          display_name: 'SharedName',
          symbol: '',
          network: 'mainnet',
        },
      ],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.resolveByName(NeoNetwork.MAINNET, 'SharedName'))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('ignores name matches from a different network', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
          display_name: 'CrossNetworkContract',
          symbol: 'CROSS',
          network: 'testnet',
        },
      ],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.resolveByName(NeoNetwork.MAINNET, 'CrossNetworkContract'))
      .resolves.toBeNull();
  });

  test('negative-caches unresolved names', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.resolveByName(NeoNetwork.TESTNET, 'missing')).resolves.toBeNull();
    await expect(client.resolveByName(NeoNetwork.TESTNET, 'missing')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('bounds negative-cache growth and retries entries evicted by capacity', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any, {
      negativeCacheMaxEntries: 2,
    } as any);

    await client.resolveByName(NeoNetwork.MAINNET, 'missing-one');
    await client.resolveByName(NeoNetwork.MAINNET, 'missing-two');
    await client.resolveByName(NeoNetwork.MAINNET, 'missing-three');

    expect((client as any).negativeNameCache.size).toBe(2);
    await client.resolveByName(NeoNetwork.MAINNET, 'missing-one');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('retries metadata cache fetch after an earlier failure', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
            display_name: 'NeoXBridgeManagement',
            symbol: '',
            logo_url: 'https://x.neo.org/favicon.ico',
            network: 'mainnet',
            source: 'manual',
          },
        ],
      } as any);

    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.resolveByName(NeoNetwork.MAINNET, 'NeoXBridgeManagement')).rejects.toThrow('503');
    await expect(client.resolveByName(NeoNetwork.MAINNET, 'NeoXBridgeManagement')).resolves.toMatchObject({
      contractHash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('resolves hash metadata without using the unsupported contracts hash filter', async () => {
    const contractHash = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
    const fetchMock = jest.fn().mockImplementation(async (url: string) => {
      if (!url.includes('/contract_metadata_cache?') || !url.includes('contract_hash=eq.')) {
        throw new Error(`Unexpected N3Index request: ${url}`);
      }
      return {
        ok: true,
        json: async () => [{
          contract_hash: contractHash,
          display_name: 'NeoToken',
          symbol: 'NEO',
          logo_url: '',
          network: 'mainnet',
          source: 'manifest',
        }],
      } as any;
    });
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.getContractByHash(NeoNetwork.MAINNET, contractHash)).resolves.toMatchObject({
      contractHash,
      displayName: 'NeoToken',
      symbol: 'NEO',
      source: 'contract_metadata_cache',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('ignores hash metadata rows that do not match the requested hash and network', async () => {
    const requestedHash = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        contract_hash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
        display_name: 'PoisonedName',
        symbol: 'BAD',
        network: 'testnet',
      }],
    } as any);
    const client = new N3IndexClient('https://api.n3index.dev', fetchMock as any);

    await expect(client.getContractByHash(NeoNetwork.MAINNET, requestedHash)).resolves.toBeNull();
  });

});
