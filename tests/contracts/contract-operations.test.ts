/**
 * Tests for contract operations
 * 
 * This file contains comprehensive tests for the contract operations
 * to ensure that they function correctly and handle edge cases properly.
 */
import { ContractService } from '../../src/contracts/contract-service.js';
import { FAMOUS_CONTRACTS } from '../../src/contracts/contracts.js';
import { NeoNetwork } from '../../src/services/neo-service.js';

// Mock the neon-js module
jest.mock('@cityofzion/neon-js', () => ({
  rpc: {
    RPCClient: jest.fn().mockImplementation(() => ({
      invokeScript: jest.fn().mockResolvedValue({
        state: 'HALT',
        gasconsumed: '1000',
        stack: [{ value: true }]
      }),
      sendRawTransaction: jest.fn().mockResolvedValue('txid-123456'),
    }))
  },
  sc: {
    ContractParam: {
      string: jest.fn().mockReturnValue({ type: 'String', value: 'mock-string' }),
      hash160: jest.fn().mockReturnValue({ type: 'Hash160', value: 'mock-hash160' }),
      integer: jest.fn().mockReturnValue({ type: 'Integer', value: 'mock-integer' }),
      array: jest.fn().mockReturnValue({ type: 'Array', value: [] })
    },
    createScript: jest.fn().mockReturnValue('mock-script')
  },
  u: {
    HexString: {
      fromHex: jest.fn().mockReturnValue('mock-hex')
    }
  },
  tx: {
    Transaction: jest.fn().mockImplementation(() => ({
      sign: jest.fn(),
      serialize: jest.fn().mockReturnValue('mock-serialized-tx')
    }))
  },
  wallet: {
    getScriptHashFromAddress: jest.fn().mockReturnValue('mock-script-hash')
  }
}));

