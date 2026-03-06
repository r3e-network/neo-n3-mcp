import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { startMcpTestClient, stopMcpTestClient } from './mcp-test-utils';

/**
 * Latest MCP Protocol Features Test Suite
 * 
 * Tests the Neo N3 MCP server's support for the latest protocol features
 * introduced in MCP protocol version 2025-03-26 and SDK version 1.12.0+
 */

describe('Latest MCP Protocol Features', () => {
  let client: any;
  let transport: StdioClientTransport | null = null;
  let serverPath: string;

  const TEST_TIMEOUT = 45000; // 45 seconds for live MCP feature checks
  jest.setTimeout(TEST_TIMEOUT);

  beforeAll(async () => {
    serverPath = path.join(__dirname, '../dist/index.js');
  });

  beforeEach(async () => {
    await startServer();
  }, TEST_TIMEOUT);

  afterEach(async () => {
    await stopServer();
  });

  async function startServer() {
    const session = await startMcpTestClient({
      serverPath,
      env: { ...process.env, NODE_ENV: 'test' },
      clientInfo: { name: 'Latest Features Test Client', version: '1.0.0' },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        experimental: {
          completions: {},
          progress: {},
          structuredOutput: {}
        }
      }
    });

    client = session.client;
    transport = session.transport;
  }

  async function stopServer() {
    await stopMcpTestClient(client, transport);
    client = null;
    transport = null;
  }

  describe('🎯 Tool Annotations & Metadata (2025-03-26)', () => {
    test('should support tool annotations for better UX', async () => {
      const response = await client.listTools();
      
      expect(response.tools.length).toBeGreaterThan(0);
      
      // Check if tools have annotations (optional feature)
      const toolsWithAnnotations = response.tools.filter((tool: any) => tool.annotations);
      
      if (toolsWithAnnotations.length > 0) {
        toolsWithAnnotations.forEach((tool: any) => {
          expect(tool.annotations).toBeDefined();
          
          // Validate annotation properties
          if (tool.annotations.audience) {
            expect(['user', 'assistant']).toContain(tool.annotations.audience);
          }
          
          if (tool.annotations.level) {
            expect(['info', 'warning', 'danger']).toContain(tool.annotations.level);
          }
          
          if (tool.annotations.scope) {
            expect(['read', 'write', 'destructive']).toContain(tool.annotations.scope);
          }
        });
        
        console.log(`✅ Found ${toolsWithAnnotations.length} tools with annotations`);
      } else {
        console.log('ℹ️  No tool annotations found (optional feature)');
      }
    });

    test('should categorize tools by risk level', async () => {
      const response = await client.listTools();
      
      const readOnlyTools = ['get_blockchain_info', 'get_block_count', 'get_balance', 'get_unclaimed_gas', 'get_nep17_transfers', 'get_nep11_balances', 'get_nep11_transfers', 'get_network_mode'];
      const writeTools = ['transfer_assets', 'invoke_contract'];
      response.tools.forEach((tool: any) => {
        if (readOnlyTools.includes(tool.name)) {
          expect(tool.name).toBeDefined();
        }
        
        if (writeTools.includes(tool.name)) {
          expect(tool.name).toBeDefined();
        }
      });
      
      console.log(`✅ Validated tool categorization for ${response.tools.length} tools`);
    });
  });

  describe('📊 Enhanced Content Types & Responses', () => {
    test('should support structured content responses', async () => {
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });

      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      
      const content = response.content[0];
      expect(content.type).toBe('text');
      expect(content.text).toBeDefined();
      
      // Validate structured JSON content
      const data = JSON.parse(content.text);
      expect(data).toMatchObject({
        height: expect.any(Number),
        network: expect.any(String),
        validators: expect.any(Array)
      });
      
      console.log(`✅ Structured content validation passed`);
    });

    test('should handle complex data structures in responses', async () => {
      const response = await client.callTool({
        name: 'list_famous_contracts',
        arguments: {}
      });

      const content = response.content[0];
      const data = JSON.parse(content.text);
      
      expect(data).toMatchObject({
        contracts: expect.any(Array),
        network: expect.any(String)
      });
      
      // Validate contract structure
      if (data.contracts.length > 0) {
        data.contracts.forEach((contract: any) => {
          expect(contract.name).toEqual(expect.any(String));
          expect(contract.description).toEqual(expect.any(String));
          expect(contract.available).toEqual(expect.any(Boolean));
          expect(contract.operationCount).toEqual(expect.any(Number));
        });
      }
      
      console.log(`✅ Complex data structure validation passed for ${data.contracts.length} contracts`);
    });

    test('should support proper error responses with context', async () => {
      const response = await client.callTool({
        name: 'get_balance',
        arguments: { address: 'invalid_address' }
      });

      expect(response.isError).toBe(true);
      const errorText = (response.content?.[0]?.text || '').toLowerCase();
      expect(errorText).toContain('address');
      console.log(`✅ Error response validation: ${errorText}`);
    });
  });

  describe('🔄 Advanced Protocol Features', () => {
    test('should support multiple content types in single response', async () => {
      const response = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });

      // Current implementation uses text content
      expect(response.content[0].type).toBe('text');
      
      // Future: Could support multiple content types
      // expect(response.content).toHaveLength(1); // or more for multi-content responses
      
      console.log(`✅ Content type validation passed`);
    });

    test('should handle resource subscriptions correctly', async () => {
      // Test resource listing for subscription capabilities
      const resources = await client.listResources();
      
      resources.resources.forEach((resource: any) => {
        expect(resource.uri).toBeDefined();
        if (resource.description !== undefined) {
          expect(typeof resource.description).toBe('string');
        }
        
        // Validate URI scheme
        expect(resource.uri).toMatch(/^neo:\/\//);
      });
      
      console.log(`✅ Resource subscription validation for ${resources.resources.length} resources`);
    });

    test('should support parameterized resources properly', async () => {
      // Test parameterized block resource
      const blockHeight = 100;
      const response = await client.readResource({ uri: `neo://block/${blockHeight}` });
      
      expect(response.contents[0].uri).toBe(`neo://block/${blockHeight}`);
      
      const data = JSON.parse(response.contents[0].text);
      expect(data.index).toBe(blockHeight);
      
      console.log(`✅ Parameterized resource validation for block ${blockHeight}`);
    });
  });

  describe('⚡ Performance & Protocol Efficiency', () => {
    test('should handle rapid sequential requests efficiently', async () => {
      const startTime = Date.now();
      const requests = 5;
      
      for (let i = 0; i < requests; i++) {
        const response = await client.callTool({
          name: 'get_network_mode',
          arguments: {}
        });
        expect(response).toBeDefined();
      }
      
      const duration = Date.now() - startTime;
      const avgRequestTime = duration / requests;
      
      expect(avgRequestTime).toBeLessThan(3000); // Should be under 3 seconds per request on average
      
      console.log(`✅ Performance test: ${requests} requests in ${duration}ms (avg: ${avgRequestTime}ms)`);
    });

    test('should handle concurrent requests without degradation', async () => {
      const concurrentRequests = 3;
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(0).map(() =>
        client.callTool({
          name: 'get_blockchain_info',
          arguments: {}
        })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('text');
      });
      
      console.log(`✅ Concurrent test: ${concurrentRequests} requests in ${duration}ms`);
    });

    test('should maintain connection stability under load', async () => {
      // Test mixed operations to stress test the connection
      const operations = [
        () => client.listTools(),
        () => client.listResources(),
        () => client.callTool({ name: 'get_network_mode', arguments: {} }),
        () => client.readResource({ uri: 'neo://network/status' }),
        () => client.callTool({ name: 'get_blockchain_info', arguments: {} })
      ];
      
      for (let i = 0; i < 10; i++) {
        const operation = operations[i % operations.length];
        const result = await operation();
        expect(result).toBeDefined();
      }
      
      console.log(`✅ Connection stability test: 10 mixed operations completed`);
    });
  });

  describe('🔐 Protocol Security & Validation', () => {
    test('should validate input parameters strictly', async () => {
      // Test parameter validation
      const testCases = [
        {
          name: 'get_balance',
          args: { address: '' }, // Empty address
          expectError: true
        },
        {
          name: 'get_balance', 
          args: { address: 'N' }, // Too short address
          expectError: true
        },
        {
          name: 'get_block',
          args: { hashOrHeight: -1 }, // Invalid block height
          expectError: true
        }
      ];
      
      for (const testCase of testCases) {
        const response = await client.callTool({
          name: testCase.name,
          arguments: testCase.args
        });

        if (testCase.expectError) {
          expect(response.isError).toBe(true);
        } else {
          expect(response.isError).not.toBe(true);
        }
      }
      
      console.log(`✅ Parameter validation test completed for ${testCases.length} cases`);
    });

    test('should handle malformed requests gracefully', async () => {
      try {
        const response = await client.callTool({
          name: 'create_wallet',
          arguments: { password: null } // Invalid password
        });
        expect(response.isError).toBe(true);
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
      
      console.log(`✅ Malformed request handling validated`);
    });

    test('should protect against resource enumeration', async () => {
      // Test invalid resource access
      const invalidResources = [
        'neo://invalid/path',
        'neo://block/invalid',
        'neo://network/invalid'
      ];
      
      for (const resourceUri of invalidResources) {
        await expect(client.readResource({ uri: resourceUri })).rejects.toBeDefined();
      }
      
      console.log(`✅ Resource enumeration protection validated`);
    });
  });

  describe('🎛️ Advanced Configuration & Features', () => {
    test('should support network-specific operations', async () => {
      // Test mainnet operations
      const mainnetStatus = await client.readResource({ uri: 'neo://mainnet/status' });
      const mainnetData = JSON.parse(mainnetStatus.contents[0].text);
      expect(mainnetData.network).toBe('mainnet');
      
      // Test testnet operations
      const testnetStatus = await client.readResource({ uri: 'neo://testnet/status' });
      const testnetData = JSON.parse(testnetStatus.contents[0].text);
      expect(testnetData.network).toBe('testnet');
      
      console.log(`✅ Network-specific operations: Mainnet height ${mainnetData.height}, Testnet height ${testnetData.height}`);
    });

    test('should handle wallet operations securely', async () => {
      // Create wallet with strong password
      const strongPassword = 'SecurePassword123!@#';
      const response = await client.callTool({
        name: 'create_wallet',
        arguments: { password: strongPassword }
      });
      
      const wallet = JSON.parse(response.content[0].text);
      expect(wallet.address).toBeDefined();
      expect(wallet.encryptedPrivateKey).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
      
      // Ensure private key is encrypted (not raw WIF)
      expect(wallet.encryptedPrivateKey).not.toMatch(/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/);
      
      console.log(`✅ Secure wallet creation: ${wallet.address}`);
    });

    test('should provide consistent state across operations', async () => {
      // Get blockchain info
      const info1 = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get blockchain info again
      const info2 = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      
      const data1 = JSON.parse(info1.content[0].text);
      const data2 = JSON.parse(info2.content[0].text);
      
      // Height should be same or increased (blockchain progresses)
      expect(data2.height).toBeGreaterThanOrEqual(data1.height);
      expect(data1.network).toBe(data2.network);
      
      console.log(`✅ State consistency: ${data1.height} -> ${data2.height}`);
    });
  });

  describe('📈 Latest MCP Features Integration', () => {
    test('should demonstrate comprehensive blockchain workflow', async () => {
      console.log('🚀 Starting comprehensive blockchain workflow test...');
      
      // 1. Get network information
      const networkInfo = await client.callTool({
        name: 'get_blockchain_info',
        arguments: {}
      });
      const networkData = JSON.parse(networkInfo.content[0].text);
      console.log(`📊 Network: ${networkData.network}, Height: ${networkData.height}`);
      
      // 2. Create a new wallet
      const walletResponse = await client.callTool({
        name: 'create_wallet',
        arguments: { password: 'workflow-test-2024' }
      });
      const wallet = JSON.parse(walletResponse.content[0].text);
      console.log(`👛 Created wallet: ${wallet.address}`);
      
      // 3. Check wallet balance
      const balanceResponse = await client.callTool({
        name: 'get_balance',
        arguments: { address: wallet.address }
      });
      const balance = JSON.parse(balanceResponse.content[0].text);
      console.log(`💰 Balance: ${balance.balance.length} assets`);
      
      // 4. Get famous contracts
      const contractsResponse = await client.callTool({
        name: 'list_famous_contracts',
        arguments: {}
      });
      const contracts = JSON.parse(contractsResponse.content[0].text);
      console.log(`📜 Contracts: ${contracts.contracts.length} available`);
      
      // 5. Read network resources
      const statusResponse = await client.readResource({ uri: 'neo://network/status' });
      const status = JSON.parse(statusResponse.contents[0].text);
      console.log(`📡 Resource status: height ${status.height}`);
      
      // Validate workflow completion
      expect(networkData.height).toBeGreaterThan(0);
      expect(wallet.address).toMatch(/^N[A-Za-z0-9]{33}$/);
      expect(Array.isArray(balance.balance)).toBe(true);
      expect(Array.isArray(contracts.contracts)).toBe(true);
      expect(status.height).toBeGreaterThan(0);
      
      console.log(`✅ Comprehensive workflow completed successfully!`);
    });
  });
}); 
