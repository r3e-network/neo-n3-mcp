/**
 * Comprehensive Unit Tests for ContractService
 * Testing all contract operations with various scenarios
 */

import { jest } from '@jest/globals';
import { ContractService } from '../src/contracts/contract-service';
import { NeoNetwork } from '../src/services/neo-service';
import { ContractError, NetworkError, ValidationError } from '../src/utils/errors';

const mockContractResult = {
  script: 'mock-script',
  state: 'HALT',
  gasconsumed: '1000000',
  stack: [{ value: '100' }]
};

const mockTransactionId = `0x${'c'.repeat(64)}`;
const mockNetworkMagic = 860833102;
const mockContractHash = '1234567890abcdef1234567890abcdef12345678';

jest.mock('@cityofzion/neon-js', () => {
  const contractResult = {
    script: 'mock-script',
    state: 'HALT',
    gasconsumed: '1000000',
    stack: [{ value: '100' }]
  };
  const transactionId = `0x${'c'.repeat(64)}`;
  const networkMagic = 860833102;
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
  const mockSmartContractInvoke = jest.fn().mockResolvedValue(transactionId);
  const mockSendRawTransaction = jest.fn().mockResolvedValue(transactionId);
  const mockSetBlockExpiry = jest.fn().mockResolvedValue(undefined);
  const mockAddFees = jest.fn().mockResolvedValue(undefined);
  const mockTransactions: Array<Record<string, any>> = [];
  const mockEmitContractCall = jest.fn();
  const createNef = (script: string) => ({
    script,
    checksum: 123456,
    serialize: jest.fn().mockReturnValue(script),
  });
  const MockNef = Object.assign(
    jest.fn().mockImplementation(({ script }) => createNef(script)),
    {
      fromBuffer: jest.fn().mockImplementation((data: Buffer) => createNef(data.toString('hex'))),
    },
  );

  return {
    __esModule: true,
    __mocked: {
      mockRpcExecute,
      mockExperimentalDeployContract,
      mockExperimentalGetContractHash,
      mockSmartContractInvoke,
      mockSendRawTransaction,
      mockSetBlockExpiry,
      mockAddFees,
      mockTransactions,
      mockEmitContractCall,
    },
    rpc: {
      Query: jest.fn().mockImplementation((q) => q),
      RPCClient: jest.fn().mockImplementation(() => ({
        getBlockCount: jest.fn().mockResolvedValue(12345),
        execute: mockRpcExecute,
        invokeScript: jest.fn().mockResolvedValue(contractResult),
        invokeFunction: jest.fn().mockResolvedValue({
          state: 'HALT',
          stack: [{ type: 'Integer', value: '100000000000' }],
        }),
        calculateNetworkFee: jest.fn().mockResolvedValue(123456),
        sendRawTransaction: mockSendRawTransaction
      }))
    },
    sc: {
      createScript: jest.fn().mockReturnValue('mock-script'),
      NEF: MockNef,
      ContractManifest: {
        fromJson: jest.fn().mockImplementation((manifest) => ({
          ...manifest,
          name: manifest.name ?? 'TestContract',
          toJson: jest.fn().mockReturnValue(manifest)
        }))
      },
      ContractParam: {
        string: jest.fn().mockReturnValue({ type: 'String', value: 'mock' }),
        byteArray: jest.fn().mockReturnValue({ type: 'ByteArray', value: 'mock' }),
        integer: jest.fn().mockReturnValue({ type: 'Integer', value: 123 }),
        array: jest.fn().mockReturnValue({ type: 'Array', value: [] }),
        hash160: jest.fn().mockReturnValue({ type: 'Hash160', value: 'mock-hash' })
      },
      createScript: jest.fn().mockReturnValue('mock-invoke-script'),
      ScriptBuilder: jest.fn().mockImplementation(() => ({
        emitContractCall: mockEmitContractCall,
        build: jest.fn().mockReturnValue('mock-deploy-script'),
      })),
      CallFlags: { All: 'All' },
    },
    experimental: {
      deployContract: mockExperimentalDeployContract,
      getContractHash: mockExperimentalGetContractHash,
      SmartContract: jest.fn().mockImplementation(() => ({
        invoke: mockSmartContractInvoke
      })),
      txHelpers: {
        setBlockExpiry: mockSetBlockExpiry,
        addFees: mockAddFees,
      },
    },
    wallet: {
      getScriptHashFromAddress: jest.fn().mockImplementation((address) => (
        address === 'NMe6d3LkPJnuho56jtotZqCAgqQhHaSvPc'
          ? 'abcdef1234567890abcdef1234567890abcdef12'
          : 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e'
      )),
      isAddress: jest.fn().mockImplementation((address) => (
        address === 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr'
          || address === 'NMe6d3LkPJnuho56jtotZqCAgqQhHaSvPc'
      )),
      Account: jest.fn().mockImplementation(() => ({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        WIF: 'mock-wif',
        scriptHash: 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e',
        contract: { script: 'EQ==' },
      }))
    },
    u: {
      BigInteger: {
        fromDecimal: jest.fn().mockImplementation((value) => ({ toString: () => String(value) })),
      },
      HexString: {
        fromHex: jest.fn().mockReturnValue('hex'),
        fromBase64: jest.fn().mockReturnValue({ toString: () => 'verification-script' }),
      }
    },
    tx: {
      Transaction: jest.fn().mockImplementation(() => {
        const transaction: Record<string, any> = {
          script: undefined,
          signers: [],
          witnesses: [],
          sign: jest.fn(),
          hash: jest.fn().mockReturnValue('c'.repeat(64)),
          serialize: jest.fn().mockReturnValue('aa55'),
        };
        transaction.addSigner = jest.fn((signer) => {
          transaction.signers.push(signer);
          return transaction;
        });
        transaction.addWitness = jest.fn((witness) => {
          transaction.witnesses.push(witness);
          return transaction;
        });
        mockTransactions.push(transaction);
        return transaction;
      }),
      Witness: jest.fn().mockImplementation((value) => value),
      WitnessScope: { CalledByEntry: 'CalledByEntry' },
    },
    api: {
      smartCalculateNetworkFee: jest.fn().mockResolvedValue({ toString: () => '123456' }),
    },
    CONST: {
      DEFAULT_ADDRESS_VERSION: 53,
      NATIVE_CONTRACT_HASH: {
        ManagementContract: 'management-contract-hash',
      },
    },
  };
});

