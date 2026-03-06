import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NetworkMode } from '../src/config';
import { setupResourceHandlers } from '../src/handlers/resource-handler';

describe('setupResourceHandlers', () => {
  test('registers fixed status resources and the block template in both mode', async () => {
    const registrations: any[][] = [];
    const server = {
      resource: jest.fn((...args: any[]) => {
        registrations.push(args);
      })
    } as any;

    const getNeoService = jest.fn(async (network?: string) => ({
      getBlockchainInfo: jest.fn(async () => ({ height: 123, network: network ?? 'mainnet' })),
      getBlock: jest.fn(async (height: number) => ({ index: height, hash: '0xabc' }))
    }));

    setupResourceHandlers(server, {
      networkMode: NetworkMode.BOTH,
      getNeoService
    });

    expect(server.resource).toHaveBeenCalledTimes(4);
    expect(registrations[0][0]).toBe('neo-network-status');
    expect(registrations[0][1]).toBe('neo://network/status');
    expect(registrations[1][0]).toBe('neo-mainnet-status');
    expect(registrations[1][1]).toBe('neo://mainnet/status');
    expect(registrations[2][0]).toBe('neo-testnet-status');
    expect(registrations[2][1]).toBe('neo://testnet/status');
    expect(registrations[3][0]).toBe('neo-block');
    expect(registrations[3][1]).toBeInstanceOf(ResourceTemplate);

    const networkStatusHandler = registrations[0][3];
    const statusResponse = await networkStatusHandler(new URL('neo://network/status'));
    expect(statusResponse).toEqual({
      contents: [
        {
          uri: 'neo://network/status',
          mimeType: 'application/json',
          text: JSON.stringify({ height: 123, network: 'mainnet' }, null, 2)
        }
      ]
    });

    const blockHandler = registrations[3][3];
    const blockResponse = await blockHandler(new URL('neo://block/42'), { height: '42' });
    expect(blockResponse).toEqual({
      contents: [
        {
          uri: 'neo://block/42',
          mimeType: 'application/json',
          text: JSON.stringify({ index: 42, hash: '0xabc' }, null, 2)
        }
      ]
    });
    expect(getNeoService.mock.calls).toEqual([[], []]);
  });

  test('omits mainnet status when running in testnet-only mode', () => {
    const registrations: any[][] = [];
    const server = {
      resource: jest.fn((...args: any[]) => {
        registrations.push(args);
      })
    } as any;

    setupResourceHandlers(server, {
      networkMode: NetworkMode.TESTNET_ONLY,
      getNeoService: jest.fn(async () => ({
        getBlockchainInfo: jest.fn(),
        getBlock: jest.fn()
      }))
    });

    const names = registrations.map((registration) => registration[0]);
    expect(names).toEqual(['neo-network-status', 'neo-testnet-status', 'neo-block']);
  });
});
