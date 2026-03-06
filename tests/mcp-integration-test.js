/**
 * Neo N3 MCP Server Integration Test
 *
 * This test demonstrates the working of the Neo N3 MCP server by simulating a client
 * that connects to the server and uses its capabilities.
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

class McpIntegrationTest {
  constructor() {
    this.client = null;
    this.transport = null;
    this.callTimeoutMs = 30000;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async withTimeout(promise, name) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${this.callTimeoutMs}ms`)), this.callTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Start the server and connect to it
   */
  async startServer() {
    console.log('Starting Neo N3 MCP server...');

    // Create a client
    this.client = new Client(
      { name: 'Neo N3 MCP Integration Test', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    // Create a transport that connects to the server
    const serverPath = path.join(__dirname, '../dist/index.js');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NEO_NETWORK_MODE: 'mainnet_only'
      }
    });

    this.transport = transport;

    // Connect to the server
    console.log('Connecting to server...');
    await this.client.connect(transport);

    console.log('Connection established successfully');
  }

  /**
   * Stop the server and disconnect
   */
  async stopServer() {
    if (this.client) {
      console.log('Closing client connection...');
      await this.client.close();
      this.client = null;
    }

    if (this.transport && typeof this.transport.close === 'function') {
      await this.transport.close();
      this.transport = null;
    }
  }

  /**
   * Record a test result
   */
  recordResult(testName, passed, details = null) {
    this.results.tests.push({
      name: testName,
      passed,
      details
    });

    if (passed) {
      this.results.passed++;
      console.log(`✅ ${testName}`);
    } else {
      this.results.failed++;
      console.error(`❌ ${testName}`);
      if (details) {
        console.error('   Details:', details);
      }
    }
  }

  /**
   * Test listing tools
   */
  async testListTools() {
    try {
      const result = await this.withTimeout(this.client.listTools(), 'listTools');

      // Verify that tools were returned
      if (!result || !Array.isArray(result.tools)) {
        throw new Error('Invalid tools response');
      }

      // Verify that at least some tools are available
      if (result.tools.length === 0) {
        throw new Error('No tools available');
      }

      console.log(`   Found ${result.tools.length} tools`);

      // Log the first few tools
      result.tools.slice(0, 3).forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });

      this.recordResult('List Tools', true, { toolCount: result.tools.length });
      return result.tools;
    } catch (error) {
      this.recordResult('List Tools', false, { error: error.message });
      return [];
    }
  }

  /**
   * Test listing resources
   */
  async testListResources() {
    try {
      const result = await this.withTimeout(this.client.listResources(), 'listResources');

      // Verify that resources were returned
      if (!result || !Array.isArray(result.resources)) {
        throw new Error('Invalid resources response');
      }

      console.log(`   Found ${result.resources.length} resources`);

      const resourceUris = result.resources.map(resource => resource.uri);
      if (process.env.NEO_NETWORK_MODE === 'mainnet_only' && resourceUris.includes('neo://testnet/status')) {
        throw new Error('Testnet resource should not be advertised in mainnet-only mode');
      }

      // Log the first few resources
      result.resources.slice(0, 3).forEach(resource => {
        console.log(`   - ${resource.name}: ${resource.description}`);
      });

      this.recordResult('List Resources', true, { resourceCount: result.resources.length });
      return result.resources;
    } catch (error) {
      this.recordResult('List Resources', false, { error: error.message });
      return [];
    }
  }

  /**
   * Test getting blockchain info
   */
  async testGetBlockchainInfo() {
    try {
      const result = await this.withTimeout(
        this.client.callTool({ name: 'get_blockchain_info', arguments: {} }),
        'get_blockchain_info'
      );

      // Verify that blockchain info was returned
      if (!result || !result.content || !result.content[0] || !result.content[0].text) {
        throw new Error('Invalid blockchain info response');
      }

      // Parse the JSON response
      const blockchainInfo = JSON.parse(result.content[0].text);

      // Verify that the response contains expected fields
      if (typeof blockchainInfo.height !== 'number') {
        throw new Error('Invalid blockchain height');
      }

      console.log(`   Blockchain height: ${blockchainInfo.height}`);
      console.log(`   Network: ${blockchainInfo.network}`);

      this.recordResult('Get Blockchain Info', true, { height: blockchainInfo.height, network: blockchainInfo.network });
      return blockchainInfo;
    } catch (error) {
      this.recordResult('Get Blockchain Info', false, { error: error.message });
      return null;
    }
  }

  /**
   * Test getting block count
   */
  async testGetBlockCount() {
    try {
      const result = await this.withTimeout(
        this.client.callTool({ name: 'get_block_count', arguments: {} }),
        'get_block_count'
      );

      // Verify that block count was returned
      if (!result || !result.content || !result.content[0] || !result.content[0].text) {
        throw new Error('Invalid block count response');
      }

      // Parse the JSON response
      const blockCountResponse = JSON.parse(result.content[0].text);

      // Verify that the response contains expected fields
      if (typeof blockCountResponse.height !== 'number') {
        throw new Error('Invalid block count');
      }

      console.log(`   Block count: ${blockCountResponse.height}`);

      this.recordResult('Get Block Count', true, { height: blockCountResponse.height });
      return blockCountResponse.height;
    } catch (error) {
      this.recordResult('Get Block Count', false, { error: error.message });
      return null;
    }
  }

  /**
   * Test getting balance
   */
  async testGetBalance() {
    try {
      // Use a known testnet address
      const testAddress = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';

      const result = await this.withTimeout(
        this.client.callTool({ name: 'get_balance', arguments: { address: testAddress } }),
        'get_balance'
      );

      // Verify that balance was returned
      if (!result || !result.content || !result.content[0] || !result.content[0].text) {
        throw new Error('Invalid balance response');
      }

      // Parse the JSON response
      const balanceResponse = JSON.parse(result.content[0].text);

      // Verify that the response contains expected fields
      if (!balanceResponse.address || !Array.isArray(balanceResponse.balance)) {
        throw new Error('Invalid balance format');
      }

      console.log(`   Address: ${balanceResponse.address}`);
      console.log(`   Assets: ${balanceResponse.balance.length}`);

      this.recordResult('Get Balance', true, {
        address: balanceResponse.address,
        assetCount: balanceResponse.balance.length
      });
      return balanceResponse;
    } catch (error) {
      this.recordResult('Get Balance', false, { error: error.message });
      return null;
    }
  }

  /**
   * Test creating a wallet
   */
  async testCreateWallet() {
    try {
      const result = await this.withTimeout(
        this.client.callTool({ name: 'create_wallet', arguments: { password: 'test12345' } }),
        'create_wallet'
      );

      // Verify that wallet was created
      if (!result || !result.content || !result.content[0] || !result.content[0].text) {
        throw new Error('Invalid wallet creation response');
      }

      // Parse the JSON response
      const walletResponse = JSON.parse(result.content[0].text);

      // Verify that the response contains expected fields
      if (!walletResponse.address || !walletResponse.publicKey || !walletResponse.encryptedPrivateKey) {
        throw new Error('Invalid wallet format');
      }

      console.log(`   Created wallet with address: ${walletResponse.address}`);

      this.recordResult('Create Wallet', true, { address: walletResponse.address });
      return walletResponse;
    } catch (error) {
      this.recordResult('Create Wallet', false, { error: error.message });
      return null;
    }
  }

  /**
   * Test getting network mode
   */
  async testGetNetworkMode() {
    try {
      const result = await this.withTimeout(
        this.client.callTool({ name: 'get_network_mode', arguments: {} }),
        'get_network_mode'
      );

      // Verify that network mode was returned
      if (!result || !result.content || !result.content[0] || !result.content[0].text) {
        throw new Error('Invalid network mode response');
      }

      // Parse the JSON response
      const networkModeResponse = JSON.parse(result.content[0].text);

      // Verify that the response contains expected fields
      if (!networkModeResponse.mode) {
        throw new Error('Invalid network mode format');
      }

      console.log(`   Network mode: ${networkModeResponse.mode}`);

      this.recordResult('Get Network Mode', true, { mode: networkModeResponse.mode });
      return networkModeResponse.mode;
    } catch (error) {
      this.recordResult('Get Network Mode', false, { error: error.message });
      return null;
    }
  }

  /**
   * Test reading a network status resource
   */
  async testReadNetworkStatusResource() {
    try {
      const result = await this.withTimeout(
        this.client.readResource({ uri: 'neo://network/status' }),
        'readResource neo://network/status'
      );

      // Verify that resource was returned
      if (!result || !result.contents || !result.contents[0] || !result.contents[0].text) {
        throw new Error('Invalid resource response');
      }

      // Parse the JSON response
      const statusResponse = JSON.parse(result.contents[0].text);

      // Verify that the response contains expected fields
      if (typeof statusResponse.height !== 'number') {
        throw new Error('Invalid network status format');
      }

      console.log(`   Network status height: ${statusResponse.height}`);

      this.recordResult('Read Network Status Resource', true, { height: statusResponse.height });
      return statusResponse;
    } catch (error) {
      this.recordResult('Read Network Status Resource', false, { error: error.message });
      return null;
    }
  }

  /**
   * Run all tests
   */
  async runTests() {
    console.log('=== Neo N3 MCP Integration Test ===\n');

    try {
      // Start the server and connect
      await this.startServer();

      // Run tests
      await this.testListTools();
      await this.testListResources();
      await this.testGetBlockchainInfo();
      await this.testGetBlockCount();
      await this.testGetBalance();
      await this.testCreateWallet();
      await this.testGetNetworkMode();
      await this.testReadNetworkStatusResource();

      // Print summary
      this.printSummary();
    } catch (error) {
      this.results.failed += 1;
      console.error('Test execution failed:', error);
    } finally {
      // Stop the server
      await this.stopServer();
      process.exit(this.results.failed > 0 ? 1 : 0);
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log('===================');

    if (this.results.failed > 0) {
      console.log('\n❌ Some tests failed. Please check the logs above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
    }
  }
}

// Run the tests
const test = new McpIntegrationTest();
test.runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