const neonJsMock = jest.requireMock('@cityofzion/neon-js') as {
  __mocked: {
    mockRpcExecute: jest.Mock;
    mockExperimentalDeployContract: jest.Mock;
    mockExperimentalGetContractHash: jest.Mock;
    mockSmartContractInvoke: jest.Mock;
    mockSendRawTransaction: jest.Mock;
    mockSetBlockExpiry: jest.Mock;
    mockAddFees: jest.Mock;
    mockTransactions: Array<Record<string, any>>;
    mockEmitContractCall: jest.Mock;
  };
};

const mockRpcExecute = neonJsMock.__mocked.mockRpcExecute;
const mockExperimentalDeployContract = neonJsMock.__mocked.mockExperimentalDeployContract;
const mockExperimentalGetContractHash = neonJsMock.__mocked.mockExperimentalGetContractHash;
const mockSmartContractInvoke = neonJsMock.__mocked.mockSmartContractInvoke;
const mockSendRawTransaction = neonJsMock.__mocked.mockSendRawTransaction;
const mockSetBlockExpiry = neonJsMock.__mocked.mockSetBlockExpiry;
const mockAddFees = neonJsMock.__mocked.mockAddFees;
const mockTransactions = neonJsMock.__mocked.mockTransactions;
const mockEmitContractCall = neonJsMock.__mocked.mockEmitContractCall;
const mockFetch = jest.fn();

