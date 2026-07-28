import { ChildProcess } from 'child_process';
import { once } from 'events';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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

const ownedWalletDirectories = new WeakMap<StdioClientTransport, string>();
const MCP_TEST_CONNECT_TIMEOUT_MS = 90_000;

/**
 * Signatures of a fault in the RPC transport rather than in the thing under test. `fetch failed`
 * is Node's undici wrapper for DNS/TLS/connection-reset errors, which public nodes produce as
 * readily as an outright timeout.
 */
// 520 belongs here with the 5xx family: a Cloudflare-fronted seed whose origin is
// dead answers 520, which is exactly the "endpoint did not answer" case the
// client fails over on (mainnet1.neo.coz.io did this for days).
const TRANSIENT_RPC_FAILURE =
  /timed out|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|502|503|504|520/i;

/**
 * Retry `operation` while it fails for transport reasons, then hand back its last result.
 *
 * `isTransientResult` lets a caller treat a *successful-looking* response as transient: MCP tools
 * report an RPC fault as `isError` content rather than by throwing, so shape has to be inspected
 * too. Thrown non-transient errors propagate on the first attempt, so a genuine rejection is never
 * retried into a timeout.
 */
async function withRpcRetry<T>(
  operation: () => Promise<T>,
  isTransientResult: (result: T) => boolean,
  { attempts = 3, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastResult: T;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let transient: boolean;
    try {
      lastResult = await operation();
      lastError = undefined;
      transient = isTransientResult(lastResult);
    } catch (error) {
      lastError = error;
      transient = TRANSIENT_RPC_FAILURE.test(String((error as Error)?.message ?? ''));
      if (!transient) {
        throw error;
      }
    }
    if (!transient) {
      return lastResult!;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  if (lastError) {
    throw lastError;
  }
  return lastResult!;
}

/**
 * Read a resource whose body is fetched from public Neo RPC, retrying transient RPC failures.
 *
 * Resource reads have no `isError` channel — a failed read throws — so only the thrown path needs
 * inspecting here.
 */
export async function readResourceWithRpcRetry(
  client: Client,
  request: { uri: string },
  options: { attempts?: number; delayMs?: number } = {},
): Promise<any> {
  return withRpcRetry(() => client.readResource(request), () => false, options);
}

/**
 * Call a tool that reads through to public Neo RPC, retrying transient RPC failures.
 *
 * The protocol suites assert MCP framing and response shape, but their data comes from public
 * RPC nodes that intermittently time out. Without a retry those suites fail for a reason they
 * do not test: the tool answers `{"error": "Failed to ..."}` and the assertion trips on
 * `JSON.parse`. Only RPC-layer failures are retried — an `isError` response whose text does not
 * look like an RPC fault is returned as-is, so genuine rejections (an unregistered tool, a bad
 * argument) still surface immediately instead of being retried into a timeout.
 */
export async function callToolWithRpcRetry(
  client: Client,
  request: { name: string; arguments: Record<string, unknown> },
  options: { attempts?: number; delayMs?: number } = {},
): Promise<any> {
  return withRpcRetry(
    () => client.callTool(request),
    // A slow RPC read surfaces either as an isError response or as a thrown McpError, depending on
    // where it failed; withRpcRetry covers the thrown path, this covers the reported one.
    (response: any) =>
      response?.isError === true
      && TRANSIENT_RPC_FAILURE.test(String(response?.content?.[0]?.text ?? '')),
    options,
  );
}

export async function startMcpTestClient({
  serverPath,
  env,
  clientInfo,
  capabilities = { tools: {}, resources: {}, prompts: {} },
}: StartMcpTestClientParams): Promise<{ client: Client; transport: StdioClientTransport }> {
  const ownsWalletDirectory = !env.WALLETS_DIR;
  const walletsDir = env.WALLETS_DIR || mkdtempSync(join(tmpdir(), 'neo-mcp-test-wallets-'));
  const client = new Client(clientInfo, { capabilities });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: { ...env, WALLETS_DIR: walletsDir },
  });

  if (ownsWalletDirectory) {
    ownedWalletDirectories.set(transport, walletsDir);
  }

  let connectTimeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) => {
        connectTimeout = setTimeout(() => {
          reject(new Error(`Timed out waiting ${MCP_TEST_CONNECT_TIMEOUT_MS}ms for MCP test client connection`));
        }, MCP_TEST_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    try {
      await transport.close();
    } catch {
      // Preserve the connection error; transport cleanup is best effort here.
    }
    if (ownsWalletDirectory) {
      ownedWalletDirectories.delete(transport);
      rmSync(walletsDir, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (connectTimeout) {
      clearTimeout(connectTimeout);
    }
  }

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

  const walletsDir = transport ? ownedWalletDirectories.get(transport) : undefined;
  if (transport) {
    ownedWalletDirectories.delete(transport);
  }
  if (walletsDir) {
    rmSync(walletsDir, { recursive: true, force: true });
  }

  if (closeError) {
    throw closeError;
  }
}
