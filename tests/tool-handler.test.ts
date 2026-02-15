/**
 * Comprehensive Unit Tests for Tool Handlers
 * Testing all MCP tool operations
 */

import { jest } from '@jest/globals';
import { callTool } from '../src/handlers/tool-handler';
import { NeoService, NeoNetwork } from '../src/services/neo-service';
import { ContractService } from '../src/contracts/contract-service';
import { FAMOUS_CONTRACTS } from '../src/contracts/contracts';
import { ValidationError } from '../src/utils/errors';

// Mock data
const mockBlockchainInfo = {
  height: 12345,
  network: NeoNetwork.MAINNET,
  validators: []
};

const mockBalance = {
  address: 'NMockAddress123',
  balance: [
    { asset_name: 'NEO', asset_hash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', amount: '100' },
    { asset_name: 'GAS', asset_hash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '50.5' }
  ]
};

const mockTransferResult = { txid: '0xabc123def456' };
const mockWallet = {
  address: 'NMockAddress123',
  publicKey: 'mock-public-key',
  encryptedPrivateKey: 'encrypted-key',
  WIF: 'mock-wif'
};

// Mock services
const createMockNeoService = (): jest.Mocked<NeoService> => ({
  getBlockchainInfo: jest.fn().mockResolvedValue(mockBlockchainInfo),
  getBlockCount: jest.fn().mockResolvedValue(12345),
  getBlock: jest.fn().mockResolvedValue({ hash: '0x123', index: 12344 }),
  getTransaction: jest.fn().mockResolvedValue({ hash: '0x456', sender: 'NMock' }),
  getBalance: jest.fn().mockResolvedValue(mockBalance),
  transferAssets: jest.fn().mockResolvedValue(mockTransferResult),
  invokeContract: jest.fn().mockResolvedValue(mockTransferResult),
  createWallet: jest.fn().mockReturnValue(mockWallet),
  importWallet: jest.fn().mockReturnValue(mockWallet),
  calculateTransferFee: jest.fn().mockResolvedValue({ networkFee: '0.1', systemFee: '0.05' }),
  calculateInvokeFee: jest.fn().mockResolvedValue({ networkFee: '0.1', systemFee: '0.05' }),
  claimGas: jest.fn().mockResolvedValue(mockTransferResult),
  getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
} as any);

const createMockContractService = (): jest.Mocked<ContractService> => ({
  listSupportedContracts: jest.fn().mockReturnValue([
    { name: 'NeoFS', description: 'Decentralized storage', available: true, operationCount: 5, network: NeoNetwork.MAINNET }
  ]),
  getContractOperations: jest.fn().mockReturnValue({
    operations: { transfer: { name: 'transfer', description: 'Transfer tokens' } },
    count: 1,
    contractName: 'NeoFS',
    network: NeoNetwork.MAINNET,
    available: true
  }),
  queryContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] }),
  invokeContract: jest.fn().mockResolvedValue('0xabc123'),
  getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
} as any);