describe('ContractService', () => {
  let contractService: ContractService;
  const genericContractHash = '0xabcdef1234567890abcdef1234567890abcdef12';
  const genericContractAddress = 'NMe6d3LkPJnuho56jtotZqCAgqQhHaSvPc';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactions.length = 0;
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
    mockSmartContractInvoke.mockResolvedValue(mockTransactionId);
    (globalThis as any).fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
    contractService = new ContractService('http://localhost:10332', NeoNetwork.MAINNET);
    contractService['rpcClient'].getContractState = jest.fn().mockResolvedValue({
      id: 7,
      hash: genericContractHash,
      updatecounter: 0,
      manifest: {
        name: 'GenericContract',
        abi: {
          methods: [{ name: 'balanceOf', parameters: [] }],
          events: []
        }
      }
    });
  });

  describe('constructor', () => {
    test('should create ContractService successfully', () => {
      expect(contractService).toBeDefined();
      expect(contractService.getNetwork()).toBe(NeoNetwork.MAINNET);
    });

    test('should throw NetworkError for empty RPC URL', () => {
      expect(() => new ContractService('', NeoNetwork.MAINNET)).toThrow(NetworkError);
    });

    test.each([
      'ftp://rpc.example',
      'ws://rpc.example',
      'file:///tmp/neo-rpc.sock',
      'http://',
      'https://',
    ])('rejects an RPC endpoint without a supported HTTP(S) host: %s', (rpcUrl) => {
      expect(() => new ContractService(rpcUrl, NeoNetwork.MAINNET))
        .toThrow(/invalid rpc url/i);
    });

    test('rejects embedded RPC credentials without echoing them in the error', () => {
      const rpcUrl = 'https://rpc-user:rpc-password@rpc.example/private?token=secret';
      let thrown: unknown;

      try {
        new ContractService(rpcUrl, NeoNetwork.MAINNET);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect((thrown as Error).message).toMatch(/invalid rpc url/i);
      expect((thrown as Error).message).not.toContain(rpcUrl);
      expect((thrown as Error).message).not.toContain('rpc-user');
      expect((thrown as Error).message).not.toContain('rpc-password');
    });

    test('accepts provider RPC endpoints with a path and query string', () => {
      expect(() => new ContractService(
        'https://rpc.example/provider/v2?project=public-id',
        NeoNetwork.MAINNET,
      )).not.toThrow();
    });

    test('rejects remote plaintext RPC unless explicitly enabled', () => {
      expect(() => new ContractService('http://rpc.example:20332', NeoNetwork.MAINNET))
        .toThrow(/HTTPS|secure RPC/i);
      expect(() => new ContractService('http://rpc.example:20332', NeoNetwork.MAINNET, {
        allowInsecureRpc: true,
      } as any)).not.toThrow();
    });

    test('rejects an unsupported runtime network', () => {
      expect(() => new ContractService(
        'http://127.0.0.1:10332',
        'private' as NeoNetwork
      )).toThrow(/invalid network/i);
    });
  });

  describe('getContract', () => {
    test('should reject names that are not in the verified curated registry', () => {
      expect(() => contractService.getContract('NonExistent')).toThrow(ContractError);
    });

    test('should reject arbitrary hashes from the curated-definition lookup', () => {
      expect(() => contractService.getContract(genericContractHash)).toThrow(ContractError);
    });
  });

  describe('generic contract references', () => {
    test('should resolve script hash from a Neo address', () => {
      const resolved = contractService.getContractScriptHash(genericContractAddress);

      expect(resolved).toBe(genericContractHash);
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

    test('bounds contract-state RPC calls by the configured deadline', async () => {
      jest.useFakeTimers();
      const TimeoutContractService = ContractService as unknown as new (
        rpcUrl: string,
        network: NeoNetwork,
        options: { rpcTimeoutMs: number }
      ) => ContractService;
      const service = new TimeoutContractService(
        'http://localhost:10332',
        NeoNetwork.MAINNET,
        { rpcTimeoutMs: 10 },
      );
      service['rpcClient'].getContractState = jest.fn().mockReturnValue(new Promise(() => undefined));

      try {
        const outcomePromise = service.getContractStatus(genericContractHash).then(
          () => 'resolved',
          (error) => error,
        );
        await jest.advanceTimersByTimeAsync(10);
        const outcome = await outcomePromise;

        expect(outcome).toBeInstanceOf(Error);
        expect((outcome as Error).message).toMatch(/timed out.*10ms/i);
      } finally {
        jest.useRealTimers();
      }
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

    test('does not cache unchecked N3Index aliases that bypass ambiguity detection', async () => {
      const firstHash = '0x148b3e0ca4f77476252862645e58f06b2562c414';
      const secondHash = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            contract_hash: firstHash,
            display_name: 'UniqueContractA',
            symbol: 'DUP',
            logo_url: null,
            network: 'mainnet',
            source: 'manual'
          },
          {
            contract_hash: secondHash,
            display_name: 'UniqueContractB',
            symbol: 'DUP',
            logo_url: null,
            network: 'mainnet',
            source: 'manual'
          }
        ]
      } as any);

      await expect(contractService.resolveContractScriptHash('UniqueContractA'))
        .resolves.toBe(firstHash);
      await expect(contractService.resolveContractScriptHash('DUP'))
        .rejects.toThrow(/ambiguous/i);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('queryContract', () => {
    test('should query an arbitrary contract successfully', async () => {
      const result = await contractService.queryContract(genericContractHash, 'balanceOf', []);
      expect(result).toBeDefined();
      expect(result.state).toBe('HALT');
    });

    test('should handle FAULT state', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockResolvedValue({
        state: 'FAULT',
        exception: 'Test error'
      });

      await expect(contractService.queryContract(genericContractHash, 'balanceOf', []))
        .rejects.toThrow(ContractError);
    });

    test.each(['BREAK', '', undefined])('rejects non-HALT query VM state %p', async (state) => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockResolvedValue({ state, stack: [] });

      await expect(contractService.queryContract(genericContractHash, 'balanceOf', []))
        .rejects.toThrow(/execution failed|VM state/i);
    });

    test('does not invoke a fallback method after a transport failure', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockRejectedValue(new Error('ETIMEDOUT node unavailable'));
      mockRpcClient.invokeScript = jest.fn();

      await expect(contractService.queryContract(genericContractHash, 'balanceOf', []))
        .rejects.toThrow('ETIMEDOUT');
      expect(mockRpcClient.invokeScript).not.toHaveBeenCalled();
    });

    test('uses invokeScript fallback only when invokefunction is unsupported', async () => {
      const mockRpcClient = contractService['rpcClient'];
      const unsupported = Object.assign(new Error('Method not found'), { code: -32601 });
      mockRpcClient.execute = jest.fn().mockRejectedValue(unsupported);
      mockRpcClient.invokeScript = jest.fn().mockResolvedValue(mockContractResult);

      await expect(contractService.queryContract(genericContractHash, 'balanceOf', []))
        .resolves.toMatchObject({ state: 'HALT' });
      expect(mockRpcClient.invokeScript).toHaveBeenCalledTimes(1);
    });

    test('preserves typed contract parameters for RPC invocations', async () => {
      const typedParameter = {
        type: 'Hash160',
        value: '1234567890abcdef1234567890abcdef12345678'
      };

      await contractService.queryContract(genericContractHash, 'balanceOf', [typedParameter]);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({
        method: 'invokefunction',
        params: [
          genericContractHash,
          'balanceOf',
          [typedParameter]
        ]
      }));
    });

    test('canonicalizes Neo addresses in typed Hash160 parameters', async () => {
      await contractService.queryContract(genericContractHash, 'balanceOf', [{
        type: 'Hash160',
        value: genericContractAddress,
      }]);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({
        method: 'invokefunction',
        params: [
          genericContractHash,
          'balanceOf',
          [{ type: 'Hash160', value: genericContractHash.slice(2) }],
        ],
      }));
    });

    test('rejects malformed typed Hash160 parameters before invoking RPC', async () => {
      await expect(contractService.queryContract(genericContractHash, 'balanceOf', [{
        type: 'Hash160',
        value: 'not-a-script-hash-or-address',
      }])).rejects.toBeInstanceOf(ValidationError);

      expect(mockRpcExecute).not.toHaveBeenCalled();
    });

    test('rejects checksum-invalid addresses in typed Hash160 parameters', async () => {
      await expect(contractService.queryContract(genericContractHash, 'balanceOf', [{
        type: 'Hash160',
        value: 'NbMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      }])).rejects.toBeInstanceOf(ValidationError);

      expect(mockRpcExecute).not.toHaveBeenCalled();
    });

    test('encodes binary contract parameters as base64 ByteArray values', async () => {
      await contractService.queryContract(genericContractHash, 'balanceOf', [Buffer.from([0xaa, 0xbb])]);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({
        method: 'invokefunction',
        params: [
          genericContractHash,
          'balanceOf',
          [{ type: 'ByteArray', value: 'qrs=' }],
        ],
      }));
    });

    test('encodes Neo address arguments as Hash160 values', async () => {
      await contractService.queryContract(genericContractHash, 'balanceOf', [genericContractAddress]);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({
        method: 'invokefunction',
        params: [
          genericContractHash,
          'balanceOf',
          [{ type: 'Hash160', value: genericContractHash.slice(2) }],
        ],
      }));
    });

    test('rejects fractional numeric parameters instead of emitting unsupported Float values', async () => {
      await expect(contractService.queryContract(genericContractHash, 'balanceOf', [1.5]))
        .rejects.toThrow(/fractional numbers are not supported/i);
    });

    test('preserves validation errors raised by malformed query parameters', async () => {
      await expect(contractService.queryContract(genericContractHash, 'balanceOf', [1.5]))
        .rejects.toBeInstanceOf(ValidationError);
    });

    test('supports bigint parameters without serializing them for logging', async () => {
      await expect(contractService.queryContract(genericContractHash, 'balanceOf', [42n]))
        .resolves.toMatchObject({ state: 'HALT' });

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({
        params: [
          genericContractHash,
          'balanceOf',
          [{ type: 'Integer', value: '42' }],
        ],
      }));
    });

    test('preserves validation errors through the invokeReadContract alias', async () => {
      await expect(contractService.invokeReadContract(genericContractHash, '', []))
        .rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('invokeContract', () => {
    const mockAccount = {
      address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      WIF: 'mock-wif',
      contract: { script: 'EQ==' },
    };

    test('builds contract invocations locally and submits through the configured RPC client', async () => {
      const result = await contractService.invokeContract(
        mockAccount, genericContractHash, 'balanceOf', []
      );
      expect(result).toBe(mockTransactionId);
      const neonJs = jest.requireMock('@cityofzion/neon-js') as any;
      expect(neonJs.experimental.SmartContract).not.toHaveBeenCalled();
      expect(mockSetBlockExpiry).not.toHaveBeenCalled();
      expect(mockAddFees).not.toHaveBeenCalled();
      expect(mockSendRawTransaction).toHaveBeenCalledWith('hex');
      expect(mockRpcExecute).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'invokefunction' }));
    });

    test('rejects an inconsistent RPC transaction ID and reports the locally derived ID', async () => {
      mockSendRawTransaction.mockResolvedValueOnce(`0x${'d'.repeat(64)}`);

      await expect(contractService.invokeContract(
        mockAccount, genericContractHash, 'balanceOf', []
      )).rejects.toThrow(new RegExp(`outcome is unknown.*0x${'c'.repeat(64)}.*do not retry`, 'i'));
    });

    test('encodes address arguments in signed contract invocation scripts', async () => {
      await contractService.invokeContract(
        mockAccount,
        genericContractHash,
        'balanceOf',
        [genericContractAddress],
      );

      const neonJs = jest.requireMock('@cityofzion/neon-js') as any;
      expect(neonJs.sc.createScript).toHaveBeenCalledWith(expect.objectContaining({
        args: [{ type: 'Hash160', value: genericContractHash.slice(2) }],
      }));
    });

    test('preserves validation errors raised by malformed signed invocation parameters', async () => {
      await expect(contractService.invokeContract(
        mockAccount,
        genericContractHash,
        'balanceOf',
        [1.5],
      )).rejects.toBeInstanceOf(ValidationError);
    });

    test('rejects name-based write targets', async () => {
      await expect(contractService.invokeContract(
        mockAccount, 'NeoXBridgeManagement', 'transfer', []
      )).rejects.toThrow(/explicit script hash or Neo address/i);
      expect(mockSmartContractInvoke).not.toHaveBeenCalled();
    });

    test('refuses to sign when the RPC endpoint reports a different network magic', async () => {
      (contractService as any).fetchRpcVersion = jest.fn().mockResolvedValue({
        protocol: { network: 894710606 },
      });

      await expect(contractService.invokeContract(
        mockAccount, genericContractHash, 'balanceOf', []
      )).rejects.toThrow(/RPC network mismatch.*mainnet.*860833102.*894710606/i);
      expect(mockSmartContractInvoke).not.toHaveBeenCalled();
    });

    test('should throw ContractError for invalid account', async () => {
      await expect(contractService.invokeContract(
        null, genericContractHash, 'balanceOf', []
      )).rejects.toThrow(ContractError);
    });
  });

  describe('deployContract', () => {
    const account = {
      address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      WIF: 'mock-wif',
      scriptHash: 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e',
      contract: { script: 'EQ==' },
    } as any;
    const manifest = {
      name: 'TestContract',
      groups: [],
      supportedstandards: [],
      abi: { methods: [], events: [] },
      permissions: [],
      trusts: [],
      extra: null
    };

    test('builds deployments locally and submits through the configured RPC client', async () => {
      const result = await contractService.deployContract(account, {
        encoding: 'base64',
        data: Buffer.from('aa55', 'hex').toString('base64'),
      }, manifest);

      expect(mockRpcExecute).toHaveBeenCalledWith(expect.objectContaining({ method: 'getversion', params: [] }));
      expect(mockExperimentalDeployContract).not.toHaveBeenCalled();
      expect(mockEmitContractCall).toHaveBeenCalledWith(expect.objectContaining({
        scriptHash: 'management-contract-hash',
        operation: 'deploy',
        callFlags: 'All',
      }));
      expect(mockSendRawTransaction).toHaveBeenCalledWith('hex');
      expect(mockExperimentalGetContractHash).toHaveBeenCalledWith('hex', 123456, 'TestContract');
      expect(result).toEqual(expect.objectContaining({
        txid: mockTransactionId,
        contractHash: `0x${mockContractHash}`,
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        network: NeoNetwork.MAINNET
      }));
    });

    test('reports an unknown submission outcome with the expected transaction ID on timeout', async () => {
      const TimeoutContractService = ContractService as unknown as new (
        rpcUrl: string,
        network: NeoNetwork,
        options: { rpcTimeoutMs: number }
      ) => ContractService;
      const service = new TimeoutContractService(
        'http://localhost:10332',
        NeoNetwork.MAINNET,
        { rpcTimeoutMs: 10 },
      );
      service['rpcClient'].getContractState = jest.fn().mockResolvedValue({ id: 7 });
      service['rpcClient'].sendRawTransaction = jest.fn().mockReturnValue(new Promise(() => undefined));

      const outcome = await service.invokeContract(
        {
          address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          WIF: 'mock-wif',
          contract: { script: 'EQ==' },
        },
        genericContractHash,
        'balanceOf',
        []
      ).then(() => 'resolved', (error) => error);

      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).message).toMatch(/outcome is unknown.*0x[c]{64}.*do not retry/i);
    });

    test('reports an unknown submission outcome with the expected transaction ID on transport failure', async () => {
      mockSendRawTransaction.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(contractService.invokeContract(
        {
          address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          WIF: 'mock-wif',
          contract: { script: 'EQ==' },
        },
        genericContractHash,
        'balanceOf',
        []
      )).rejects.toThrow(/outcome is unknown.*0x[c]{64}.*do not retry/i);
    });

    test.each([
      ['hex', 'aa55'],
      ['base64', Buffer.from('aa55', 'hex').toString('base64')],
    ] as const)('decodes explicitly %s-encoded complete NEF data', async (encoding, data) => {
      await contractService.deployContract(account, { encoding, data }, manifest);

      const neonJs = jest.requireMock('@cityofzion/neon-js') as any;
      expect(neonJs.sc.NEF.fromBuffer).toHaveBeenLastCalledWith(Buffer.from('aa55', 'hex'));
    });
  });

  describe('listSupportedContracts', () => {
    test('returns an empty list when no curated contracts are verified', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({ id: 1, hash: '0x1234' });
      const contracts = await contractService.listSupportedContracts();
      expect(contracts).toEqual([]);
      expect(mockRpcClient.getContractState).not.toHaveBeenCalled();
    });
  });

  describe('isContractDeployed', () => {
    test('should return true when contract state exists on chain', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockResolvedValue({ id: 1, hash: '0x1234' });

      await expect(contractService.isContractDeployed(genericContractHash)).resolves.toBe(true);
      expect(mockRpcClient.getContractState).toHaveBeenCalledWith(genericContractHash);
    });

    test('should return false when contract state lookup fails', async () => {
      const mockRpcClient = contractService['rpcClient'];
      mockRpcClient.getContractState = jest.fn().mockRejectedValue(new Error('Unknown contract'));

      await expect(contractService.isContractDeployed(genericContractHash)).resolves.toBe(false);
    });
  });

  describe('isContractAvailable', () => {
    test('should accept a valid generic script hash', () => {
      expect(contractService.isContractAvailable(genericContractHash)).toBe(true);
    });

    test('should return false for non-existent contract', () => {
      expect(contractService.isContractAvailable('NonExistent')).toBe(false);
    });
  });

});
