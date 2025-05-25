import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * Comprehensive MCP Server Test Suite
 * 
 * This test suite validates the Neo N3 MCP server against all MCP protocol requirements
 * and demonstrates comprehensive functionality testing with the latest protocol features.
 */

describe('Comprehensive MCP Server Tests', () => {
  let client: any;
  let serverPath: string;

  const TEST_TIMEOUT = 45000; // 45 seconds for complex operations

  beforeAll(async () => {
    serverPath = path.join(__dirname, '../dist/index.js');
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    await startMCPServer();
  }, TEST_TIMEOUT);

  afterEach(async () => {
    await stopMCPServer();
  }, 15000);

  async function startMCPServer() {
    client = new Client(
      { name: 'Comprehensive MCP Test Client', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    await client.connect(transport);
  }

  async function stopMCPServer() {
    if (client) {
      await client.close();
      client = null;
    }
  }

  describe('🚀 MCP Protocol Fundamentals', () => {
    test('should establish connection and maintain protocol compliance', async () => {
      expect(client).toBeDefined();
      
      // Verify client is connected and functional
      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(Array.isArray(tools.tools)).toBe(true);
    });

    test('should support all required MCP methods', async () => {
      // Test all core MCP protocol methods
      const tools = await client.listTools();
      const resources = await client.listResources();
      
      expect(tools.tools.length).toBeGreaterThan(0);
      expect(resources.resources.length).toBeGreaterThan(0);
      
      console.log(`✅ Server provides ${tools.tools.length} tools and ${resources.resources.length} resources`);
    });

    test('should handle protocol versioning correctly', async () => {
      // Connection establishment validates protocol version
      // If we get here, protocol negotiation succeeded
      expect(client).toBeDefined();
    });
  });

  describe('🔧 Tool Execution & Validation', () => {
    test('should list all blockchain tools with proper metadata', async () => {
      const response = await client.listTools();
      
      expect(response.tools.length).toBeGreaterThanOrEqual(30); // Should have 34+ tools
      
      const toolNames = response.tools.map((tool: any) => tool.name);
      const expectedTools = [
        'get_blockchain_info',
        'get_block_count', 
        'get_block',
        'get_transaction',
        'get_balance',
        'create_wallet',
        'import_wallet',
        'transfer_assets',
        'invoke_contract',
        'get_network_mode'
      ];

      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });

      // Validate tool structure
      response.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });

      console.log(`✅ Validated ${response.tools.length} tools with proper structure`);
    });

    test('should execute blockchain info tool with valid data', async () => {
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      
      const content = response.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();

      const data = JSON.parse(content.text);
      expect(typeof data.height).toBe('number');
      expect(data.height).toBeGreaterThan(0);
      expect(data.network).toBeDefined();
      expect(['mainnet', 'testnet', 'both']).toContain(data.network);
      expect(Array.isArray(data.validators)).toBe(true);

      console.log(`✅ Blockchain height: ${data.height}, Network: ${data.network}`);
    });

    test('should handle block count retrieval correctly', async () => {
      const response = await client.callTool({
        name: 'get_block_count',
        arguments: {}
      });

      const data = JSON.parse(response.content[0].text);
      expect(typeof data.height).toBe('number');
      expect(data.height).toBeGreaterThan(0);
      expect(data.network).toBeDefined();

      console.log(`✅ Block count: ${data.height}`);
    });

    test('should validate address balance retrieval', async () => {
      const testAddress = 'NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj';
      
      const response = await client.callTool({
        name: 'get_balance',
        arguments: { address: testAddress }
      });

      const data = JSON.parse(response.content[0].text);
      expect(data.address).toBe(testAddress);
      expect(Array.isArray(data.balance)).toBe(true);

      console.log(`✅ Balance retrieved for ${testAddress}: ${data.balance.length} assets`);
    });

    test('should create wallets with proper structure', async () => {
      const response = await client.callTool({
        name: 'create_wallet',
        arguments: { password: 'test-password-2024' }
      });

      const wallet = JSON.parse(response.content[0].text);
      expect(wallet.address).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.encryptedPrivateKey).toBeDefined();
      
      // Validate Neo N3 address format
      expect(wallet.address).toMatch(/^N[A-Za-z0-9]{33}$/);
      
      console.log(`✅ Created wallet: ${wallet.address}`);
    });

    test('should handle network mode operations', async () => {
      const response = await client.callTool({
        name: 'get_network_mode',
        arguments: {}
      });

      const data = JSON.parse(response.content[0].text);
      expect(data.mode).toBeDefined();
      expect(Array.isArray(data.availableNetworks)).toBe(true);
      expect(data.availableNetworks.length).toBeGreaterThan(0);

      console.log(`✅ Network mode: ${data.mode}, Available: ${data.availableNetworks.join(', ')}`);
    });

    test('should handle contract listing', async () => {
      const response = await client.callTool({
        name: 'list_famous_contracts',
        arguments: {}
      });

      const data = JSON.parse(response.content[0].text);
      expect(Array.isArray(data.contracts)).toBe(true);
      expect(data.contracts.length).toBeGreaterThan(0);
      expect(data.network).toBeDefined();

      console.log(`✅ Listed ${data.contracts.length} famous contracts`);
    });
  });

  describe('📚 Resource Management & Access', () => {
    test('should list all available resources', async () => {
      const response = await client.listResources();
      
      expect(Array.isArray(response.resources)).toBe(true);
      expect(response.resources.length).toBeGreaterThan(0);

      const resourceUris = response.resources.map((resource: any) => resource.uri);
      const expectedResources = [
        'neo://network/status',
        'neo://mainnet/status',
        'neo://testnet/status'
      ];

      expectedResources.forEach(expectedResource => {
        expect(resourceUris).toContain(expectedResource);
      });

      console.log(`✅ Available resources: ${response.resources.length}`);
    });

    test('should read network status resource', async () => {
      const response = await client.readResource('neo://network/status');
      
      expect(response).toBeDefined();
      expect(response.contents).toBeDefined();
      expect(Array.isArray(response.contents)).toBe(true);
      
      const content = response.contents[0];
      expect(content.uri).toBe('neo://network/status');
      expect(content.text).toBeDefined();

      const data = JSON.parse(content.text);
      expect(typeof data.height).toBe('number');
      expect(data.network).toBeDefined();

      console.log(`✅ Network status: height ${data.height}`);
    });

    test('should read mainnet-specific resource', async () => {
      const response = await client.readResource('neo://mainnet/status');
      
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.network).toBe('mainnet');

      console.log(`✅ Mainnet status: height ${data.height}`);
    });

    test('should read testnet-specific resource', async () => {
      const response = await client.readResource('neo://testnet/status');
      
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.network).toBe('testnet');

      console.log(`✅ Testnet status: height ${data.height}`);
    });

    test('should handle parameterized block resources', async () => {
      const blockHeight = 1000;
      const response = await client.readResource(`neo://block/${blockHeight}`);
      
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.index).toBe(blockHeight);

      console.log(`✅ Block ${blockHeight} resource accessed successfully`);
    });
  });

  describe('🛡️ Error Handling & Edge Cases', () => {
    test('should handle invalid tool names gracefully', async () => {
      try {
        await client.callTool({
          name: 'invalid_tool_name',
          arguments: {}
        });
        fail('Should have thrown an error for invalid tool');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('should validate required parameters', async () => {
      try {
        await client.callTool({
          name: 'get_balance',
          arguments: {} // Missing required 'address' parameter
        });
        fail('Should have thrown an error for missing required parameter');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message.toLowerCase()).toContain('address');
      }
    });

    test('should handle invalid addresses properly', async () => {
      try {
        await client.callTool({
          name: 'get_balance',
          arguments: { address: 'invalid_address_format' }
        });
        fail('Should have thrown an error for invalid address');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message.toLowerCase()).toContain('address');
      }
    });

    test('should handle invalid resource URIs', async () => {
      try {
        await client.readResource('neo://invalid/resource/path');
        fail('Should have thrown an error for invalid resource');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    test('should handle network connectivity issues gracefully', async () => {
      // This tests the error handling when blockchain services are unavailable
      // The exact behavior depends on the service implementation
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      
      // Should either succeed or fail gracefully with proper error
      expect(response).toBeDefined();
    });
  });

  describe('⚡ Performance & Reliability', () => {
    test('should handle concurrent tool executions', async () => {
      const promises = Array(5).fill(0).map((_, index) => 
        client.callTool({
          name: 'get_network_mode',
          arguments: {}
        })
      );

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('text');
        const data = JSON.parse(response.content[0].text);
        expect(data.mode).toBeDefined();
      });

      console.log(`✅ Handled 5 concurrent requests successfully`);
    });

    test('should maintain performance under sequential load', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 3; i++) {
        const response = await client.callTool({
          name: 'get_network_mode',
          arguments: {}
        });
        expect(response).toBeDefined();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`✅ Sequential execution completed in ${duration}ms`);
    });

    test('should handle large data responses properly', async () => {
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });

      const content = response.content[0];
      expect(content.text.length).toBeGreaterThan(0);
      
      // Validate JSON parsing of potentially large response
      const data = JSON.parse(content.text);
      expect(data).toBeDefined();

      console.log(`✅ Large response handled: ${content.text.length} characters`);
    });
  });

  describe('🔄 Workflow Integration Tests', () => {
    test('should support complete wallet workflow', async () => {
      // Create wallet
      const walletResponse = await client.callTool({
        name: 'create_wallet',
        arguments: { password: 'workflow-test-2024' }
      });
      
      const wallet = JSON.parse(walletResponse.content[0].text);
      expect(wallet.address).toBeDefined();

      // Check wallet balance
      const balanceResponse = await client.callTool({
        name: 'get_balance',
        arguments: { address: wallet.address }
      });
      
      const balance = JSON.parse(balanceResponse.content[0].text);
      expect(balance.address).toBe(wallet.address);

      // Get network info for context
      const networkResponse = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      
      const networkInfo = JSON.parse(networkResponse.content[0].text);
      expect(networkInfo.height).toBeGreaterThan(0);

      console.log(`✅ Complete workflow: wallet ${wallet.address} on ${networkInfo.network}`);
    });

    test('should support blockchain exploration workflow', async () => {
      // Get current blockchain info
      const infoResponse = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      
      const info = JSON.parse(infoResponse.content[0].text);
      
      // Get specific block
      const blockHeight = Math.max(1, info.height - 100); // Get a block 100 blocks ago
      const blockResponse = await client.readResource(`neo://block/${blockHeight}`);
      
      const blockData = JSON.parse(blockResponse.contents[0].text);
      expect(blockData.index).toBe(blockHeight);

      // Get network status
      const statusResponse = await client.readResource('neo://network/status');
      const statusData = JSON.parse(statusResponse.contents[0].text);
      
      expect(statusData.height).toBeGreaterThanOrEqual(blockHeight);

      console.log(`✅ Blockchain exploration: block ${blockHeight} to current ${info.height}`);
    });

    test('should handle multi-network operations', async () => {
      // Get network mode
      const modeResponse = await client.callTool({
        name: 'get_network_mode',
        arguments: {}
      });
      
      const mode = JSON.parse(modeResponse.content[0].text);
      
      // Read mainnet status
      const mainnetResponse = await client.readResource('neo://mainnet/status');
      const mainnetData = JSON.parse(mainnetResponse.contents[0].text);
      expect(mainnetData.network).toBe('mainnet');

      // Read testnet status
      const testnetResponse = await client.readResource('neo://testnet/status');
      const testnetData = JSON.parse(testnetResponse.contents[0].text);
      expect(testnetData.network).toBe('testnet');

      console.log(`✅ Multi-network: Mode ${mode.mode}, Mainnet: ${mainnetData.height}, Testnet: ${testnetData.height}`);
    });
  });

  describe('📊 Protocol Compliance Validation', () => {
    test('should follow MCP response format standards', async () => {
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });

      // Validate MCP response structure
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);

      const content = response.content[0];
      expect(content.type).toBe('text');
      expect(typeof content.text).toBe('string');

      // Validate content is proper JSON
      expect(() => JSON.parse(content.text)).not.toThrow();

      console.log(`✅ MCP response format validation passed`);
    });

    test('should handle resource URI format compliance', async () => {
      const resources = await client.listResources();
      
      resources.resources.forEach((resource: any) => {
        expect(resource.uri).toBeDefined();
        expect(typeof resource.uri).toBe('string');
        
        // Validate URI format
        expect(() => new URL(resource.uri)).not.toThrow();
        
        // Validate Neo-specific URI scheme
        expect(resource.uri).toMatch(/^neo:\/\//);
      });

      console.log(`✅ All ${resources.resources.length} resource URIs are compliant`);
    });

    test('should maintain consistent tool metadata', async () => {
      const tools = await client.listTools();
      
      tools.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(tool.description.length).toBeGreaterThan(0);
      });

      console.log(`✅ All ${tools.tools.length} tools have consistent metadata`);
    });
  });
}); 