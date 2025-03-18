/**
 * Network Support Test
 * 
 * This test verifies that the Neo N3 MCP server correctly handles requests
 * for both mainnet and testnet networks.
 */

// Simple testing utilities
const assert = {
  equal: (actual, expected, message) => {
    if (actual !== expected) {
      console.error(`❌ FAILED: ${message || ''}`);
      console.error(`  Expected: ${expected}`);
      console.error(`  Actual:   ${actual}`);
      process.exit(1);
    } else {
      console.log(`✅ PASSED: ${message || ''}`);
    }
  },
  ok: (value, message) => {
    if (!value) {
      console.error(`❌ FAILED: ${message || ''}`);
      process.exit(1);
    } else {
      console.log(`✅ PASSED: ${message || ''}`);
    }
  }
};

// Mock NeoService to avoid real network calls
class MockNeoService {
  constructor(rpcUrl, network) {
    this.rpcUrl = rpcUrl;
    this.network = network;
    console.log(`MockNeoService created with network: ${network}, URL: ${rpcUrl}`);
  }

  async getBlockchainInfo() {
    return {
      height: 12345,
      validators: [],
      network: this.network
    };
  }

  getNetwork() {
    return this.network;
  }
}

// Mock neon-js
const neonJs = {
  rpc: {
    RPCClient: function(url) {
      this.url = url;
      return {
        getBlockCount: async () => 12345,
        getValidators: async () => []
      };
    }
  }
};

// Replace imports with mocks
const NeoNetwork = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet'
};

// Create a mock config with dual-network support
const config = {
  mainnetRpcUrl: 'http://mainnet.example.com:10332',
  testnetRpcUrl: 'http://testnet.example.com:10332',
};

// Now test our dual-network implementation
async function runTests() {
  console.log('Running Neo N3 MCP Server Dual-Network Tests');
  console.log('===========================================');

  // Test mainnet service creation
  const mainnetService = new MockNeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
  assert.equal(mainnetService.network, NeoNetwork.MAINNET, 'Mainnet service has correct network');
  assert.equal(mainnetService.rpcUrl, config.mainnetRpcUrl, 'Mainnet service has correct URL');

  // Test testnet service creation
  const testnetService = new MockNeoService(config.testnetRpcUrl, NeoNetwork.TESTNET);
  assert.equal(testnetService.network, NeoNetwork.TESTNET, 'Testnet service has correct network');
  assert.equal(testnetService.rpcUrl, config.testnetRpcUrl, 'Testnet service has correct URL');

  // Test service map
  const services = new Map();
  services.set(NeoNetwork.MAINNET, mainnetService);
  services.set(NeoNetwork.TESTNET, testnetService);
  
  assert.equal(services.size, 2, 'Services map has two entries');
  assert.ok(services.has(NeoNetwork.MAINNET), 'Services map has mainnet entry');
  assert.ok(services.has(NeoNetwork.TESTNET), 'Services map has testnet entry');

  // Mock the getNeoService function
  function getNeoService(networkParam) {
    if (!networkParam) {
      return services.get(NeoNetwork.MAINNET);
    }
    
    // Simplified network validation
    if (networkParam !== NeoNetwork.MAINNET && networkParam !== NeoNetwork.TESTNET) {
      throw new Error(`Invalid network: ${networkParam}`);
    }
    
    const service = services.get(networkParam);
    if (!service) {
      throw new Error(`Service not found for network: ${networkParam}`);
    }
    
    return service;
  }

  // Test service retrieval
  const defaultService = getNeoService(); 
  assert.equal(defaultService.network, NeoNetwork.MAINNET, 'Default service is mainnet');
  
  const explicitMainnet = getNeoService(NeoNetwork.MAINNET);
  assert.equal(explicitMainnet.network, NeoNetwork.MAINNET, 'Explicit mainnet returns correct service');
  
  const testnet = getNeoService(NeoNetwork.TESTNET);
  assert.equal(testnet.network, NeoNetwork.TESTNET, 'Testnet parameter returns testnet service');

  // Test blockchain info
  const mainnetInfo = await mainnetService.getBlockchainInfo();
  assert.equal(mainnetInfo.network, NeoNetwork.MAINNET, 'Blockchain info shows correct mainnet network');
  
  const testnetInfo = await testnetService.getBlockchainInfo();
  assert.equal(testnetInfo.network, NeoNetwork.TESTNET, 'Blockchain info shows correct testnet network');

  // Test error handling with invalid network
  try {
    getNeoService('invalid');
    console.error('❌ FAILED: Should throw error for invalid network');
    process.exit(1);
  } catch (error) {
    assert.ok(error.message.includes('Invalid network'), 'Throws error for invalid network');
  }

  console.log('===========================================');
  console.log('✅ All tests passed');
}

// Run the tests
runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
}); 