describe('Tool Handlers', () => {
  let mockNeoServices: Map<NeoNetwork, NeoService>;
  let mockContractServices: Map<NeoNetwork, ContractService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockNeoServices = new Map();
    mockNeoServices.set(NeoNetwork.MAINNET, createMockNeoService());
    mockNeoServices.set(NeoNetwork.TESTNET, createMockNeoService());

    mockContractServices = new Map();
    mockContractServices.set(NeoNetwork.MAINNET, createMockContractService());
    mockContractServices.set(NeoNetwork.TESTNET, createMockContractService());
  });

  describe('get_network_mode', () => {
    test('should return network mode successfully', async () => {
      const result = await callTool('get_network_mode', {}, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('networkMode');
    });
  });

  describe('get_blockchain_info', () => {
    test('should get blockchain info for mainnet', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('height');
      expect(result.result.height).toBe(12345);
    });

    test('should get blockchain info for testnet', async () => {
      const input = { network: 'testnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('height');
    });

    test('should handle missing network parameter', async () => {
      const result = await callTool('get_blockchain_info', {}, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });

  describe('get_block_count', () => {
    test('should get block count successfully', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('get_block_count', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('blockCount');
      expect(result.result.blockCount).toBe(12345);
    });
  });

  describe('get_block', () => {
    test('should get block by height', async () => {
      const input = { network: 'mainnet', hashOrHeight: 12344 };
      const result = await callTool('get_block', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('hash');
    });

    test('should get block by hash', async () => {
      const input = { 
        network: 'mainnet', 
        hashOrHeight: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };
      const result = await callTool('get_block', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
    });
  });

  describe('get_transaction', () => {
    test('should get transaction successfully', async () => {
      const input = { 
        network: 'mainnet', 
        txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };
      const result = await callTool('get_transaction', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('hash');
    });

    test('should handle invalid transaction hash', async () => {
      const input = { network: 'mainnet', txid: 'invalid' };
      const result = await callTool('get_transaction', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('get_balance', () => {
    test('should get balance successfully', async () => {
      const input = { network: 'mainnet', address: 'NMockAddress123' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('address');
      expect(result.result).toHaveProperty('balance');
      expect(Array.isArray(result.result.balance)).toBe(true);
    });

    test('should handle invalid address', async () => {
      const input = { network: 'mainnet', address: 'invalid' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('transfer_assets', () => {
    test('should transfer assets successfully', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        toAddress: 'NRecipientAddress123',
        asset: 'NEO',
        amount: '1',
        confirm: true
      };
      const result = await callTool('transfer_assets', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('txid');
    });

    test('should require confirmation', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        toAddress: 'NRecipientAddress123',
        asset: 'NEO',
        amount: '1',
        confirm: false
      };
      const result = await callTool('transfer_assets', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });

    test('should handle invalid WIF', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'invalid-wif',
        toAddress: 'NRecipientAddress123',
        asset: 'NEO',
        amount: '1',
        confirm: true
      };
      const result = await callTool('transfer_assets', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('create_wallet', () => {
    test('should create wallet successfully', async () => {
      const input = { password: 'password123' };
      const result = await callTool('create_wallet', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('address');
      expect(result.result).toHaveProperty('encryptedWIF');
    });

    test('should handle invalid password', async () => {
      const input = { password: '123' }; // too short
      const result = await callTool('create_wallet', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('import_wallet', () => {
    test('should import wallet with password', async () => {
      const input = { 
        key: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        password: 'password123'
      };
      const result = await callTool('import_wallet', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('address');
      expect(result.result).toHaveProperty('encryptedWIF');
    });

    test('should import wallet without password', async () => {
      const input = { key: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k' };
      const result = await callTool('import_wallet', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('address');
      expect(result.result).toHaveProperty('WIF');
    });
  });

  describe('invoke_contract', () => {
    test('should invoke read-only contract', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'balanceOf',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
    });

    test('should invoke write contract with WIF', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: [],
        confirm: true
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
    });

    test('should require confirmation for write operations', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: [],
        confirm: false
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('list_famous_contracts', () => {
    test('should list contracts successfully', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('list_famous_contracts', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('contracts');
      expect(Array.isArray(result.contracts)).toBe(true);
    });
  });

  describe('get_contract_info', () => {
    test('should get contract info successfully', async () => {
      const input = { network: 'mainnet', contractName: 'NeoFS' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('contractInfo');
      expect(result.contractInfo).toHaveProperty('operations');
      expect(result.contractInfo).toHaveProperty('contractName');
    });

    test('should handle invalid contract name', async () => {
      const input = { network: 'mainnet', contractName: 'NonExistent' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('estimate_transfer_fees', () => {
    test('should estimate transfer fees successfully', async () => {
      const input = {
        network: 'mainnet',
        fromAddress: 'NSenderAddress123',
        toAddress: 'NRecipientAddress123',
        asset: 'NEO',
        amount: '1'
      };
      const result = await callTool('estimate_transfer_fees', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('networkFee');
      expect(result.result).toHaveProperty('systemFee');
    });
  });

  describe('estimate_invoke_fees', () => {
    test('should estimate invoke fees successfully', async () => {
      const input = {
        network: 'mainnet',
        signerAddress: 'NSenderAddress123',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('networkFee');
      expect(result.result).toHaveProperty('systemFee');
    });

    test('should require signer address', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('claim_gas', () => {
    test('should claim GAS successfully', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        confirm: true
      };
      const result = await callTool('claim_gas', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('txid');
    });

    test('should require confirmation', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        confirm: false
      };
      const result = await callTool('claim_gas', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('error handling', () => {
    test('should handle unknown tool', async () => {
      const result = await callTool('unknown_tool', {}, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should handle invalid network', async () => {
      const input = { network: 'invalid' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should handle service errors', async () => {
      const mockService = mockNeoServices.get(NeoNetwork.MAINNET)!;
      mockService.getBlockchainInfo = jest.fn().mockRejectedValue(new Error('Service error'));

      const input = { network: 'mainnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });

  describe('validation', () => {
    test('should validate addresses', async () => {
      const input = { network: 'mainnet', address: 'invalid-address' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should validate amounts', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: 'L5yLSKvNBzC9M6XECV6eaTVX5dLKzGCY8wV9wXw8LkUuMbhJE21k',
        toAddress: 'NRecipientAddress123',
        asset: 'NEO',
        amount: '0', // invalid amount
        confirm: true
      };
      const result = await callTool('transfer_assets', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should validate script hashes', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: 'invalid-hash',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });
}); 