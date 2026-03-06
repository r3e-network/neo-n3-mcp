import { ChildProcess } from 'child_process';
import { once } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface StartMcpTestClientParams {
  serverPath: string;
  env: NodeJS.ProcessEnv;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: Record<string, any>;
}

export async function startMcpTestClient({
  serverPath,
  env,
  clientInfo,
  capabilities = { tools: {}, resources: {}, prompts: {} },
}: StartMcpTestClientParams): Promise<{ client: Client; transport: StdioClientTransport }> {
  const client = new Client(clientInfo, { capabilities });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env,
  });

  await client.connect(transport);

  return { client, transport };
}

export async function waitForChildExit(
  child: ChildProcess | null | undefined,
  timeoutMs: number,
): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  let timeoutId: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      once(child, 'close').then(() => undefined),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timed out waiting ${timeoutMs}ms for MCP child process ${child.pid} to exit`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function ensureChildExit(
  child: ChildProcess | null | undefined,
  timeoutMs: number,
): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    await waitForChildExit(child, timeoutMs);
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForChildExit(child, Math.min(timeoutMs, 2000));
    }
    throw error;
  }
}

export async function stopMcpTestClient(
  client: Client | null,
  transport: StdioClientTransport | null,
  timeoutMs = 5000,
): Promise<void> {
  const child = (((transport as any)?._process) as ChildProcess | undefined) ?? null;
  let closeError: unknown;

  if (client) {
    try {
      await client.close();
    } catch (error) {
      closeError ??= error;
    }
  }

  if (transport && typeof (transport as any).close === 'function') {
    try {
      await transport.close();
    } catch (error) {
      closeError ??= error;
    }
  }

  try {
    await ensureChildExit(child, timeoutMs);
  } catch (error) {
    closeError ??= error;
  }

  if (closeError) {
    throw closeError;
  }
}
