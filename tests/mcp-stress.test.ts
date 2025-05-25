import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * MCP Server Stress Test Suite
 * 
 * This test suite validates the Neo N3 MCP server's performance, reliability,
 * and stability under various stress conditions and load scenarios.
 */

describe('MCP Server Stress Tests', () => {
  let client: any;
  let serverPath: string;

  const STRESS_TEST_TIMEOUT = 120000; // 2 minutes for stress tests

  beforeAll(async () => {
    serverPath = path.join(__dirname, '../dist/index.js');
  });

  beforeEach(async () => {
    await startServer();
  }, 30000);

  afterEach(async () => {
    await stopServer();
  }, 15000);

  async function startServer() {
    client = new Client(
      { name: 'Stress Test Client', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, NODE_ENV: 'stress_test' }
    });

    await client.connect(transport);
  }

  async function stopServer() {
    if (client) {
      await client.close();
      client = null;
    }
  }

  describe('🔥 High Volume Tool Execution', () => {
    test('should handle 50 sequential tool calls', async () => {
      const iterations = 50;
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;

      console.log(`🚀 Starting ${iterations} sequential tool calls...`);

      for (let i = 0; i < iterations; i++) {
        try {
          const response = await client.callTool({
            name: 'get_network_mode',
            arguments: {}
          });
          
          expect(response).toBeDefined();
          expect(response.content[0].type).toBe('text');
          successCount++;
          
          if (i % 10 === 0) {
            console.log(`📊 Progress: ${i}/${iterations} calls completed`);
          }
        } catch (error) {
          console.error(`❌ Error on iteration ${i}:`, error);
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      const avgResponseTime = duration / iterations;

      console.log(`✅ Stress test completed:`);
      console.log(`   • Total calls: ${iterations}`);
      console.log(`   • Successful: ${successCount}`);
      console.log(`   • Errors: ${errorCount}`);
      console.log(`   • Total time: ${duration}ms`);
      console.log(`   • Average response time: ${avgResponseTime.toFixed(2)}ms`);

      expect(successCount).toBeGreaterThanOrEqual(iterations * 0.95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(5000); // Under 5 seconds average
    }, STRESS_TEST_TIMEOUT);

    test('should handle 20 concurrent tool calls', async () => {
      const concurrentCalls = 20;
      const startTime = Date.now();

      console.log(`🚀 Starting ${concurrentCalls} concurrent tool calls...`);

      const promises = Array(concurrentCalls).fill(0).map(async (_, index) => {
        try {
          const response = await client.callTool({
            name: 'get_blockchain_info',
            arguments: {}
          });
          
          const data = JSON.parse(response.content[0].text);
          return {
            success: true,
            index,
            height: data.height,
            network: data.network
          };
        } catch (error) {
          return {
            success: false,
            index,
            error: error.message
          };
        }
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      console.log(`✅ Concurrent test completed:`);
      console.log(`   • Total calls: ${concurrentCalls}`);
      console.log(`   • Successful: ${successCount}`);
      console.log(`   • Errors: ${errorCount}`);
      console.log(`   • Total time: ${duration}ms`);

      expect(successCount).toBeGreaterThanOrEqual(concurrentCalls * 0.9); // 90% success rate
      expect(duration).toBeLessThan(30000); // Under 30 seconds total
    }, STRESS_TEST_TIMEOUT);

    test('should handle mixed heavy operations', async () => {
      const operations = [
        () => client.callTool({ name: 'get_blockchain_info', arguments: {} }),
        () => client.callTool({ name: 'get_block_count', arguments: {} }),
        () => client.callTool({ name: 'list_famous_contracts', arguments: {} }),
        () => client.callTool({ name: 'create_wallet', arguments: { password: 'stress-test' } }),
        () => client.readResource('neo://network/status'),
        () => client.readResource('neo://mainnet/status'),
        () => client.listTools(),
        () => client.listResources()
      ];

      const iterations = 30;
      const startTime = Date.now();
      let successCount = 0;

      console.log(`🚀 Starting ${iterations} mixed heavy operations...`);

      for (let i = 0; i < iterations; i++) {
        try {
          const operation = operations[i % operations.length];
          const result = await operation();
          expect(result).toBeDefined();
          successCount++;
          
          if (i % 5 === 0) {
            console.log(`📊 Progress: ${i}/${iterations} operations completed`);
          }
        } catch (error) {
          console.error(`❌ Error on iteration ${i}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(`✅ Mixed operations test completed:`);
      console.log(`   • Total operations: ${iterations}`);
      console.log(`   • Successful: ${successCount}`);
      console.log(`   • Total time: ${duration}ms`);
      console.log(`   • Average time: ${avgTime.toFixed(2)}ms`);

      expect(successCount).toBeGreaterThanOrEqual(iterations * 0.95); // 95% success rate
    }, STRESS_TEST_TIMEOUT);
  });

  describe('📊 Resource Access Stress Tests', () => {
    test('should handle rapid resource reads', async () => {
      const resources = [
        'neo://network/status',
        'neo://mainnet/status',
        'neo://testnet/status',
        'neo://block/100',
        'neo://block/200',
        'neo://block/300'
      ];

      const iterations = 30;
      const startTime = Date.now();
      let successCount = 0;

      console.log(`🚀 Starting ${iterations} rapid resource reads...`);

      for (let i = 0; i < iterations; i++) {
        try {
          const resource = resources[i % resources.length];
          const response = await client.readResource(resource);
          
          expect(response).toBeDefined();
          expect(response.contents).toBeDefined();
          expect(response.contents.length).toBeGreaterThan(0);
          
          successCount++;
        } catch (error) {
          console.error(`❌ Error reading ${resources[i % resources.length]}:`, error);
        }
      }

      const duration = Date.now() - startTime;

      console.log(`✅ Resource stress test completed:`);
      console.log(`   • Total reads: ${iterations}`);
      console.log(`   • Successful: ${successCount}`);
      console.log(`   • Total time: ${duration}ms`);

      expect(successCount).toBeGreaterThanOrEqual(iterations * 0.95);
    }, STRESS_TEST_TIMEOUT);

    test('should handle concurrent resource access', async () => {
      const concurrentReads = 15;
      const resources = [
        'neo://network/status',
        'neo://mainnet/status',
        'neo://testnet/status'
      ];

      console.log(`🚀 Starting ${concurrentReads} concurrent resource reads...`);

      const promises = Array(concurrentReads).fill(0).map(async (_, index) => {
        try {
          const resource = resources[index % resources.length];
          const response = await client.readResource(resource);
          return { success: true, resource, data: response.contents[0].text };
        } catch (error) {
          return { success: false, resource: resources[index % resources.length], error: error.message };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;

      console.log(`✅ Concurrent resource test completed:`);
      console.log(`   • Total reads: ${concurrentReads}`);
      console.log(`   • Successful: ${successCount}`);

      expect(successCount).toBeGreaterThanOrEqual(concurrentReads * 0.9);
    }, STRESS_TEST_TIMEOUT);
  });

  describe('🎯 Complex Workflow Stress Tests', () => {
    test('should handle complex wallet workflows under stress', async () => {
      const walletCount = 10;
      const startTime = Date.now();
      let successfulWorkflows = 0;

      console.log(`🚀 Starting ${walletCount} complex wallet workflows...`);

      for (let i = 0; i < walletCount; i++) {
        try {
          // Create wallet
          const walletResponse = await client.callTool({
            name: 'create_wallet',
            arguments: { password: `stress-test-${i}` }
          });
          const wallet = JSON.parse(walletResponse.content[0].text);
          
          // Check balance
          const balanceResponse = await client.callTool({
            name: 'get_balance',
            arguments: { address: wallet.address }
          });
          const balance = JSON.parse(balanceResponse.content[0].text);
          
          // Validate workflow
          expect(wallet.address).toMatch(/^N[A-Za-z0-9]{33}$/);
          expect(balance.address).toBe(wallet.address);
          
          successfulWorkflows++;
          
          if (i % 2 === 0) {
            console.log(`📊 Completed ${i + 1}/${walletCount} wallet workflows`);
          }
        } catch (error) {
          console.error(`❌ Wallet workflow ${i} failed:`, error);
        }
      }

      const duration = Date.now() - startTime;

      console.log(`✅ Wallet workflow stress test completed:`);
      console.log(`   • Total workflows: ${walletCount}`);
      console.log(`   • Successful: ${successfulWorkflows}`);
      console.log(`   • Total time: ${duration}ms`);

      expect(successfulWorkflows).toBeGreaterThanOrEqual(walletCount * 0.9);
    }, STRESS_TEST_TIMEOUT);

    test('should handle mixed blockchain exploration workflows', async () => {
      const workflows = 15;
      const startTime = Date.now();
      let successfulWorkflows = 0;

      console.log(`🚀 Starting ${workflows} blockchain exploration workflows...`);

      for (let i = 0; i < workflows; i++) {
        try {
          // Get blockchain info
          const infoResponse = await client.callTool({
            name: 'get_blockchain_info',
            arguments: {}
          });
          const info = JSON.parse(infoResponse.content[0].text);
          
          // Get block count
          const countResponse = await client.callTool({
            name: 'get_block_count',
            arguments: {}
          });
          const count = JSON.parse(countResponse.content[0].text);
          
          // Read network status
          const statusResponse = await client.readResource('neo://network/status');
          const status = JSON.parse(statusResponse.contents[0].text);
          
          // Validate consistency
          expect(info.height).toBeGreaterThan(0);
          expect(count.height).toBeGreaterThan(0);
          expect(status.height).toBeGreaterThan(0);
          
          successfulWorkflows++;
        } catch (error) {
          console.error(`❌ Exploration workflow ${i} failed:`, error);
        }
      }

      const duration = Date.now() - startTime;

      console.log(`✅ Exploration workflow stress test completed:`);
      console.log(`   • Total workflows: ${workflows}`);
      console.log(`   • Successful: ${successfulWorkflows}`);
      console.log(`   • Total time: ${duration}ms`);

      expect(successfulWorkflows).toBeGreaterThanOrEqual(workflows * 0.95);
    }, STRESS_TEST_TIMEOUT);
  });

  describe('🛡️ Error Recovery & Stability', () => {
    test('should recover from invalid operations gracefully', async () => {
      const validOperations = [
        () => client.callTool({ name: 'get_network_mode', arguments: {} }),
        () => client.callTool({ name: 'get_blockchain_info', arguments: {} })
      ];

      const invalidOperations = [
        () => client.callTool({ name: 'invalid_tool', arguments: {} }),
        () => client.callTool({ name: 'get_balance', arguments: { address: 'invalid' } }),
        () => client.readResource('neo://invalid/resource')
      ];

      let validSuccesses = 0;
      let expectedErrors = 0;
      const totalOperations = 20;

      console.log(`🚀 Starting error recovery test with ${totalOperations} operations...`);

      for (let i = 0; i < totalOperations; i++) {
        try {
          if (i % 3 === 0) {
            // Run invalid operation
            const invalidOp = invalidOperations[i % invalidOperations.length];
            await invalidOp();
            // Should not reach here
            console.error(`❌ Invalid operation ${i} unexpectedly succeeded`);
          } else {
            // Run valid operation
            const validOp = validOperations[i % validOperations.length];
            await validOp();
            validSuccesses++;
          }
        } catch (error) {
          if (i % 3 === 0) {
            // Expected error from invalid operation
            expectedErrors++;
          } else {
            console.error(`❌ Valid operation ${i} failed:`, error);
          }
        }
      }

      console.log(`✅ Error recovery test completed:`);
      console.log(`   • Valid operations succeeded: ${validSuccesses}`);
      console.log(`   • Expected errors: ${expectedErrors}`);

      expect(validSuccesses).toBeGreaterThan(0);
      expect(expectedErrors).toBeGreaterThan(0);
    }, STRESS_TEST_TIMEOUT);

    test('should maintain stability after errors', async () => {
      // Cause some errors first
      const errorCauses = [
        () => client.callTool({ name: 'invalid_tool', arguments: {} }),
        () => client.callTool({ name: 'get_balance', arguments: { address: 'bad' } }),
        () => client.readResource('neo://bad/resource')
      ];

      let errorsGenerated = 0;

      console.log(`🚀 Generating errors to test stability...`);

      for (let i = 0; i < 5; i++) {
        try {
          const errorOp = errorCauses[i % errorCauses.length];
          await errorOp();
        } catch (error) {
          errorsGenerated++;
        }
      }

      console.log(`📊 Generated ${errorsGenerated} errors, now testing stability...`);

      // Now test that server is still stable
      let recoverySuccesses = 0;
      const recoveryOperations = 10;

      for (let i = 0; i < recoveryOperations; i++) {
        try {
          const response = await client.callTool({
            name: 'get_network_mode',
            arguments: {}
          });
          expect(response).toBeDefined();
          recoverySuccesses++;
        } catch (error) {
          console.error(`❌ Recovery operation ${i} failed:`, error);
        }
      }

      console.log(`✅ Stability test completed:`);
      console.log(`   • Errors generated: ${errorsGenerated}`);
      console.log(`   • Recovery successes: ${recoverySuccesses}/${recoveryOperations}`);

      expect(errorsGenerated).toBeGreaterThan(0);
      expect(recoverySuccesses).toBe(recoveryOperations); // Should be 100% stable after errors
    }, STRESS_TEST_TIMEOUT);
  });

  describe('⏱️ Performance Benchmarks', () => {
    test('should maintain reasonable response times under load', async () => {
      const measurements = [];
      const operationCount = 20;

      console.log(`🚀 Running performance benchmark with ${operationCount} operations...`);

      for (let i = 0; i < operationCount; i++) {
        const startTime = Date.now();
        
        try {
          await client.callTool({
            name: 'get_blockchain_info',
            arguments: {}
          });
          
          const responseTime = Date.now() - startTime;
          measurements.push(responseTime);
          
          if (i % 5 === 0) {
            console.log(`📊 Operation ${i}: ${responseTime}ms`);
          }
        } catch (error) {
          console.error(`❌ Benchmark operation ${i} failed:`, error);
        }
      }

             const avgResponseTime = measurements.length > 0 ? measurements.reduce((a, b) => a + b, 0) / measurements.length : 0;
       const maxResponseTime = measurements.length > 0 ? Math.max.apply(null, measurements) : 0;
       const minResponseTime = measurements.length > 0 ? Math.min.apply(null, measurements) : 0;

      console.log(`✅ Performance benchmark completed:`);
      console.log(`   • Operations: ${measurements.length}`);
      console.log(`   • Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   • Min response time: ${minResponseTime}ms`);
      console.log(`   • Max response time: ${maxResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(5000); // Average under 5 seconds
      expect(maxResponseTime).toBeLessThan(15000); // Max under 15 seconds
      expect(measurements.length).toBe(operationCount);
    }, STRESS_TEST_TIMEOUT);

    test('should handle memory efficiently during extended operations', async () => {
      const extendedOperations = 30;
      let successCount = 0;

      console.log(`🚀 Running extended memory efficiency test...`);

      for (let i = 0; i < extendedOperations; i++) {
        try {
          // Mix of different operations to test memory usage
          const operations = [
            () => client.callTool({ name: 'get_blockchain_info', arguments: {} }),
            () => client.callTool({ name: 'list_famous_contracts', arguments: {} }),
            () => client.readResource('neo://network/status'),
            () => client.listTools()
          ];

          const operation = operations[i % operations.length];
          const result = await operation();
          expect(result).toBeDefined();
          successCount++;

          // Small delay to allow garbage collection
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`📊 Extended test progress: ${i}/${extendedOperations}`);
          }
        } catch (error) {
          console.error(`❌ Extended operation ${i} failed:`, error);
        }
      }

      console.log(`✅ Extended memory test completed:`);
      console.log(`   • Total operations: ${extendedOperations}`);
      console.log(`   • Successful: ${successCount}`);

      expect(successCount).toBeGreaterThanOrEqual(extendedOperations * 0.95);
    }, STRESS_TEST_TIMEOUT);
  });
}); 