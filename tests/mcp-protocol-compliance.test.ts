import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import * as neonJs from '@cityofzion/neon-js';
import { startMcpTestClient, stopMcpTestClient } from './mcp-test-utils';

const packageVersion = require('../package.json').version as string;

/**
 * MCP Protocol Compliance Test Suite
 * 
 * Tests the Neo N3 MCP server against the latest protocol specification (2025-03-26)
 * Validates all MCP protocol methods, error handling, and compliance requirements.
 */

describe('MCP Protocol Compliance Tests', () => {
  let client: Client | null;
  let transport: StdioClientTransport | null = null;
  let serverPath: string;

  const LATEST_PROTOCOL_VERSION = '2025-03-26';
  const TEST_TIMEOUT = 30000; // 30 seconds

  beforeAll(async () => {
    serverPath = path.join(__dirname, '../dist/index.js');
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Start fresh server for each test
    await startServer();
  }, TEST_TIMEOUT);

  afterEach(async () => {
    await stopServer();
  }, 10000);

  async function startServer() {
    try {
      const session = await startMcpTestClient({
        serverPath,
        env: {
          ...process.env,
          NODE_ENV: 'test'
        },
        clientInfo: {
          name: 'MCP Protocol Compliance Test Client',
          version: '1.0.0'
        },
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          experimental: {
            completions: {}
          }
        }
      });

      client = session.client;
      transport = session.transport;
    } catch (error) {
      throw new Error(`Failed to connect to MCP server: ${error}`);
    }
  }

  async function stopServer() {
    await stopMcpTestClient(client, transport);
    client = null;
    transport = null;
  }

  describe('Protocol Initialization', () => {
    test('should support latest protocol version', async () => {
      // The connection already validates protocol version during initialization
      expect(client).toBeDefined();
    });

    test('should return valid server info', async () => {
      // Server info is available after initialization
      const serverInfo = client.getServerVersion();
      
      expect(serverInfo).toBeDefined();
      expect(serverInfo.name).toBe('neo-n3-mcp-server');
      expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(serverInfo.version).toBe(packageVersion);
    });

    test('should declare expected capabilities', async () => {
      const serverCapabilities = client.getServerCapabilities();
      
      expect(serverCapabilities).toBeDefined();
      expect(serverCapabilities.tools).toBeDefined();
      expect(serverCapabilities.resources).toBeDefined();
      
      // Test optional capabilities
      if (serverCapabilities.prompts) {
        expect(typeof serverCapabilities.prompts).toBe('object');
      }
    });
  });

  describe('Tools Protocol Compliance', () => {
    test('should list all available tools', async () => {
      const response = await client.listTools();
      
      expect(response).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(0);
      
      // Validate tool structure according to latest protocol
      response.tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toEqual(expect.any(String));
        expect(tool.description.trim().length).toBeGreaterThan(0);
        
        
        if (tool.inputSchema) {
          expect(typeof tool.inputSchema).toBe('object');
        }
        
        // Test tool annotations (new in latest protocol)
        if (tool.annotations) {
          expect(typeof tool.annotations).toBe('object');
          if (tool.annotations.audience) {
            expect(['user', 'assistant']).toContain(tool.annotations.audience);
          }
          if (tool.annotations.level) {
            expect(['info', 'warning', 'danger']).toContain(tool.annotations.level);
          }
        }
      });
    });

    test('should execute blockchain info tool correctly', async () => {
      const response = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      
      const content = response.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      
      // Validate JSON structure
      const data = JSON.parse(content.text);
      expect(typeof data.height).toBe('number');
      expect(data.height).toBeGreaterThan(0);
      expect(data.network).toBeDefined();
      expect(Array.isArray(data.validators)).toBe(true);
    });

    test('should execute tools with parameters correctly', async () => {
      const testAddress = 'NZNos2WqTbu5oCgyfss9kUJgBXJqhuYAaj';
      const response = await client.callTool({ name: 'get_balance', arguments: { address: testAddress } });
      
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const data = JSON.parse(response.content[0].text);
      expect(data.address).toBe(testAddress);
      expect(Array.isArray(data.balance)).toBe(true);
    });

    test('should handle tool errors gracefully', async () => {
      const response = await client.callTool({ name: 'get_balance', arguments: { address: 'invalid_address' } });
      expect(response.isError).toBe(true);
      expect(response.content).toBeDefined();
    });

    test('should import wallet with supported MCP arguments', async () => {
      const account = new neonJs.wallet.Account();
      const response = await client.callTool({
        name: 'import_wallet',
        arguments: { privateKeyOrWIF: account.WIF, password: 'password123' }
      });

      expect(response.isError).not.toBe(true);
      const wallet = JSON.parse(response.content[0].text);
      expect(wallet.address).toBe(account.address);
    });

    test('should validate wallet creation tool', async () => {
      const response = await client.callTool({ name: 'create_wallet', arguments: { password: 'password123' } });
      
      expect(response).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const wallet = JSON.parse(response.content[0].text);
      expect(wallet.address).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.encryptedPrivateKey).toBeDefined();
      expect(wallet.address).toMatch(/^N[A-Za-z0-9]{33}$/); // Neo N3 address format
    });

    test('should allow setting the combined network mode', async () => {
      const response = await client.callTool({
        name: 'set_network_mode',
        arguments: { mode: 'both' }
      });

      expect(response.isError).not.toBe(true);
      expect(response.content[0].text).toContain('both');

      const networkModeResponse = await client.callTool({ name: 'get_network_mode', arguments: {} });
      const networkMode = JSON.parse(networkModeResponse.content[0].text);
      expect(networkMode.mode).toBe('both');
      expect(networkMode.availableNetworks).toEqual(expect.arrayContaining(['mainnet', 'testnet']));
    });

    test('should handle network switching tools', async () => {
      const response = await client.callTool({ name: 'get_network_mode', arguments: {} });
      
      expect(response).toBeDefined();
      const data = JSON.parse(response.content[0].text);
      expect(data.mode).toBeDefined();
      expect(Array.isArray(data.availableNetworks)).toBe(true);
      expect(data.availableNetworks.length).toBeGreaterThan(0);
    });
  });

  describe('Resources Protocol Compliance', () => {
    test('should list all available resources', async () => {
      const response = await client.listResources();
      
      expect(response).toBeDefined();
      expect(Array.isArray(response.resources)).toBe(true);
      expect(response.resources.length).toBeGreaterThan(0);
      
      // Validate resource structure
      response.resources.forEach(resource => {
        expect(resource.uri).toBeDefined();
        expect(typeof resource.uri).toBe('string');
        expect(resource.description).toEqual(expect.any(String));
        expect(resource.description.trim().length).toBeGreaterThan(0);
        
        
        // Validate URI format
        expect(() => new URL(resource.uri)).not.toThrow();
      });
    });

    test('should read network status resource', async () => {
      const response = await client.readResource({ uri: 'neo://network/status' });
      
      expect(response).toBeDefined();
      expect(response.contents).toBeDefined();
      expect(Array.isArray(response.contents)).toBe(true);
      expect(response.contents.length).toBeGreaterThan(0);
      
      const content = response.contents[0];
      expect(content.uri).toBe('neo://network/status');
      expect(content.text).toBeDefined();
      
      // Validate data structure
      const data = JSON.parse(content.text);
      expect(typeof data.height).toBe('number');
      expect(data.network).toBeDefined();
    });

    test('should read mainnet status resource', async () => {
      const response = await client.readResource({ uri: 'neo://mainnet/status' });
      
      expect(response).toBeDefined();
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.network).toBe('mainnet');
    });

    test('should read testnet status resource', async () => {
      const response = await client.readResource({ uri: 'neo://testnet/status' });
      
      expect(response).toBeDefined();
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.network).toBe('testnet');
    });

    test('should handle parameterized resources', async () => {
      // Test block resource with parameter
      const response = await client.readResource({ uri: 'neo://block/1000' });
      
      expect(response).toBeDefined();
      const content = response.contents[0];
      const data = JSON.parse(content.text);
      expect(data.index).toBe(1000);
    });

    test('should handle invalid resource URIs gracefully', async () => {
      await expect(client.readResource({ uri: 'neo://invalid/resource' })).rejects.toMatchObject({
        code: expect.any(Number),
      });
    });
  });

  describe('Error Handling & Protocol Compliance', () => {
    test('should return proper error codes for invalid requests', async () => {
      const response = await client.callTool({ name: 'non_existent_tool', arguments: {} });

      expect(response.isError).toBe(true);
      expect(response.content?.[0]?.text).toContain('not found');
    });

    test('should handle malformed tool arguments', async () => {
      const response = await client.callTool({ name: 'get_balance', arguments: { invalid_param: 'test' } });

      expect(response.isError).toBe(true);
      expect(response.content?.[0]?.text).toContain('Invalid arguments');
    });

    test('should validate required parameters', async () => {
      const response = await client.callTool({ name: 'get_balance', arguments: {} }); // Missing required 'address' parameter

      expect(response.isError).toBe(true);
      expect(response.content?.[0]?.text).toContain('address');
    });
  });

  describe('Performance & Scalability', () => {
    test('should handle multiple concurrent tool calls', async () => {
      const promises = Array(5).fill(0).map(() => 
        client.callTool({ name: 'get_network_mode', arguments: {} })
      );
      
      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('text');
      });
    });

    test('should handle rapid tool calls without degradation', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 3; i++) {
        const response = await client.callTool({ name: 'get_network_mode', arguments: {} });
        expect(response).toBeDefined();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (10 seconds for 3 calls)
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Latest Protocol Features', () => {
    test('should support content types correctly', async () => {
      const response = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      
      expect(response.content[0].type).toBe('text');
      expect(typeof response.content[0].text).toBe('string');
      
      // Validate JSON content
      expect(() => JSON.parse(response.content[0].text)).not.toThrow();
    });

    test('should handle progress notifications if supported', async () => {
      // This tests if the server can handle progress reporting
      // For now, just ensure tools complete without progress errors
      const response = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      expect(response).toBeDefined();
    });

    test('should support proper metadata in responses', async () => {
      const response = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      
      // Validate response structure matches latest protocol
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      
      if (response.isError !== undefined) {
        expect(typeof response.isError).toBe('boolean');
      }
    });
  });

  describe('Integration Tests', () => {
    test('should maintain consistent state across multiple operations', async () => {
      // Test sequence of operations
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThan(0);
      
      const resources = await client.listResources();
      expect(resources.resources.length).toBeGreaterThan(0);
      
      const blockchainInfo = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      const data = JSON.parse(blockchainInfo.content[0].text);
      expect(data.height).toBeGreaterThan(0);
      
      const networkMode = await client.callTool({ name: 'get_network_mode', arguments: {} });
      const modeData = JSON.parse(networkMode.content[0].text);
      expect(modeData.mode).toBeDefined();
    });

    test('should handle complex workflow scenarios', async () => {
      // Create wallet -> Check balance -> Get network info
      const wallet = await client.callTool({ name: 'create_wallet', arguments: { password: 'password123' } });
      const walletData = JSON.parse(wallet.content[0].text);
      
      const balance = await client.callTool({ name: 'get_balance', arguments: { address: walletData.address } });
      const balanceData = JSON.parse(balance.content[0].text);
      expect(balanceData.address).toBe(walletData.address);
      
      const networkInfo = await client.callTool({ name: 'get_blockchain_info', arguments: {} });
      const networkData = JSON.parse(networkInfo.content[0].text);
      expect(networkData.network).toBeDefined();
    });
  });
}); 
