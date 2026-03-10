import { N3IndexClient } from '../src/contracts/n3index-client';
import { NeoNetwork } from '../src/services/neo-service';

describe('N3IndexClient', () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
