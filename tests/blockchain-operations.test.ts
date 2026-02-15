/**
 * Comprehensive Unit Tests for Blockchain Operations
 * Testing all blockchain-related operations through NeoService
 */

import { jest } from '@jest/globals';
import { NeoService, NeoNetwork } from '../src/services/neo-service';
import { NetworkError, ValidationError } from '../src/utils/errors';

// Mock data for blockchain operations
const mockBlockchainInfo = {
  height: 12345,
  network: NeoNetwork.MAINNET,
  validators: [
    { publickey: 'key1', votes: '100', active: true },
    { publickey: 'key2', votes: '200', active: true }
  ]
};

const mockBlock = {
  hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  size: 1000,
  version: 0,
  previousblockhash: '0x0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba',
  merkleroot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  time: 1600000000,
  index: 12344,
  nonce: '0',
  nextconsensus: 'NMockConsensusAddress',
  script: { invocation: '', verification: '' },
  tx: []
};

const mockTransaction = {
  hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  size: 500,
  version: 0,
  nonce: 0,
  sender: 'NMockSenderAddress',
  sysfee: '0.1',
  netfee: '0.05',
  validuntilblock: 12400,
  signers: [],
  attributes: [],
  script: '',
  witnesses: []
};

const mockBalance = {
  address: 'NMockAddress123',
  balance: [
    { asset_name: 'NEO', asset_hash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', amount: '100' },
    { asset_name: 'GAS', asset_hash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '50.5' }
  ]
};

const mockTransferResult = {
  txid: '0xabc123def456789abc123def456789abc123def456789abc123def456789abc123'
};

// Mock neon-js
jest.mock('@cityofzion/neon-js', () => ({
  rpc: {
    RPCClient: jest.fn().mockImplementation(() => ({
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getValidators: jest.fn().mockResolvedValue(mockBlockchainInfo.validators),
      getBlock: jest.fn().mockResolvedValue(mockBlock),
      getTransaction: jest.fn().mockResolvedValue(mockTransaction),
      execute: jest.fn().mockImplementation((method) => {
        switch (method) {
          case 'getblockcount':
            return Promise.resolve(12345);
          case 'getvalidators':
            return Promise.resolve(mockBlockchainInfo.validators);
          case 'getblock':
            return Promise.resolve(mockBlock);
          case 'getrawtransaction':
            return Promise.resolve(mockTransaction);
          case 'getnep17balances':
            return Promise.resolve({
              address: 'NMockAddress123',
              balance: [
                { assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', amount: '100', lastupdatedblock: 12345 },
                { assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '50.5', lastupdatedblock: 12345 }
              ]
            });
          case 'sendrawtransaction':
            return Promise.resolve(mockTransferResult.txid);
          default:
            return Promise.resolve(null);
        }
      })
    }))
  },
  wallet: {
    Account: jest.fn().mockImplementation((wif) => ({
      address: 'NMockAddress123',
      WIF: wif || 'mock-wif',
      publicKey: 'mock-public-key',
      encrypt: jest.fn().mockResolvedValue('encrypted-key'),
      decrypt: jest.fn()
    })),
    getScriptHashFromAddress: jest.fn().mockReturnValue('mock-script-hash'),
    isWIF: jest.fn().mockReturnValue(true),
    isPrivateKey: jest.fn().mockReturnValue(true),
    encrypt: jest.fn().mockResolvedValue('encrypted-wif')
  },
  sc: {
    createScript: jest.fn().mockReturnValue('mock-script')
  },
  tx: {
    Transaction: jest.fn().mockImplementation(() => ({
      sign: jest.fn(),
      serialize: jest.fn().mockReturnValue('serialized-transaction')
    }))
  }
}));

describe('Blockchain Operations', () => {
  let neoService: NeoService;

  beforeEach(() => {
    jest.clearAllMocks();
    neoService = new NeoService('http://localhost:10332', NeoNetwork.MAINNET);
  });

  describe('NeoService constructor', () => {
    test('should create NeoService successfully', () => {
      expect(neoService).toBeDefined();
      expect(neoService.getNetwork()).toBe(NeoNetwork.MAINNET);
    });

    test('should create testnet service', () => {
      const testnetService = new NeoService('http://localhost:20332', NeoNetwork.TESTNET);
      expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
    });

    test('should throw NetworkError for empty RPC URL', () => {
      expect(() => new NeoService('', NeoNetwork.MAINNET)).toThrow(NetworkError);
    });
  });

  describe('getBlockchainInfo', () => {
    test('should get blockchain info successfully', async () => {
      const info = await neoService.getBlockchainInfo();
      
      expect(info).toHaveProperty('height');
      expect(info).toHaveProperty('network');
      expect(info).toHaveProperty('validators');
      expect(info.height).toBe(12345);
      expect(info.network).toBe(NeoNetwork.MAINNET);
      expect(Array.isArray(info.validators)).toBe(true);
    });

    test('should handle RPC errors', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.getBlockCount = jest.fn().mockRejectedValue(new Error('RPC Error'));

      await expect(neoService.getBlockchainInfo()).rejects.toThrow(NetworkError);
    });
  });

  describe('getBlockCount', () => {
    test('should get block count successfully', async () => {
      const count = await neoService.getBlockCount();
      expect(count).toBe(12345);
    });

    test('should handle RPC errors', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.getBlockCount = jest.fn().mockRejectedValue(new Error('RPC Error'));

      await expect(neoService.getBlockCount()).rejects.toThrow(NetworkError);
    });
  });

  describe('getBlock', () => {
    test('should get block by height', async () => {
      const block = await neoService.getBlock(12344);
      
      expect(block).toHaveProperty('hash');
      expect(block).toHaveProperty('index');
      expect(block).toHaveProperty('time');
      expect(block.index).toBe(12344);
    });

    test('should get block by hash', async () => {
      const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const block = await neoService.getBlock(blockHash);
      
      expect(block).toHaveProperty('hash');
      expect(block.hash).toBe(blockHash);
    });

    test('should handle invalid block identifier', async () => {
      await expect(neoService.getBlock('invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('getTransaction', () => {
    test('should get transaction successfully', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const tx = await neoService.getTransaction(txHash);
      
      expect(tx).toHaveProperty('hash');
      expect(tx).toHaveProperty('sender');
      expect(tx).toHaveProperty('sysfee');
      expect(tx).toHaveProperty('netfee');
    });

    test('should handle invalid transaction hash', async () => {
      await expect(neoService.getTransaction('invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('getBalance', () => {
    test('should get balance successfully', async () => {
      const balance = await neoService.getBalance('NMockAddress123');
      
      expect(balance).toHaveProperty('address');
      expect(balance).toHaveProperty('balance');
      expect(Array.isArray(balance.balance)).toBe(true);
      expect(balance.balance.length).toBeGreaterThan(0);
      
      balance.balance.forEach(asset => {
        expect(asset).toHaveProperty('asset_name');
        expect(asset).toHaveProperty('asset_hash');
        expect(asset).toHaveProperty('amount');
      });
    });

    test('should handle invalid address', async () => {
      await expect(neoService.getBalance('invalid')).rejects.toThrow(ValidationError);
    });

    test('should handle empty address', async () => {
      await expect(neoService.getBalance('')).rejects.toThrow(ValidationError);
    });
  });

  describe('transferAssets', () => {
    const mockAccount = {
      address: 'NMockAddress123',
      WIF: 'mock-wif'
    };

    test('should transfer assets successfully', async () => {
      const result = await neoService.transferAssets(
        mockAccount,
        'NRecipientAddress123',
        'NEO',
        '1'
      );
      
      expect(result).toHaveProperty('txid');
      expect(result.txid).toBe(mockTransferResult.txid);
    });

    test('should handle invalid recipient address', async () => {
      await expect(neoService.transferAssets(
        mockAccount,
        'invalid',
        'NEO',
        '1'
      )).rejects.toThrow(ValidationError);
    });

    test('should handle invalid amount', async () => {
      await expect(neoService.transferAssets(
        mockAccount,
        'NRecipientAddress123',
        'NEO',
        '0'
      )).rejects.toThrow(ValidationError);

      await expect(neoService.transferAssets(
        mockAccount,
        'NRecipientAddress123',
        'NEO',
        '-1'
      )).rejects.toThrow(ValidationError);
    });

    test('should handle missing account', async () => {
      await expect(neoService.transferAssets(
        null as any,
        'NRecipientAddress123',
        'NEO',
        '1'
      )).rejects.toThrow();
    });
  });

  describe('wallet operations', () => {
    test('should create wallet successfully', () => {
      const wallet = neoService.createWallet('password123');
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('encryptedPrivateKey');
      expect(wallet).toHaveProperty('WIF');
    });

    test('should import wallet from WIF', () => {
      const mockWif = 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k';
      const wallet = neoService.importWallet(mockWif);
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('WIF');
    });

    test('should handle invalid WIF', () => {
      expect(() => neoService.importWallet('invalid-wif')).toThrow();
    });
  });

  describe('fee calculation', () => {
    test('should calculate transfer fees', async () => {
      const fees = await neoService.calculateTransferFee(
        'NSenderAddress123',
        'NRecipientAddress123',
        'NEO',
        '1'
      );
      
      expect(fees).toHaveProperty('networkFee');
      expect(fees).toHaveProperty('systemFee');
      expect(typeof fees.networkFee).toBe('string');
      expect(typeof fees.systemFee).toBe('string');
    });

    test('should calculate invocation fees', async () => {
      const fees = await neoService.calculateInvokeFee(
        'NSenderAddress123',
        '0x1234567890abcdef1234567890abcdef12345678',
        'transfer',
        []
      );
      
      expect(fees).toHaveProperty('networkFee');
      expect(fees).toHaveProperty('systemFee');
    });
  });

  describe('contract invocation', () => {
    const mockAccount = {
      address: 'NMockAddress123',
      WIF: 'mock-wif'
    };

    test('should invoke contract successfully', async () => {
      const result = await neoService.invokeContract(
        mockAccount,
        '0x1234567890abcdef1234567890abcdef12345678',
        'transfer',
        []
      );
      
      expect(result).toHaveProperty('txid');
    });

    test('should handle invalid script hash', async () => {
      await expect(neoService.invokeContract(
        mockAccount,
        'invalid-hash',
        'transfer',
        []
      )).rejects.toThrow(ValidationError);
    });
  });

  describe('GAS claiming', () => {
    const mockAccount = {
      address: 'NMockAddress123',
      WIF: 'mock-wif'
    };

    test('should claim GAS successfully', async () => {
      const result = await neoService.claimGas(mockAccount);
      expect(result).toHaveProperty('txid');
    });

    test('should handle missing account', async () => {
      await expect(neoService.claimGas(null as any)).rejects.toThrow();
    });
  });

  describe('transaction status checking', () => {
    test('should check transaction status', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const status = await neoService.checkTransactionStatus(txHash);
      
      expect(status).toHaveProperty('confirmed');
      expect(typeof status.confirmed).toBe('boolean');
    });

    test('should handle invalid transaction hash', async () => {
      await expect(neoService.checkTransactionStatus('invalid')).rejects.toThrow(ValidationError);
    });
  });

  describe('network operations', () => {
    test('should get network', () => {
      expect(neoService.getNetwork()).toBe(NeoNetwork.MAINNET);
    });

    test('should handle network errors gracefully', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(neoService.getBlockchainInfo()).rejects.toThrow(NetworkError);
    });
  });

  describe('error handling', () => {
    test('should handle RPC client initialization errors', () => {
      // Mock neon-js to throw error during RPCClient creation
      const originalRPCClient = require('@cityofzion/neon-js').rpc.RPCClient;
      require('@cityofzion/neon-js').rpc.RPCClient = jest.fn().mockImplementation(() => {
        throw new Error('RPC Client initialization failed');
      });

      expect(() => new NeoService('http://localhost:10332', NeoNetwork.MAINNET))
        .toThrow(NetworkError);

      // Restore original implementation
      require('@cityofzion/neon-js').rpc.RPCClient = originalRPCClient;
    });

    test('should provide detailed error messages', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.getBlockCount = jest.fn().mockRejectedValue(new Error('Detailed test error'));

      try {
        await neoService.getBlockchainInfo();
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).message).toContain('blockchain info');
      }
    });
  });

  describe('edge cases', () => {
    test('should handle empty responses', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.getBlockCount = jest.fn().mockResolvedValue(null);

      await expect(neoService.getBlockchainInfo()).rejects.toThrow();
    });

    test('should handle malformed responses', async () => {
      const mockRpcClient = neoService['rpcClient'];
      mockRpcClient.execute = jest.fn().mockResolvedValue('invalid-response');

      await expect(neoService.getBalance('NMockAddress123')).rejects.toThrow();
    });

    test('should validate input parameters', async () => {
      // Test various invalid inputs
      await expect(neoService.getBlock(null as any)).rejects.toThrow();
      await expect(neoService.getTransaction(undefined as any)).rejects.toThrow();
      await expect(neoService.getBalance(123 as any)).rejects.toThrow();
    });
  });
}); 