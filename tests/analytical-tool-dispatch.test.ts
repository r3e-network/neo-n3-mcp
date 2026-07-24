import { callTool } from '../src/handlers/tool-handler';
import { NeoService, NeoNetwork } from '../src/services/neo-service';
import { ContractService } from '../src/contracts/contract-service';

// The analytical indexer + Neo X tools route straight to their HTTP clients and
// never touch NeoService/ContractService, so empty service maps are sufficient.
const emptyNeoServices = new Map<NeoNetwork, NeoService>();
const emptyContractServices = new Map<NeoNetwork, ContractService>();

const VALID_N3_ADDRESS = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';
const VALID_EVM_ADDRESS = '0x1111111111111111111111111111111111111111';

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => null },
    body: null,
    json: async () => body,
  } as any;
}

describe('callTool analytical dispatch', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('routes n3_get_address to the indexer JSON-RPC client with a validated address', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, result: { address: VALID_N3_ADDRESS } }),
    );
    global.fetch = fetchMock as any;

    const response = await callTool(
      'n3_get_address',
      { address: VALID_N3_ADDRESS, network: 'mainnet' },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.n3index.dev/mainnet');
    const sent = JSON.parse(init.body as string);
    expect(sent.method).toBe('GetAddressByAddress');
    expect(sent.params).toEqual({ Address: VALID_N3_ADDRESS });
    expect(response.result).toEqual({ address: VALID_N3_ADDRESS });
  });

  test('query_indexer routes a vetted method to mainnet with mapped PascalCase params', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', id: 1, result: { address: VALID_N3_ADDRESS } }),
    );
    global.fetch = fetchMock as any;

    const response = await callTool(
      'query_indexer',
      { method: 'get_address_summary', params: { address: VALID_N3_ADDRESS } },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    // Mainnet only: no network param on the tool, resolveIndexerNetwork -> mainnet.
    expect(url).toBe('https://api.n3index.dev/mainnet');
    const sent = JSON.parse(init.body as string);
    expect(sent.method).toBe('GetAddressByAddress');
    expect(sent.params).toEqual({ Address: VALID_N3_ADDRESS });
    expect(response.result).toEqual({ address: VALID_N3_ADDRESS });
  });

  test('query_indexer rejects a non-allowlisted method with NO network call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const response = await callTool(
      'query_indexer',
      { method: 'DropDatabase', params: {} },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toBeDefined();
  });

  test('query_indexer rejects an unknown param (injection-proof) with NO network call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const response = await callTool(
      'query_indexer',
      { method: 'get_address_summary', params: { address: VALID_N3_ADDRESS, evil: { $where: '1' } } },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toBeDefined();
  });

  test('query_indexer clamps pagination on a curated wrapper method', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1, result: [] }));
    global.fetch = fetchMock as any;

    await callTool(
      'query_indexer',
      {
        method: 'list_asset_holders',
        params: { contractHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', limit: 5000 },
      },
      emptyNeoServices,
      emptyContractServices,
    );

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.method).toBe('GetAssetHoldersListByContractHash');
    expect(sent.params.Limit).toBe(100);
    expect(sent.params.ContractHash).toBe('0xd2a4cff31913016155e38e474a2c06d08be276cf');
  });

  test('clamps n3 pagination Limit to 100', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 1, result: [] }));
    global.fetch = fetchMock as any;

    await callTool(
      'n3_list_transactions_by_address',
      { address: VALID_N3_ADDRESS, limit: 5000, skip: 10 },
      emptyNeoServices,
      emptyContractServices,
    );

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.method).toBe('GetRawTransactionByAddress');
    expect(sent.params).toEqual({ Address: VALID_N3_ADDRESS, Limit: 100, Skip: 10 });
  });

  test('routes x_get_address to Blockscout with a normalized 0x address', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ hash: VALID_EVM_ADDRESS }));
    global.fetch = fetchMock as any;

    const response = await callTool(
      'x_get_address',
      { address: VALID_EVM_ADDRESS.toUpperCase().replace('0X', '0x'), network: 'neox-mainnet' },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://xexplorer.neo.org/api/v2/addresses/${VALID_EVM_ADDRESS}`,
    );
    expect(response.result).toEqual({ hash: VALID_EVM_ADDRESS });
  });

  test('returns a validation error (no fetch) for an invalid EVM address', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const response = await callTool(
      'x_get_address',
      { address: 'not-an-evm-address' },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toBeDefined();
  });

  test('x_query routes a vetted endpoint to Blockscout with a substituted typed path segment', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ hash: VALID_EVM_ADDRESS }));
    global.fetch = fetchMock as any;

    const response = await callTool(
      'x_query',
      { endpoint: 'get_address', params: { address: VALID_EVM_ADDRESS } },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Mainnet only: x_query exposes no network field, resolveNeoxNetworkParam -> neox-mainnet.
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://xexplorer.neo.org/api/v2/addresses/${VALID_EVM_ADDRESS}`,
    );
    expect(response.result).toEqual({ hash: VALID_EVM_ADDRESS });
  });

  test('x_query rejects a non-allowlisted endpoint with NO network call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const response = await callTool(
      'x_query',
      { endpoint: 'bogus', params: {} },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toBeDefined();
  });

  test('x_query rejects a path-traversal path param (SSRF-proof) with NO network call', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const response = await callTool(
      'x_query',
      { endpoint: 'get_address', params: { address: '../../../../etc/passwd' } },
      emptyNeoServices,
      emptyContractServices,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toBeDefined();
  });
});
