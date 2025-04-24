import { jest } from '@jest/globals';
import { ContractService } from '../../src/contracts/contract-service';
import { NeoNetwork } from '../../src/services/neo-service';
import { FAMOUS_CONTRACTS } from '../../src/contracts/contracts';
import { ContractError, NetworkError, ValidationError } from '../../src/utils/errors';

// Mock the validation functions
jest.mock('../../src/utils/validation', () => {
  const originalModule = jest.requireActual('../../src/utils/validation');
  return {
    ...originalModule,
    validateAddress: jest.fn().mockImplementation((address) => address),
    validateScriptHash: jest.fn().mockImplementation((hash) => hash.startsWith('0x') ? hash : `0x${hash}`),
    validateAmount: jest.fn().mockImplementation((amount) => amount.toString()),
    validateInteger: jest.fn().mockImplementation((value) => typeof value === 'string' ? parseInt(value, 10) : value),
  };
});

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the neon-js library
jest.mock('@cityofzion/neon-js', () => {
  return {
    rpc: {
      RPCClient: jest.fn().mockImplementation(() => ({
        invokeFunction: jest.fn().mockResolvedValue({
          state: 'HALT',
          gasconsumed: '10',
          stack: [{ type: 'ByteString', value: 'test' }]
        }),
        execute: jest.fn().mockImplementation((method, params) => {
          if (method === 'invokefunction') {
            return Promise.resolve({
              state: 'HALT',
              gasconsumed: '10',
              stack: [{ type: 'ByteString', value: 'test' }]
            });
          }
          return Promise.resolve(null);
        })
      })),
    },
    wallet: {
      Account: jest.fn().mockImplementation(() => ({
        address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
        publicKey: 'publicKey',
        WIF: 'WIF',
      })),
      getScriptHashFromAddress: jest.fn().mockReturnValue('scriptHash'),
    },
    sc: {
      createScript: jest.fn().mockReturnValue('script'),
      ContractParam: {
        hash160: jest.fn().mockReturnValue('hash160Param'),
        integer: jest.fn().mockReturnValue('integerParam'),
        any: jest.fn().mockReturnValue('anyParam'),
        string: jest.fn().mockReturnValue('stringParam'),
        array: jest.fn().mockReturnValue('arrayParam'),
      },
    },
    tx: {
      Transaction: jest.fn().mockImplementation(() => {
        return {
          sign: jest.fn().mockReturnValue(true),
          serialize: jest.fn().mockReturnValue('serializedTransaction')
        };
      })
    }
  };
});

