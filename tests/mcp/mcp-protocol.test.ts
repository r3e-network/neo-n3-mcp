import { jest } from '@jest/globals';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { handleMcpRequest } from '../../src/index';
import { NeoService } from '../../src/services/neo-service';
import { ContractService } from '../../src/contracts/contract-service';

/**
 * MCP Protocol Implementation Tests
 * 
 * These tests verify that the MCP protocol implementation works correctly
 */

// Mock the NeoService and ContractService
jest.mock('../../src/services/neo-service');
jest.mock('../../src/contracts/contract-service');

describe('MCP Protocol Implementation Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock NeoService methods
    (NeoService as jest.Mock).mockImplementation(() => ({
      getBlockchainHeight: jest.fn().mockResolvedValue(12345),
      getBlock: jest.fn().mockResolvedValue({ index: 12345, hash: '0x1234567890abcdef', size: 1024 }),
      getTransaction: jest.fn().mockResolvedValue({ txid: '0x1234567890abcdef', size: 1024 }),
      getBalance: jest.fn().mockResolvedValue({ NEO: '10', GAS: '5.5' }),
      transferAssets: jest.fn().mockResolvedValue({ txid: '0x1234567890abcdef' }),
      createWallet: jest.fn().mockResolvedValue({ address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ', WIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn' }),
      importWallet: jest.fn().mockResolvedValue({ address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' }),
      getNetwork: jest.fn().mockReturnValue('testnet'),
    }));
    
    // Mock ContractService methods
    (ContractService as jest.Mock).mockImplementation(() => ({
      listSupportedContracts: jest.fn().mockReturnValue([
        { name: 'NeoFS', description: 'Decentralized storage system' },
        { name: 'NeoBurger', description: 'Neo N3 staking service' },
      ]),
      getContract: jest.fn().mockReturnValue({ name: 'NeoFS', description: 'Decentralized storage system' }),
      getContractScriptHash: jest.fn().mockReturnValue('0x1234567890abcdef'),
      getContractOperations: jest.fn().mockReturnValue(['operation1', 'operation2']),
      isContractAvailable: jest.fn().mockReturnValue(true),
      getNetwork: jest.fn().mockReturnValue('testnet'),
      invokeReadContract: jest.fn().mockResolvedValue({ result: 'success' }),
      invokeWriteContract: jest.fn().mockResolvedValue({ txid: '0x1234567890abcdef' }),
    }));
  });
  
  test('should handle get_blockchain_info tool request', async () => {
    const request = {
      name: 'get_blockchain_info',
      arguments: {},
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('height', 12345);
    expect(response.result).toHaveProperty('network', 'testnet');
  });
  
  test('should handle get_block tool request', async () => {
    const request = {
      name: 'get_block',
      arguments: {
        hashOrHeight: 12345,
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('index', 12345);
    expect(response.result).toHaveProperty('hash', '0x1234567890abcdef');
  });
  
  test('should handle get_transaction tool request', async () => {
    const request = {
      name: 'get_transaction',
      arguments: {
        txid: '0x1234567890abcdef',
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('txid', '0x1234567890abcdef');
  });
  
  test('should handle get_balance tool request', async () => {
    const request = {
      name: 'get_balance',
      arguments: {
        address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('NEO', '10');
    expect(response.result).toHaveProperty('GAS', '5.5');
  });
  
  test('should handle transfer_assets tool request', async () => {
    const request = {
      name: 'transfer_assets',
      arguments: {
        fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
        toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
        asset: 'NEO',
        amount: '1',
        confirm: true,
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('txid', '0x1234567890abcdef');
  });
  
  test('should handle create_wallet tool request', async () => {
    const request = {
      name: 'create_wallet',
      arguments: {
        password: 'password123',
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('address', 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
    expect(response.result).toHaveProperty('WIF');
  });
  
  test('should handle import_wallet tool request', async () => {
    const request = {
      name: 'import_wallet',
      arguments: {
        key: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
        password: 'password123',
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('address', 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
  });
  
  test('should handle list_famous_contracts tool request', async () => {
    const request = {
      name: 'list_famous_contracts',
      arguments: {},
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('contracts');
    expect(response.result.contracts).toHaveLength(2);
    expect(response.result.contracts[0]).toHaveProperty('name', 'NeoFS');
  });
  
  test('should handle get_contract_info tool request', async () => {
    const request = {
      name: 'get_contract_info',
      arguments: {
        contractName: 'NeoFS',
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('name', 'NeoFS');
    expect(response.result).toHaveProperty('description');
  });
  
  test('should handle invoke_read_contract tool request', async () => {
    const request = {
      name: 'invoke_read_contract',
      arguments: {
        contractName: 'NeoFS',
        operation: 'getContainerInfo',
        args: ['containerId'],
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('result', 'success');
  });
  
  test('should handle invoke_write_contract tool request', async () => {
    const request = {
      name: 'invoke_write_contract',
      arguments: {
        fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
        contractName: 'NeoFS',
        operation: 'createContainer',
        args: ['ownerId', []],
        confirm: true,
      },
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('result');
    expect(response.result).toHaveProperty('txid', '0x1234567890abcdef');
  });
  
  test('should handle invalid tool name', async () => {
    const request = {
      name: 'invalid_tool',
      arguments: {},
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code', ErrorCode.InvalidRequest);
    expect(response.error).toHaveProperty('message');
    expect(response.error.message).toContain('Invalid tool name');
  });
  
  test('should handle missing required arguments', async () => {
    const request = {
      name: 'get_transaction',
      arguments: {},
    };
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    expect(response.error).toHaveProperty('message');
    expect(response.error.message).toContain('Missing required parameter');
  });
  
  test('should handle invalid arguments', async () => {
    const request = {
      name: 'get_balance',
      arguments: {
        address: 'invalid-address',
      },
    };
    
    // Mock validation error
    const mockNeoService = new NeoService('');
    mockNeoService.getBalance = jest.fn().mockImplementation(() => {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid address format');
    });
    
    // @ts-ignore - Replace the mocked instance
    NeoService.mockImplementation(() => mockNeoService);
    
    const response = await handleMcpRequest(request);
    
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    expect(response.error).toHaveProperty('message');
    expect(response.error.message).toContain('Invalid address format');
  });
});
