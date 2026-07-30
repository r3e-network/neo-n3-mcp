import { jest } from '@jest/globals';
import { ContractService } from '../src/contracts/contract-service';
import { FAMOUS_CONTRACTS } from '../src/contracts/contracts';
import { callTool } from '../src/handlers/tool-handler';
import {
  resolveKnownAccount,
  tryGetAddressFromScriptHash,
} from '../src/metadata/known-accounts';
import { NeoNetwork, NeoService } from '../src/services/neo-service';
import { ProtocolErrorCode } from '@modelcontextprotocol/server';

const STALE_CONTRACTS = [
  {
    key: 'neofs',
    name: 'NeoFS',
    network: NeoNetwork.MAINNET,
    scriptHash: '0x50ac1c37690cc2cfc594472833cf57505d5f46de',
  },
  {
    key: 'neofs',
    name: 'NeoFS',
    network: NeoNetwork.TESTNET,
    scriptHash: '0xccca29443855a1c455d72a3318cf605debb9e384',
  },
  {
    key: 'neoburger',
    name: 'NeoBurger',
    network: NeoNetwork.MAINNET,
    scriptHash: '0x48c40d4666f93408be1bef038b6722404d9a4c2a',
  },
  {
    key: 'flamingo',
    name: 'Flamingo',
    network: NeoNetwork.MAINNET,
    scriptHash: '0xf970f4ccecd765b63732b821775dc38c25d74b39',
  },
  {
    key: 'neocompound',
    name: 'NeoCompound',
    network: NeoNetwork.MAINNET,
    scriptHash: '0xd6c41383808d22d7d1e40f8a741e20dc24b858e7',
  },
  {
    key: 'grandshare',
    name: 'GrandShare',
    network: NeoNetwork.MAINNET,
    scriptHash: '0xbbcb7a1e3defbeeafc18b3358a27ccb93d0b2b13',
  },
  {
    key: 'ghostmarket',
    name: 'GhostMarket',
    network: NeoNetwork.MAINNET,
    scriptHash: '0x7a8d62e32f1f4ed880f05e93d9b03d48e3b6add7',
  },
] as const;

const REMOVED_SPECIALIZED_METHODS = [
  'createNeoFSContainer',
  'getNeoFSContainers',
  'depositNeoToNeoBurger',
  'withdrawNeoFromNeoBurger',
  'getNeoBurgerBalance',
  'claimNeoBurgerGas',
  'stakeFlamingo',
  'unstakeFlamingo',
  'getFlamingoBalance',
  'depositToNeoCompound',
  'withdrawFromNeoCompound',
  'getNeoCompoundBalance',
  'depositToGrandShare',
  'withdrawFromGrandShare',
  'getGrandSharePoolDetails',
  'createGhostMarketNFT',
  'listGhostMarketNFT',
  'buyGhostMarketNFT',
  'getGhostMarketTokenInfo',
] as const;

describe('curated contract surface', () => {
  test('does not publish contracts whose hashes or advertised operations are stale', () => {
    const publishedKeys = Object.keys(FAMOUS_CONTRACTS);
    const publishedNames = Object.values(FAMOUS_CONTRACTS).map(contract => contract.name);

    for (const { key, name } of STALE_CONTRACTS) {
      expect(publishedKeys).not.toContain(key);
      expect(publishedNames).not.toContain(name);
    }
  });

  test.each(STALE_CONTRACTS)(
    'does not label $name at $scriptHash as a known account',
    ({ network, scriptHash }) => {
      expect(resolveKnownAccount(scriptHash, network)).toBeNull();

      const address = tryGetAddressFromScriptHash(scriptHash);
      expect(address).not.toBeNull();
      expect(resolveKnownAccount(address, network)).toBeNull();
    },
  );

  test('does not expose specialized methods backed by removed contract definitions', () => {
    for (const method of REMOVED_SPECIALIZED_METHODS) {
      expect(method in ContractService.prototype).toBe(false);
    }
  });

  test.each(['neofs_create_container', 'neofs_get_containers'])(
    'does not dispatch removed MCP tool %s',
    async (toolName) => {
      const getNeoFSContainers = jest.fn().mockResolvedValue([]);
      const createNeoFSContainer = jest.fn().mockResolvedValue('0xdeadbeef');
      const neoServices = new Map<NeoNetwork, NeoService>([
        [NeoNetwork.MAINNET, {} as NeoService],
      ]);
      const contractServices = new Map<NeoNetwork, ContractService>([
        [NeoNetwork.MAINNET, {
          getNeoFSContainers,
          createNeoFSContainer,
        } as unknown as ContractService],
      ]);

      const result = await callTool(
        toolName,
        {
          network: NeoNetwork.MAINNET,
          ownerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        },
        neoServices,
        contractServices,
      );

      expect(result).toEqual({
        error: {
          code: ProtocolErrorCode.InvalidParams,
          message: expect.stringContaining(`Tool ${toolName} not found or requires network parameter.`),
        },
      });
      expect(getNeoFSContainers).not.toHaveBeenCalled();
      expect(createNeoFSContainer).not.toHaveBeenCalled();
    },
  );

  test('keeps generic hash, address, and live manifest discovery available', async () => {
    const scriptHash = '0xabcdef1234567890abcdef1234567890abcdef12';
    const service = new ContractService('http://localhost:10332', NeoNetwork.MAINNET);
    (service as unknown as { n3indexClient: null }).n3indexClient = null;
    (service as unknown as { networkMagic: number }).networkMagic = 860833102;
    const address = tryGetAddressFromScriptHash(scriptHash);
    expect(address).not.toBeNull();

    const getContractState = jest.fn().mockResolvedValue({
      id: 7,
      hash: scriptHash,
      updatecounter: 0,
      manifest: {
        name: 'LiveManifestContract',
        abi: {
          methods: [{ name: 'owner', parameters: [] }],
          events: [],
        },
      },
    });
    (service as unknown as { rpcClient: { getContractState: typeof getContractState } }).rpcClient.getContractState = getContractState;

    expect(service.getContractScriptHash(scriptHash)).toBe(scriptHash);
    expect(service.getContractScriptHash(address as string)).toBe(scriptHash);

    const status = await service.getContractStatus(scriptHash);
    expect(status).toMatchObject({
      deployed: true,
      manifestName: 'LiveManifestContract',
      operationCount: 1,
    });
    await expect(service.resolveContractScriptHash('LiveManifestContract')).resolves.toBe(scriptHash);
  });
});
