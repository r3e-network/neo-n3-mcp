/**
 * Comprehensive Unit Tests for ContractService
 * Testing all contract operations with various scenarios
 */

import { jest } from '@jest/globals';
import { ContractService } from '../src/contracts/contract-service';
import { NeoNetwork } from '../src/services/neo-service';
import { FAMOUS_CONTRACTS } from '../src/contracts/contracts';
import { ContractError, NetworkError, ValidationError } from '../src/utils/errors';

// Mock data
const mockContractResult = {
  state: 'HALT',
  gasconsumed: '1000000',
  stack: [{ value: '100' }]
};

const mockTransactionId = '0xabc123def456';

// Mock neon-js
jest.mock('@cityofzion/neon-js', () => ({
  rpc: {
    RPCClient: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue(mockContractResult),
      invokeScript: jest.fn().mockResolvedValue(mockContractResult),
      sendRawTransaction: jest.fn().mockResolvedValue(mockTransactionId)
    }))
  },
  sc: {
    createScript: jest.fn().mockReturnValue('mock-script'),
    ContractParam: {
      string: jest.fn().mockReturnValue({ type: 'String', value: 'mock' }),
      integer: jest.fn().mockReturnValue({ type: 'Integer', value: 123 }),
      array: jest.fn().mockReturnValue({ type: 'Array', value: [] })
    }
  },
  wallet: {
    getScriptHashFromAddress: jest.fn().mockReturnValue('mock-hash'),
    Account: jest.fn().mockImplementation(() => ({
      address: 'NMockAddress123',
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
}));

describe('ContractService', () => {
  let contractService: ContractService;

  beforeEach(() => {
    jest.clearAllMocks();
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

    test('should throw ContractError for non-existent contract', () => {
      expect(() => contractService.getContract('NonExistent')).toThrow(ContractError);
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
  });

  describe('invokeContract', () => {
    const mockAccount = { address: 'NMockAddress123', WIF: 'mock-wif' };

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

  describe('listSupportedContracts', () => {
    test('should list all contracts', () => {
      const contracts = contractService.listSupportedContracts();
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
    const mockAccount = { address: 'NMockAddress123' };

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
    const mockAccount = { address: 'NMockAddress123' };

    test('should deposit to NeoBurger', async () => {
      const result = await contractService.depositNeoToNeoBurger(mockAccount);
      expect(result).toBe(mockTransactionId);
    });

    test('should withdraw from NeoBurger', async () => {
      const result = await contractService.withdrawNeoFromNeoBurger(mockAccount, '100');
      expect(result).toBe(mockTransactionId);
    });

    test('should get NeoBurger balance', async () => {
      const result = await contractService.getNeoBurgerBalance('NMockAddress123');
      expect(result).toBeDefined();
    });
  });
}); 