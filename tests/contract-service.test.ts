/**
 * Comprehensive Unit Tests for ContractService
 * Testing all contract operations with various scenarios
 */

import { jest } from '@jest/globals';
import { ContractService } from '../src/contracts/contract-service';
import { NeoNetwork } from '../src/services/neo-service';
import { FAMOUS_CONTRACTS } from '../src/contracts/contracts';
import { ContractError, NetworkError, ValidationError } from '../src/utils/errors';

const mockContractResult = {
  script: 'mock-script',
  state: 'HALT',
  gasconsumed: '1000000',
  stack: [{ value: '100' }]
};

const mockTransactionId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const mockNetworkMagic = 894710606;
const mockContractHash = '1234567890abcdef1234567890abcdef12345678';

jest.mock('@cityofzion/neon-js', () => {
  const contractResult = {
    script: 'mock-script',
    state: 'HALT',
    gasconsumed: '1000000',
    stack: [{ value: '100' }]
  };
  const transactionId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const networkMagic = 894710606;
  const contractHash = '1234567890abcdef1234567890abcdef12345678';

  const mockRpcExecute = jest.fn().mockImplementation((queryOrMethod: any) => {
    let method = queryOrMethod;
    if (typeof queryOrMethod === 'object' && queryOrMethod !== null) {
      method = queryOrMethod.req ? queryOrMethod.req.method : queryOrMethod.method;
    }

    if (method === 'getversion') {
      return Promise.resolve({ protocol: { network: networkMagic } });
    }

    return Promise.resolve(contractResult);
  });

  const mockExperimentalDeployContract = jest.fn().mockResolvedValue(transactionId);
  const mockExperimentalGetContractHash = jest.fn().mockReturnValue(contractHash);

  return {
    __esModule: true,
    __mocked: {
      mockRpcExecute,
      mockExperimentalDeployContract,
      mockExperimentalGetContractHash
    },
    rpc: {
      Query: jest.fn().mockImplementation((q) => q),
      RPCClient: jest.fn().mockImplementation(() => ({
        execute: mockRpcExecute,
        invokeScript: jest.fn().mockResolvedValue(contractResult),
        sendRawTransaction: jest.fn().mockResolvedValue(transactionId)
      }))
    },
    sc: {
      createScript: jest.fn().mockReturnValue('mock-script'),
      NEF: jest.fn().mockImplementation(({ script }) => ({
        script,
        checksum: 123456,
        serialize: jest.fn().mockReturnValue(script)
      })),
      ContractManifest: {
        fromJson: jest.fn().mockImplementation((manifest) => ({
          ...manifest,
          name: manifest.name ?? 'TestContract',
          toJson: jest.fn().mockReturnValue(manifest)
        }))
      },
      ContractParam: {
        string: jest.fn().mockReturnValue({ type: 'String', value: 'mock' }),
        integer: jest.fn().mockReturnValue({ type: 'Integer', value: 123 }),
        array: jest.fn().mockReturnValue({ type: 'Array', value: [] }),
        hash160: jest.fn().mockReturnValue({ type: 'Hash160', value: 'mock-hash' })
      }
    },
    experimental: {
      deployContract: mockExperimentalDeployContract,
      getContractHash: mockExperimentalGetContractHash
    },
    wallet: {
      getScriptHashFromAddress: jest.fn().mockReturnValue('f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e'),
      Account: jest.fn().mockImplementation(() => ({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        WIF: 'mock-wif'
      }))
    },
    u: {
      HexString: { fromHex: jest.fn().mockReturnValue('hex') }
    },
    tx: {
      Transaction: jest.fn().mockImplementation(() => ({
        sign: jest.fn(),
        serialize: jest.fn().mockReturnValue('serialized')
      }))
    }
  };
});

const neonJsMock = jest.requireMock('@cityofzion/neon-js') as {
  __mocked: {
    mockRpcExecute: jest.Mock;
    mockExperimentalDeployContract: jest.Mock;
    mockExperimentalGetContractHash: jest.Mock;
  };
};

const mockRpcExecute = neonJsMock.__mocked.mockRpcExecute;
const mockExperimentalDeployContract = neonJsMock.__mocked.mockExperimentalDeployContract;
const mockExperimentalGetContractHash = neonJsMock.__mocked.mockExperimentalGetContractHash;
const mockFetch = jest.fn();