describe('ContractService', () => {
  let contractService: ContractService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    contractService = new ContractService('http://localhost:10332', NeoNetwork.MAINNET);
  });

  test('constructor throws NetworkError for empty RPC URL', () => {
    expect(() => {
      new ContractService('', NeoNetwork.MAINNET);
    }).toThrow(NetworkError);
  });

  test('constructor throws NetworkError when RPC client initialization fails', () => {
    // Mock RPCClient constructor to throw
    const mockRpcClient = jest.spyOn(require('@cityofzion/neon-js').rpc, 'RPCClient');
    mockRpcClient.mockImplementationOnce(() => {
      throw new Error('Failed to connect');
    });

    expect(() => {
      new ContractService('http://invalid-url', NeoNetwork.MAINNET);
    }).toThrow(NetworkError);
  });

  test('listSupportedContracts returns all contracts with enhanced details', () => {
    const contracts = contractService.listSupportedContracts();
    expect(contracts.length).toBeGreaterThan(0);

    // Check for enhanced properties
    expect(contracts[0]).toHaveProperty('name');
    expect(contracts[0]).toHaveProperty('description');
    expect(contracts[0]).toHaveProperty('available');
    expect(contracts[0]).toHaveProperty('operationCount');
    expect(contracts[0]).toHaveProperty('network');

    // Verify network is set correctly
    expect(contracts[0].network).toBe(NeoNetwork.MAINNET);
  });

  test('getContract returns contract by name', () => {
    const contract = contractService.getContract('NeoFS');
    expect(contract).toHaveProperty('name', 'NeoFS');
    expect(contract).toHaveProperty('description');
    expect(contract).toHaveProperty('scriptHash');
    expect(contract).toHaveProperty('operations');
  });

  test('getContract handles case-insensitive contract names', () => {
    const contract1 = contractService.getContract('neofs');
    const contract2 = contractService.getContract('NEOFS');
    const contract3 = contractService.getContract('NeoFS');

    expect(contract1).toEqual(contract2);
    expect(contract2).toEqual(contract3);
  });

  test('getContract throws ValidationError for invalid contract name', () => {
    expect(() => {
      contractService.getContract('InvalidContract');
    }).toThrow(ValidationError);
  });

  test('getContract throws ValidationError for empty contract name', () => {
    expect(() => {
      contractService.getContract('');
    }).toThrow(ValidationError);
  });

  test('getContractScriptHash returns script hash for contract', () => {
    const scriptHash = contractService.getContractScriptHash('NeoFS');
    expect(typeof scriptHash).toBe('string');
    expect(scriptHash.length).toBeGreaterThan(0);
    expect(scriptHash.startsWith('0x')).toBe(true);
  });

  test('getContractScriptHash throws ContractError for unavailable contract', () => {
    // Mock isContractAvailable to return false
    jest.spyOn(contractService, 'isContractAvailable').mockReturnValueOnce(false);

    expect(() => {
      contractService.getContractScriptHash('UnavailableContract');
    }).toThrow(ContractError);
  });

  test('getContractScriptHash normalizes script hash format', () => {
    // Mock the getContract method to return a contract with a script hash without 0x prefix
    jest.spyOn(contractService, 'getContract').mockReturnValueOnce({
      name: 'MockContract',
      description: 'Mock contract for testing',
      scriptHash: {
        mainnet: '1234567890abcdef1234567890abcdef12345678' // No 0x prefix
      },
      operations: {}
    });

    const scriptHash = contractService.getContractScriptHash('MockContract');
    expect(scriptHash.startsWith('0x')).toBe(true);
  });

  test('getContractOperations returns operations with metadata', () => {
    const result = contractService.getContractOperations('NeoFS');

    // Check for enhanced metadata
    expect(result).toHaveProperty('operations');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('contractName');
    expect(result).toHaveProperty('network');
    expect(result).toHaveProperty('available');

    // Verify operations exist
    expect(typeof result.operations).toBe('object');
    expect(Object.keys(result.operations).length).toBeGreaterThan(0);

    // Verify count matches operations length
    expect(result.count).toBe(Object.keys(result.operations).length);
  });

  test('getContractOperations throws ContractError for invalid contract', () => {
    expect(() => {
      contractService.getContractOperations('InvalidContract');
    }).toThrow(ContractError);
  });

  test('isContractAvailable returns true for available contract', () => {
    // No need to mock, just test the actual implementation
    const available = contractService.isContractAvailable('NeoFS');
    expect(available).toBe(true);
  });

  test('isContractAvailable returns false for invalid contract name', () => {
    const available = contractService.isContractAvailable('InvalidContract');
    expect(available).toBe(false);
  });

  test('isContractAvailable returns false for empty contract name', () => {
    const available = contractService.isContractAvailable('');
    expect(available).toBe(false);
  });

  test('isContractAvailable returns false for non-string contract name', () => {
    const available = contractService.isContractAvailable(123 as any);
    expect(available).toBe(false);
  });

  test('isContractAvailable handles errors gracefully', () => {
    // Force an error by making getContract throw
    jest.spyOn(contractService, 'getContract').mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    const available = contractService.isContractAvailable('NeoFS');
    expect(available).toBe(true); // The implementation now returns true for known contracts even if there's an error
  });

  test('getNetwork returns the current network', () => {
    expect(contractService.getNetwork()).toBe(NeoNetwork.MAINNET);

    const testnetService = new ContractService('http://localhost:10332', NeoNetwork.TESTNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });

  test('invokeReadContract calls queryContract with correct parameters', async () => {
    // Spy on queryContract
    const querySpy = jest.spyOn(contractService, 'queryContract');

    await contractService.invokeReadContract(
      'NeoFS',
      'getContainerInfo',
      ['containerId']
    );

    // Verify queryContract was called with the right parameters
    expect(querySpy).toHaveBeenCalledWith('NeoFS', 'getContainerInfo', ['containerId']);
  });

  test('invokeReadContract handles errors properly', async () => {
    // Mock queryContract to throw an error
    jest.spyOn(contractService, 'queryContract').mockRejectedValueOnce(new Error('Test error'));

    await expect(contractService.invokeReadContract(
      'NeoFS',
      'getContainerInfo',
      ['containerId']
    )).rejects.toThrow(ContractError);
  });

  test('invokeWriteContract calls invokeContract with correct parameters', async () => {
    // Spy on invokeContract
    const invokeSpy = jest.spyOn(contractService, 'invokeContract').mockResolvedValueOnce('txid123');

    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };
    const result = await contractService.invokeWriteContract(
      account,
      'NeoFS',
      'createContainer',
      ['ownerId', []]
    );

    // Verify invokeContract was called with the right parameters
    expect(invokeSpy).toHaveBeenCalledWith(account, 'NeoFS', 'createContainer', ['ownerId', []]);
    expect(result).toHaveProperty('txid', 'txid123');
  });

  test('invokeWriteContract handles errors properly', async () => {
    // Mock invokeContract to throw an error
    jest.spyOn(contractService, 'invokeContract').mockRejectedValueOnce(new Error('Test error'));

    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };

    await expect(contractService.invokeWriteContract(
      account,
      'NeoFS',
      'createContainer',
      ['ownerId', []]
    )).rejects.toThrow(ContractError);
  });

  // Tests for specific contract methods
  describe('GrandShare methods', () => {
    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };

    test('depositToGrandShare validates parameters', async () => {
      // Spy on validation functions
      const validateAmountSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAmount');
      const validateIntegerSpy = jest.spyOn(require('../../src/utils/validation'), 'validateInteger');
      const validateAddressSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAddress');

      // Mock invokeContract to prevent actual execution
      jest.spyOn(contractService, 'invokeContract').mockResolvedValueOnce('txid123');

      await contractService.depositToGrandShare(account, 1, '100');

      // Verify validation functions were called
      expect(validateAmountSpy).toHaveBeenCalledWith('100');
      expect(validateIntegerSpy).toHaveBeenCalledWith(1);
      expect(validateAddressSpy).toHaveBeenCalledWith(account.address);
    });

    test('withdrawFromGrandShare validates parameters', async () => {
      // Spy on validation functions
      const validateAmountSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAmount');
      const validateIntegerSpy = jest.spyOn(require('../../src/utils/validation'), 'validateInteger');
      const validateAddressSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAddress');

      // Mock invokeContract to prevent actual execution
      jest.spyOn(contractService, 'invokeContract').mockResolvedValueOnce('txid123');

      await contractService.withdrawFromGrandShare(account, '2', 50);

      // Verify validation functions were called
      expect(validateAmountSpy).toHaveBeenCalledWith(50);
      expect(validateIntegerSpy).toHaveBeenCalledWith('2');
      expect(validateAddressSpy).toHaveBeenCalledWith(account.address);
    });

    test('getGrandSharePoolDetails validates poolId', async () => {
      // Spy on validation function
      const validateIntegerSpy = jest.spyOn(require('../../src/utils/validation'), 'validateInteger');

      // Mock queryContract to prevent actual execution
      jest.spyOn(contractService, 'queryContract').mockResolvedValueOnce({ result: 'success' });

      await contractService.getGrandSharePoolDetails('3');

      // Verify validation function was called
      expect(validateIntegerSpy).toHaveBeenCalledWith('3');
    });
  });

  describe('GhostMarket methods', () => {
    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };

    test('createGhostMarketNFT validates parameters', async () => {
      // Spy on validation function
      const validateAddressSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAddress');

      // Mock invokeContract to prevent actual execution
      jest.spyOn(contractService, 'invokeContract').mockResolvedValueOnce('txid123');

      await contractService.createGhostMarketNFT(account, 'ipfs://test', []);

      // Verify validation function was called
      expect(validateAddressSpy).toHaveBeenCalledWith(account.address);
    });

    test('createGhostMarketNFT throws ValidationError for empty tokenURI', async () => {
      await expect(contractService.createGhostMarketNFT(account, '', []))
        .rejects.toThrow(ValidationError);
    });

    test('listGhostMarketNFT validates parameters', async () => {
      // Spy on validation functions
      const validateAmountSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAmount');
      const validateIntegerSpy = jest.spyOn(require('../../src/utils/validation'), 'validateInteger');
      const validateScriptHashSpy = jest.spyOn(require('../../src/utils/validation'), 'validateScriptHash');
      const validateAddressSpy = jest.spyOn(require('../../src/utils/validation'), 'validateAddress');

      // Mock invokeContract to prevent actual execution
      jest.spyOn(contractService, 'invokeContract').mockResolvedValueOnce('txid123');

      await contractService.listGhostMarketNFT(
        account,
        1,
        '100',
        '0x1234567890abcdef1234567890abcdef12345678'
      );

      // Verify validation functions were called
      expect(validateIntegerSpy).toHaveBeenCalledWith(1);
      expect(validateAmountSpy).toHaveBeenCalledWith('100');
      expect(validateScriptHashSpy).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678');
      expect(validateAddressSpy).toHaveBeenCalledWith(account.address);
    });
  });
});
