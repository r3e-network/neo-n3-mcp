import { jest } from '@jest/globals';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChildProcess } from 'child_process';
import { waitForChildExit } from './mcp-test-utils';

describe('MCP stdio lifecycle', () => {
  const TEST_TIMEOUT = 20000;
  let serverPath: string;

  jest.setTimeout(TEST_TIMEOUT);

  beforeAll(() => {
    serverPath = path.join(__dirname, '../dist/index.js');
  });

  test('client shutdown terminates the spawned MCP server process', async () => {
    const client = new Client(
      { name: 'Lifecycle Test Client', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    await client.connect(transport);

    const child = ((transport as any)._process as ChildProcess | undefined) ?? null;
    expect(child?.pid).toBeDefined();

    try {
      await client.close();
      await waitForChildExit(child, 2000);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await waitForChildExit(child, 2000);
      }
    }
  });
});