describe('ContractService', () => {
  let contractService: ContractService;
  const genericContractHash = '0xabcdef1234567890abcdef1234567890abcdef12';
  const genericContractAddress = 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRpcExecute.mockImplementation((queryOrMethod: any) => {
      let method = queryOrMethod;
      if (typeof queryOrMethod === 'object' && queryOrMethod !== null) {
        method = queryOrMethod.req ? queryOrMethod.req.method : queryOrMethod.method;
      }

      if (method === 'getversion') {
        return Promise.resolve({ protocol: { network: mockNetworkMagic } });
      }

      return Promise.resolve(mockContractResult);
    });
    mockExperimentalDeployContract.mockResolvedValue(mockTransactionId);
    mockExperimentalGetContractHash.mockReturnValue(mockContractHash);
    (globalThis as any).fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
    contractService = new ContractService('http://localhost:10332', NeoNetwork.MAINNET);
  });

  describe('constructor', () => {
    test('should create ContractService successfully', () => {
      expect(contractService).toBeDefined();
      expect(contractService.getNetwork()).toBe(NeoNetwork.MAINNET);
    });

    test('should throw NetworkError for empty RPC URL', () => {
      expect(() => new ContractService('', NeoNetwork.MAINNET)).toThrow(NetworkError);
    });
  });

  describe('getContract', () => {
    test('should get contract by name', () => {
      const firstContract = Object.values(FAMOUS_CONTRACTS)[0];
      const contract = contractService.getContract(firstContract.name);
      expect(contract).toBeDefined();
      expect(contract.name).toBe(firstContract.name);
    });

    test('should resolve contract by current network script hash', () => {
      const scriptHash = contractService.getContractScriptHash('NeoFS');
      const contract = contractService.getContract(scriptHash);
      expect(contract.name).toBe('NeoFS');
      expect(contractService.getContractOperations(scriptHash)).toEqual(expect.objectContaining({ contractName: 'NeoFS' }));
    });

    test('should throw ContractError for non-existent contract', () => {
      expect(() => contractService.getContract('NonExistent')).toThrow(ValidationError);
    });
  });

  describe('generic contract references', () => {
    test('should resolve script hash from a Neo address', () => {
      const resolved = contractService.getContractScriptHash(genericContractAddress);

      expect(resolved).toBe('0xf81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e');
    });

    test('should return contract status for an arbitrary script hash', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({
        id: 7,
        hash: genericContractHash,
        updatecounter: 3,
        manifest: {
          name: 'GenericContract',
          abi: {
            methods: [{ name: 'balanceOf', parameters: [] }],
            events: []
          }
        }
      });

      const status = await (contractService as any).getContractStatus(genericContractHash);

      expect(status).toMatchObject({
        deployed: true,
        scriptHash: genericContractHash,
        manifestName: 'GenericContract',
        operationCount: 1,
        status: 'deployed'
      });
    });

    test('should surface network errors instead of marking the contract as not deployed', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockRejectedValue(new Error('ECONNREFUSED api node unavailable'));

      await expect((contractService as any).getContractStatus(genericContractHash))
        .rejects.toThrow('ECONNREFUSED');
    });

    test('should resolve an unknown contract name through api.n3index.dev metadata', async () => {
      const remoteHash = '0x148b3e0ca4f77476252862645e58f06b2562c414';
      mockFetch.mockImplementation(async (input: any) => {
        const url = String(input);
        if (url.includes('/contract_metadata_cache')) {
          return {
            ok: true,
            json: async () => [
              {
                contract_hash: remoteHash,
                display_name: 'NeoXBridgeManagement',
                symbol: '',
                logo_url: 'https://x.neo.org/favicon.ico',
                network: 'mainnet',
                source: 'manual'
              }
            ]
          } as any;
        }

        if (url.includes('/contracts')) {
          return {
            ok: true,
            json: async () => [
              {
                network: 'mainnet',
                contract_hash: remoteHash,
                update_counter: 0,
                first_seen_block: 100,
                last_seen_block: 200,
                manifest: {
                  name: 'NeoXBridgeManagement',
                  abi: {
                    methods: [{ name: 'owner', parameters: [] }],
                    events: []
                  }
                }
              }
            ]
          } as any;
        }

        return {
          ok: true,
          json: async () => [],
        } as any;
      });

      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({
        id: 9,
        hash: remoteHash,
        updatecounter: 0,
        manifest: {
          name: 'NeoXBridgeManagement',
          abi: {
            methods: [{ name: 'owner', parameters: [] }],
            events: []
          }
        }
      });

      const scriptHash = await contractService.resolveContractScriptHash('NeoXBridgeManagement');
      const info = await contractService.getContractInfo('NeoXBridgeManagement');

      expect(scriptHash).toBe(remoteHash);
      expect(info).toMatchObject({
        name: 'NeoXBridgeManagement',
        scriptHash: remoteHash,
        available: true,
      });
      expect(info.status).toMatchObject({
        deployed: true,
        logoUrl: 'https://x.neo.org/favicon.ico',
      });
    });

    test('should reject fuzzy remote contract names that only match a substring', async () => {
      mockFetch.mockImplementation(async (input: any) => {
        const url = String(input);
        if (url.includes('/contract_metadata_cache')) {
          return {
            ok: true,
            json: async () => [
              {
                contract_hash: '0x148b3e0ca4f77476252862645e58f06b2562c414',
                display_name: 'NeoXBridgeManagement',
                symbol: '',
                logo_url: 'https://x.neo.org/favicon.ico',
                network: 'mainnet',
                source: 'manual'
              }
            ]
          } as any;
        }

        return {
          ok: true,
          json: async () => [],
        } as any;
      });

      await expect(contractService.resolveContractScriptHash('bridge'))
        .rejects.toThrow('Unable to resolve contract reference');
    });
  });

  describe('queryContract', () => {
    test('should query contract successfully', async () => {
      const contract = Object.values(FAMOUS_CONTRACTS)[0];
      const operation = Object.values(contract.operations)[0];

      const result = await contractService.queryContract(contract.name, operation.name, []);
      expect(result).toBeDefined();
      expect(result.state).toBe('HALT');
    });

    test('should handle FAULT state', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockResolvedValue({
        state: 'FAULT',
        exception: 'Test error'
      });

      const contract = Object.values(FAMOUS_CONTRACTS)[0];
      const operation = Object.values(contract.operations)[0];

      await expect(contractService.queryContract(contract.name, operation.name, []))
        .rejects.toThrow(ContractError);
    });

    test('should query an arbitrary contract by script hash', async () => {
      const result = await contractService.invokeReadContract(genericContractHash, 'balanceOf', []);

      expect(result).toBeDefined();
      expect(result.state).toBe('HALT');
    });
  });

  describe('invokeContract', () => {
    const mockAccount = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', WIF: 'mock-wif' };

    test('should invoke contract successfully', async () => {
      const contract = Object.values(FAMOUS_CONTRACTS)[0];
      const operation = Object.values(contract.operations)[0];

      const result = await contractService.invokeContract(
        mockAccount, contract.name, operation.name, []
      );
      expect(result).toBe(mockTransactionId);
    });

    test('should throw ContractError for invalid account', async () => {
      const contract = Object.values(FAMOUS_CONTRACTS)[0];
      const operation = Object.values(contract.operations)[0];

      await expect(contractService.invokeContract(
        null, contract.name, operation.name, []
      )).rejects.toThrow(ContractError);
    });
  });

  describe('deployContract', () => {
    test('should fetch network magic and pass complete deploy config', async () => {
      const manifest = {
        name: 'TestContract',
        groups: [],
        supportedstandards: [],
        abi: { methods: [], events: [] },
        permissions: [],
        trusts: [],
        extra: null
      };

      const result = await contractService.deployContract('mock-wif', Buffer.from('aa55', 'hex').toString('base64'), manifest);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({ method: 'getversion', params: [] }));
      expect(mockExperimentalDeployContract).toHaveBeenCalledWith(
        expect.objectContaining({ checksum: 123456 }),
        expect.objectContaining({ name: 'TestContract' }),
        expect.objectContaining({
          account: expect.objectContaining({ address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' }),
          rpcAddress: 'http://localhost:10332',
          networkMagic: mockNetworkMagic
        })
      );
      expect(mockExperimentalGetContractHash).toHaveBeenCalledWith('hex', 123456, 'TestContract');
      expect(result).toEqual(expect.objectContaining({
        txid: mockTransactionId,
        contractHash: `0x${mockContractHash}`,
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        network: NeoNetwork.MAINNET
      }));
    });
  });

  describe('listSupportedContracts', () => {
    test('should list all contracts', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({ id: 1, hash: '0x1234' });
      const contracts = await contractService.listSupportedContracts();
      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts.length).toBeGreaterThan(0);

      contracts.forEach(contract => {
        expect(contract).toHaveProperty('name');
        expect(contract).toHaveProperty('description');
        expect(contract).toHaveProperty('available');
        expect(contract).toHaveProperty('operationCount');
      });
    });
  });

  describe('isContractDeployed', () => {
    test('should return true when contract state exists on chain', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({ id: 1, hash: '0x1234' });

      await expect(contractService.isContractDeployed('NeoFS')).resolves.toBe(true);
      expect(mockRpcClient.getContractState).toHaveBeenCalledWith(contractService.getContractScriptHash('NeoFS'));
    });

    test('should return false when contract state lookup fails', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockRejectedValue(new Error('Unknown contract'));

      await expect(contractService.isContractDeployed('NeoFS')).resolves.toBe(false);
    });
  });

  describe('isContractAvailable', () => {
    test('should check contract availability', () => {
      Object.values(FAMOUS_CONTRACTS).forEach(contract => {
        const isAvailable = contractService.isContractAvailable(contract.name);
        expect(typeof isAvailable).toBe('boolean');
      });
    });

    test('should return false for non-existent contract', () => {
      expect(contractService.isContractAvailable('NonExistent')).toBe(false);
    });
  });

  describe('NeoFS operations', () => {
    const mockAccount = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };

    test('should create NeoFS container', async () => {
      const result = await contractService.createNeoFSContainer(
        mockAccount, 'owner123', []
      );
      expect(result).toBe(mockTransactionId);
    });

    test('should get NeoFS containers', async () => {
      const result = await contractService.getNeoFSContainers('owner123');
      expect(result).toBeDefined();
    });
  });

  describe('NeoBurger operations', () => {
    const mockAccount = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };

    test('should deposit to NeoBurger', async () => {
      const result = await contractService.depositNeoToNeoBurger(mockAccount);
      expect(result).toBe(mockTransactionId);
    });

    test('should withdraw from NeoBurger', async () => {
      const result = await contractService.withdrawNeoFromNeoBurger(mockAccount, '100');
      expect(result).toBe(mockTransactionId);
    });

    test('should get NeoBurger balance', async () => {
      const result = await contractService.getNeoBurgerBalance('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result).toBeDefined();
    });
  });
});
