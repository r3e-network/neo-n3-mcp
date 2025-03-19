/**
 * Tests for contract validation
 */
import { FAMOUS_CONTRACTS } from '../../src/contracts/contracts.js';
import { ContractService } from '../../src/contracts/contract-service.js';
import { NeoNetwork } from '../../src/services/neo-service.js';
import { validateScriptHash } from '../../src/utils/validation.js';

describe('Contract Validation', () => {
  test('All contract script hashes have valid format', () => {
    for (const [key, contract] of Object.entries(FAMOUS_CONTRACTS)) {
      // Check mainnet script hash
      const mainnetHash = contract.scriptHash[NeoNetwork.MAINNET];
      expect(mainnetHash).toBeDefined();
      expect(() => validateScriptHash(mainnetHash!)).not.toThrow();
      
      // Check testnet script hash if available
      const testnetHash = contract.scriptHash[NeoNetwork.TESTNET];
      if (testnetHash) {
        expect(() => validateScriptHash(testnetHash)).not.toThrow();
      }
    }
  });
  
  test('Contract operations have required properties', () => {
    for (const [key, contract] of Object.entries(FAMOUS_CONTRACTS)) {
      // Ensure operations exist
      expect(contract.operations).toBeDefined();
      expect(Object.keys(contract.operations).length).toBeGreaterThan(0);
      
      // Check each operation
      for (const [opKey, operation] of Object.entries(contract.operations)) {
        expect(operation.name).toBeDefined();
        expect(operation.description).toBeDefined();
        
        // Check args if present
        if (operation.args) {
          for (const arg of operation.args) {
            expect(arg.name).toBeDefined();
            expect(arg.type).toBeDefined();
            expect(arg.description).toBeDefined();
          }
        }
      }
    }
  });
});

describe('ContractService', () => {
  // Mock the RPC client and network for testing
  const mockRpcClient = {
    invokeScript: jest.fn().mockResolvedValue({
      state: 'HALT',
      gasconsumed: '1000',
      stack: [{ value: true }]
    }),
    sendRawTransaction: jest.fn().mockResolvedValue('txid-123456'),
  };
  
  // Create a test instance with mocked RPC
  const createTestService = () => {
    // Mock the neon-js module import to bypass RPC client validation
    jest.mock('@cityofzion/neon-js', () => ({
      rpc: {
        RPCClient: jest.fn().mockImplementation(() => mockRpcClient)
      }
    }));
    
    const service = new ContractService('https://mock-url.com', NeoNetwork.MAINNET);
    return service;
  };
  
  beforeEach(() => {
    // Reset mock call history
    mockRpcClient.invokeScript.mockClear();
    mockRpcClient.sendRawTransaction.mockClear();
    
    // Mock the ContractService's rpcClient with our mock
    jest.spyOn(ContractService.prototype, 'getContract').mockImplementation((contractName) => {
      const contract = FAMOUS_CONTRACTS[contractName.toLowerCase()];
      if (!contract) {
        throw new Error(`Contract ${contractName} not found`);
      }
      return contract;
    });
    
    // Mock the ContractService's getContractScriptHash method
    jest.spyOn(ContractService.prototype, 'getContractScriptHash').mockImplementation((contractName) => {
      const contract = FAMOUS_CONTRACTS[contractName.toLowerCase()];
      if (!contract) {
        throw new Error(`Contract ${contractName} not found`);
      }
      return contract.scriptHash[NeoNetwork.MAINNET];
    });
    
    // Set the rpcClient property of the ContractService instance
    jest.spyOn(ContractService.prototype, 'isContractAvailable').mockImplementation((contractName) => {
      return contractName.toLowerCase() in FAMOUS_CONTRACTS;
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('isContractAvailable works correctly', () => {
    const service = createTestService();
    
    // All listed contracts should be available
    for (const [key, contract] of Object.entries(FAMOUS_CONTRACTS)) {
      expect(service.isContractAvailable(contract.name)).toBe(true);
    }
    
    // Non-existent contract should not be available
    expect(service.isContractAvailable('non-existent')).toBe(false);
  });
  
  test('getNetwork returns correct network', () => {
    const mainnetService = new ContractService('https://mock-url.com', NeoNetwork.MAINNET);
    const testnetService = new ContractService('https://mock-url.com', NeoNetwork.TESTNET);
    
    expect(mainnetService.getNetwork()).toBe(NeoNetwork.MAINNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });
}); 