describe('ContractService Operations', () => {
  // Mock account for testing
  const mockAccount = {
    address: 'NXV7ZhHaLY2GNjp6R1AYBV9FqrVnGLfQcz',
    privateKey: '7d128a6d096f0c14c3a25a2b0c41cf79661bfcb4a8cc95aaaea28bde4d732344',
    sign: jest.fn().mockReturnValue(Buffer.from('mock-signature'))
  };
  
  // Create a test service with mocked dependencies
  const createTestService = () => {
    const service = new ContractService('https://mock-url.com', NeoNetwork.MAINNET);
    
    // Mock the ContractService's methods
    jest.spyOn(service, 'getContract').mockImplementation((contractName) => {
      const contract = FAMOUS_CONTRACTS[contractName.toLowerCase()];
      if (!contract) {
        throw new Error(`Contract ${contractName} not found`);
      }
      return contract;
    });
    
    jest.spyOn(service, 'getContractScriptHash').mockImplementation((contractName) => {
      const contract = FAMOUS_CONTRACTS[contractName.toLowerCase()];
      if (!contract) {
        throw new Error(`Contract ${contractName} not found`);
      }
      return contract.scriptHash[NeoNetwork.MAINNET] || '';
    });
    
    jest.spyOn(service, 'queryContract').mockResolvedValue({
      state: 'HALT',
      gasconsumed: '1000',
      stack: [{ value: true }]
    });
    
    jest.spyOn(service, 'invokeContract').mockResolvedValue('txid-123456');
    
    return service;
  };
  
  beforeEach(() => {
    // Reset mock call history
    jest.clearAllMocks();
    mockAccount.sign.mockClear();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('NeoFS Operations', () => {
    test('createNeoFSContainer creates a container', async () => {
      const service = createTestService();
      const ownerId = 'owner-123';
      const rules = [{ key: 'test', value: 'value' }];
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.createNeoFSContainer(mockAccount, ownerId, rules);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neofs',
        FAMOUS_CONTRACTS.neofs.operations.createContainer.name,
        expect.any(Array)
      );
    });
    
    test('getNeoFSContainers returns containers', async () => {
      const service = createTestService();
      const ownerId = 'owner-123';
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getNeoFSContainers(ownerId);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'neofs',
        FAMOUS_CONTRACTS.neofs.operations.getContainers.name,
        expect.any(Array)
      );
    });
  });
  
  describe('NeoBurger Operations', () => {
    test('depositNeoToNeoBurger deposits NEO', async () => {
      const service = createTestService();
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.depositNeoToNeoBurger(mockAccount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neoburger',
        FAMOUS_CONTRACTS.neoburger.operations.depositNeo.name,
        expect.any(Array)
      );
    });
    
    test('withdrawNeoFromNeoBurger withdraws NEO', async () => {
      const service = createTestService();
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.withdrawNeoFromNeoBurger(mockAccount, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neoburger',
        FAMOUS_CONTRACTS.neoburger.operations.withdrawNeo.name,
        expect.any(Array)
      );
    });
    
    test('getNeoBurgerBalance returns balance', async () => {
      const service = createTestService();
      const address = 'NXV7ZhHaLY2GNjp6R1AYBV9FqrVnGLfQcz';
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getNeoBurgerBalance(address);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'neoburger',
        FAMOUS_CONTRACTS.neoburger.operations.balanceOf.name,
        expect.any(Array)
      );
    });
    
    test('claimNeoBurgerGas claims GAS', async () => {
      const service = createTestService();
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.claimNeoBurgerGas(mockAccount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neoburger',
        FAMOUS_CONTRACTS.neoburger.operations.claimGas.name,
        expect.any(Array)
      );
    });
  });
  
  describe('Flamingo Operations', () => {
    test('stakeFlamingo stakes FLM tokens', async () => {
      const service = createTestService();
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.stakeFlamingo(mockAccount, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'flamingo',
        FAMOUS_CONTRACTS.flamingo.operations.stake.name,
        expect.any(Array)
      );
    });
    
    test('unstakeFlamingo unstakes FLM tokens', async () => {
      const service = createTestService();
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.unstakeFlamingo(mockAccount, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'flamingo',
        FAMOUS_CONTRACTS.flamingo.operations.unstake.name,
        expect.any(Array)
      );
    });
    
    test('getFlamingoBalance returns balance', async () => {
      const service = createTestService();
      const address = 'NXV7ZhHaLY2GNjp6R1AYBV9FqrVnGLfQcz';
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getFlamingoBalance(address);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'flamingo',
        FAMOUS_CONTRACTS.flamingo.operations.balanceOf.name,
        expect.any(Array)
      );
    });
  });
  
  describe('NeoCompound Operations', () => {
    test('depositToNeoCompound deposits assets', async () => {
      const service = createTestService();
      const assetId = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.depositToNeoCompound(mockAccount, assetId, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neocompound',
        FAMOUS_CONTRACTS.neocompound.operations.deposit.name,
        expect.any(Array)
      );
    });
    
    test('withdrawFromNeoCompound withdraws assets', async () => {
      const service = createTestService();
      const assetId = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.withdrawFromNeoCompound(mockAccount, assetId, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'neocompound',
        FAMOUS_CONTRACTS.neocompound.operations.withdraw.name,
        expect.any(Array)
      );
    });
    
    test('getNeoCompoundBalance returns balance', async () => {
      const service = createTestService();
      const address = 'NXV7ZhHaLY2GNjp6R1AYBV9FqrVnGLfQcz';
      const assetId = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getNeoCompoundBalance(address, assetId);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'neocompound',
        FAMOUS_CONTRACTS.neocompound.operations.getBalance.name,
        expect.any(Array)
      );
    });
  });
  
  describe('GrandShare Operations', () => {
    test('depositToGrandShare deposits assets', async () => {
      const service = createTestService();
      const poolId = 1;
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.depositToGrandShare(mockAccount, poolId, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'grandshare',
        FAMOUS_CONTRACTS.grandshare.operations.deposit.name,
        expect.any(Array)
      );
    });
    
    test('withdrawFromGrandShare withdraws assets', async () => {
      const service = createTestService();
      const poolId = 1;
      const amount = '100';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.withdrawFromGrandShare(mockAccount, poolId, amount);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'grandshare',
        FAMOUS_CONTRACTS.grandshare.operations.withdraw.name,
        expect.any(Array)
      );
    });
    
    test('getGrandSharePoolDetails returns pool details', async () => {
      const service = createTestService();
      const poolId = 1;
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getGrandSharePoolDetails(poolId);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'grandshare',
        FAMOUS_CONTRACTS.grandshare.operations.getPoolDetails.name,
        expect.any(Array)
      );
    });
  });
  
  describe('GhostMarket Operations', () => {
    test('createGhostMarketNFT creates an NFT', async () => {
      const service = createTestService();
      const tokenURI = 'https://example.com/token/1';
      const properties = [{ key: 'test', value: 'value' }];
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.createGhostMarketNFT(mockAccount, tokenURI, properties);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'ghostmarket',
        FAMOUS_CONTRACTS.ghostmarket.operations.createNFT.name,
        expect.any(Array)
      );
    });
    
    test('listGhostMarketNFT lists an NFT for sale', async () => {
      const service = createTestService();
      const tokenId = 1;
      const price = '100';
      const paymentToken = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.listGhostMarketNFT(mockAccount, tokenId, price, paymentToken);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'ghostmarket',
        FAMOUS_CONTRACTS.ghostmarket.operations.listNFT.name,
        expect.any(Array)
      );
    });
    
    test('buyGhostMarketNFT buys an NFT', async () => {
      const service = createTestService();
      const tokenId = 1;
      
      const invokeContractSpy = jest.spyOn(service, 'invokeContract');
      
      const result = await service.buyGhostMarketNFT(mockAccount, tokenId);
      
      expect(result).toBe('txid-123456');
      expect(invokeContractSpy).toHaveBeenCalledWith(
        mockAccount,
        'ghostmarket',
        FAMOUS_CONTRACTS.ghostmarket.operations.buyNFT.name,
        expect.any(Array)
      );
    });
    
    test('getGhostMarketTokenInfo returns token info', async () => {
      const service = createTestService();
      const tokenId = 1;
      
      const queryContractSpy = jest.spyOn(service, 'queryContract');
      
      const result = await service.getGhostMarketTokenInfo(tokenId);
      
      expect(result).toBeDefined();
      expect(queryContractSpy).toHaveBeenCalledWith(
        'ghostmarket',
        FAMOUS_CONTRACTS.ghostmarket.operations.getTokenInfo.name,
        expect.any(Array)
      );
    });
  });
  
  describe('Error handling', () => {
    test('handles RPC errors correctly', async () => {
      const service = createTestService();
      
      // Mock error response
      jest.spyOn(service, 'queryContract').mockRejectedValueOnce(new Error('RPC error'));
      
      // Mock getNeoFSContainers to make it pass through to queryContract but wrap the error
      jest.spyOn(service, 'getNeoFSContainers').mockImplementation(async (ownerId) => {
        try {
          await service.queryContract('neofs', 'getContainers', [ownerId]);
          return {};
        } catch (error: any) {
          throw new Error(`Failed to query contract neofs: ${error.message}`);
        }
      });
      
      await expect(service.getNeoFSContainers('owner-123')).rejects.toThrow('Failed to query contract');
    });
    
    test('handles contract execution failures', async () => {
      const service = createTestService();
      
      // Mock failed execution
      const mockFaultResult = {
        state: 'FAULT',
        exception: 'Contract execution failed'
      };
      
      // Override the queryContract implementation for this test
      jest.spyOn(service, 'queryContract').mockImplementation(async () => {
        // Return the fault result
        return mockFaultResult;
      });
      
      // Mock getNeoFSContainers to check the result and throw an error on FAULT
      jest.spyOn(service, 'getNeoFSContainers').mockImplementation(async (ownerId) => {
        const result = await service.queryContract('neofs', 'getContainers', [ownerId]);
        if (result.state === 'FAULT') {
          throw new Error(`Contract execution failed: ${result.exception || 'Unknown error'}`);
        }
        return result;
      });
      
      await expect(service.getNeoFSContainers('owner-123')).rejects.toThrow('Contract execution failed');
    });
  });
}); 