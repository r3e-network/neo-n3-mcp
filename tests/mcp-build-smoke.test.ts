import { jest } from '@jest/globals';
import path from 'path';
import { startMcpTestClient, stopMcpTestClient } from './mcp-test-utils';

describe('built MCP smoke test', () => {
  const TEST_TIMEOUT = 15000;
  let serverPath: string;
  let client: any = null;
  let transport: any = null;

  jest.setTimeout(TEST_TIMEOUT);

  beforeAll(() => {
    serverPath = path.join(__dirname, '../dist/index.js');
  });

  afterEach(async () => {
    await stopMcpTestClient(client, transport);
    client = null;
    transport = null;
  });

  test('starts the built server and exposes core MCP surfaces', async () => {
    const session = await startMcpTestClient({
      serverPath,
      env: { ...process.env, NODE_ENV: 'test' },
      clientInfo: { name: 'Built MCP Smoke Test', version: '1.0.0' },
      capabilities: { tools: {}, resources: {}, prompts: {} }
    });

    client = session.client;
    transport = session.transport;

    const tools = await client.listTools();
    const resources = await client.listResources();
    const networkMode = await client.callTool({
      name: 'get_network_mode',
      arguments: {}
    });

    expect(tools.tools.length).toBeGreaterThan(0);
    expect(resources.resources.length).toBeGreaterThan(0);
    expect(JSON.parse(networkMode.content[0].text)).toEqual(
      expect.objectContaining({
        mode: expect.any(String),
        availableNetworks: expect.any(Array),
        defaultNetwork: expect.any(String)
      })
    );
  });
});
