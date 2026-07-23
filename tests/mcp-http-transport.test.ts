/**
 * Integration tests for the MCP Streamable HTTP transport.
 *
 * These run a real McpHttpServer on an ephemeral port and drive it with the real
 * SDK client transport (StreamableHTTPClientTransport) exactly the way
 * Neo-Explorer-UI/api/lib/mcpClient.js does. Nothing about the protocol is
 * mocked; raw fetch is used only where an exact HTTP status must be asserted.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

import { McpHttpServer, McpHttpServerOptions, resolveMcpHttpOptionsFromEnv } from '../src/mcp-http-server';

jest.setTimeout(30_000);

// 44 bytes: satisfies the minimum-entropy rule for non-loopback listeners too.
const BEARER = 'test-bearer-token-000102030405060708090a0b0c';
const ACCEPT_BOTH = 'application/json, text/event-stream';

const startedServers: McpHttpServer[] = [];
const openClients: Array<{ client: Client; transport: StreamableHTTPClientTransport }> = [];

interface StartedServer {
  server: McpHttpServer;
  port: number;
  url: string;
}

async function startServer(options: McpHttpServerOptions = {}): Promise<StartedServer> {
  const server = new McpHttpServer({
    port: 0,
    host: '127.0.0.1',
    bearerToken: BEARER,
    ...options,
  });
  startedServers.push(server);
  const port = await server.start();
  return { server, port, url: `http://127.0.0.1:${port}${server.endpointPath}` };
}

async function connectClient(
  started: StartedServer,
  token: string | undefined = BEARER
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const requestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const transport = new StreamableHTTPClientTransport(new URL(started.url), { requestInit });
  const client = new Client({ name: 'neo-explorer-agent', version: '1.0.0' }, { capabilities: {} });
  const entry = { client, transport };
  openClients.push(entry);
  await client.connect(transport);
  return entry;
}

function initializeBody(id: number | string = 1): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'raw-http-client', version: '1.0.0' },
    },
  });
}

/** POSTs a raw initialize request and drains the response so no socket lingers. */
async function rawInitialize(
  started: StartedServer,
  headers: Record<string, string> = {}
): Promise<Response> {
  const response = await fetch(started.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: ACCEPT_BOTH,
      Authorization: `Bearer ${BEARER}`,
      ...headers,
    },
    body: initializeBody(),
  });
  await response.body?.cancel();
  return response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(async () => {
  while (openClients.length > 0) {
    const entry = openClients.pop();
    if (!entry) continue;
    try {
      await entry.client.close();
    } catch {
      // The server may already have closed the session; nothing to clean up.
    }
  }
  while (startedServers.length > 0) {
    const server = startedServers.pop();
    if (!server) continue;
    await server.stop();
  }
});

describe('MCP Streamable HTTP transport', () => {
  describe('protocol round trip', () => {
    test('initializes, lists tools, and calls a tool over HTTP', async () => {
      const started = await startServer();
      const { client, transport } = await connectClient(started);

      expect(transport.sessionId).toEqual(expect.any(String));
      expect(started.server.sessionCount).toBe(1);

      const listed = await client.listTools(undefined, { timeout: 15_000 });
      expect(Array.isArray(listed.tools)).toBe(true);
      expect(listed.tools.length).toBeGreaterThan(0);
      expect(listed.tools.map((tool) => tool.name)).toContain('get_network_mode');

      const result = await client.callTool(
        { name: 'get_network_mode', arguments: {} },
        undefined,
        { timeout: 15_000 }
      );
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].type).toBe('text');
      const payload = JSON.parse(content[0].text) as {
        mode: string;
        availableNetworks: string[];
        defaultNetwork: string;
      };
      expect(typeof payload.mode).toBe('string');
      expect(Array.isArray(payload.availableNetworks)).toBe(true);
      expect(payload.availableNetworks.length).toBeGreaterThan(0);
    });

    test('returns a well-formed tool error without breaking the session', async () => {
      const started = await startServer();
      const { client } = await connectClient(started);

      const result = await client.callTool(
        { name: 'get_balance', arguments: { address: 'not-a-neo-address' } },
        undefined,
        { timeout: 15_000 }
      );

      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toMatch(/address/i);

      // The session survives a failed tool call.
      const listed = await client.listTools(undefined, { timeout: 15_000 });
      expect(listed.tools.length).toBeGreaterThan(0);
    });
  });

  describe('authentication', () => {
    test('rejects a request with no Authorization header', async () => {
      const started = await startServer();

      const response = await fetch(started.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: ACCEPT_BOTH },
        body: initializeBody(),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toMatch(/^Bearer/);
      expect(body).toEqual({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized' },
        id: null,
      });
      expect(started.server.sessionCount).toBe(0);
    });

    test('rejects a request with the wrong bearer token', async () => {
      const started = await startServer();

      const response = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: 'Bearer test-bearer-token-ffffffffffffffffffffffff',
        },
        body: initializeBody(),
      });
      await response.body?.cancel();

      expect(response.status).toBe(401);
      expect(started.server.sessionCount).toBe(0);
    });

    test('accepts a request with the correct bearer token', async () => {
      const started = await startServer();

      const response = await rawInitialize(started);

      expect(response.status).toBe(200);
      expect(response.headers.get('mcp-session-id')).toEqual(expect.any(String));
      expect(started.server.sessionCount).toBe(1);
    });

    test('requires a bearer token when binding a non-loopback host', () => {
      expect(() => new McpHttpServer({ host: '0.0.0.0', port: 0 })).toThrow(/MCP_HTTP_BEARER is required/);
      expect(() => new McpHttpServer({ host: '0.0.0.0', port: 0, bearerToken: 'short' }))
        .toThrow(/at least 32 bytes/);
    });
  });

  describe('session lifecycle', () => {
    test('gives every client its own session id', async () => {
      const started = await startServer();
      const first = await connectClient(started);
      const second = await connectClient(started);

      expect(first.transport.sessionId).toEqual(expect.any(String));
      expect(second.transport.sessionId).toEqual(expect.any(String));
      expect(first.transport.sessionId).not.toBe(second.transport.sessionId);
      expect(started.server.sessionCount).toBe(2);
    });

    test('terminateSession removes the session', async () => {
      const started = await startServer();
      const { client, transport } = await connectClient(started);
      expect(started.server.sessionCount).toBe(1);

      await transport.terminateSession();
      await client.close();

      expect(started.server.sessionCount).toBe(0);
    });

    test('rejects requests that carry an unknown session id', async () => {
      const started = await startServer();
      await connectClient(started);

      const post = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: `Bearer ${BEARER}`,
          'Mcp-Session-Id': '00000000-0000-4000-8000-000000000000',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} }),
      });
      const postBody = await post.json();

      expect(post.status).toBe(404);
      expect(postBody).toMatchObject({ error: { code: -32001, message: 'Session not found' } });

      const remove = await fetch(started.url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${BEARER}`,
          'Mcp-Session-Id': '00000000-0000-4000-8000-000000000000',
        },
      });
      await remove.body?.cancel();
      expect(remove.status).toBe(404);

      // The live session is untouched.
      expect(started.server.sessionCount).toBe(1);
    });

    test('rejects a non-initialize POST that has no session id', async () => {
      const started = await startServer();

      const response = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: `Bearer ${BEARER}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({ error: { message: /Mcp-Session-Id/ } as never });
      expect(started.server.sessionCount).toBe(0);
    });
  });

  describe('health endpoint', () => {
    test('serves /healthz without authentication and reports live sessions', async () => {
      const started = await startServer();

      const empty = await fetch(`http://127.0.0.1:${started.port}/healthz`);
      const emptyBody = await empty.json();
      expect(empty.status).toBe(200);
      expect(emptyBody).toEqual({
        status: 'ok',
        sessions: 0,
        version: expect.any(String),
      });

      await connectClient(started);

      const live = await fetch(`http://127.0.0.1:${started.port}/healthz`);
      const liveBody = await live.json();
      expect(live.status).toBe(200);
      expect(liveBody.sessions).toBe(1);
    });
  });

  describe('request validation', () => {
    test('rejects an oversized body with 413', async () => {
      const started = await startServer({ maxBodyBytes: 1024 });

      const response = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: `Bearer ${BEARER}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', padding: 'x'.repeat(4096) }),
      });
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(body).toMatchObject({ error: { message: 'Payload Too Large' } });
      expect(started.server.sessionCount).toBe(0);
    });

    test('rejects malformed JSON with a 400 parse error', async () => {
      const started = await startServer();

      const response = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: `Bearer ${BEARER}`,
        },
        body: '{"jsonrpc":"2.0"',
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
        id: null,
      });
    });

    test('rejects unknown paths and unsupported methods', async () => {
      const started = await startServer();

      const unknownPath = await fetch(`http://127.0.0.1:${started.port}/nope`, {
        headers: { Authorization: `Bearer ${BEARER}` },
      });
      await unknownPath.body?.cancel();
      expect(unknownPath.status).toBe(404);

      const badMethod = await fetch(started.url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${BEARER}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      await badMethod.body?.cancel();
      expect(badMethod.status).toBe(405);
      expect(badMethod.headers.get('allow')).toBe('GET, POST, DELETE, OPTIONS');
    });
  });

  describe('origin and host checks', () => {
    test('allows a request without an Origin header', async () => {
      const started = await startServer();
      const response = await rawInitialize(started);
      expect(response.status).toBe(200);
    });

    test('rejects a disallowed Origin with 403', async () => {
      const started = await startServer({ allowedOrigins: ['https://explorer.example'] });

      const response = await rawInitialize(started, { Origin: 'https://evil.example' });

      expect(response.status).toBe(403);
      expect(started.server.sessionCount).toBe(0);
    });

    test('allows an allowlisted Origin and exposes Mcp-Session-Id to it', async () => {
      const started = await startServer({ allowedOrigins: ['https://explorer.example'] });

      const response = await rawInitialize(started, { Origin: 'https://explorer.example' });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://explorer.example');
      expect(response.headers.get('access-control-expose-headers')).toBe('Mcp-Session-Id');
    });

    test('answers CORS preflight with the headers the client needs', async () => {
      const started = await startServer({ allowedOrigins: ['https://explorer.example'] });

      const response = await fetch(started.url, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://explorer.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type, mcp-session-id',
        },
      });
      await response.body?.cancel();

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('https://explorer.example');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
      const allowedHeaders = response.headers.get('access-control-allow-headers') ?? '';
      for (const header of ['Authorization', 'Content-Type', 'Mcp-Session-Id', 'Mcp-Protocol-Version']) {
        expect(allowedHeaders).toContain(header);
      }
      expect(response.headers.get('access-control-expose-headers')).toBe('Mcp-Session-Id');
    });

    test('rejects a Host header outside an explicit allowlist', async () => {
      const started = await startServer({ allowedHosts: ['mcp.example'] });

      const response = await rawInitialize(started);

      expect(response.status).toBe(403);
      expect(started.server.sessionCount).toBe(0);
    });
  });

  describe('session hygiene', () => {
    test('refuses new sessions once the cap is reached', async () => {
      const started = await startServer({ maxSessions: 1 });
      await connectClient(started);
      expect(started.server.sessionCount).toBe(1);

      const response = await rawInitialize(started);

      expect(response.status).toBe(503);
      expect(started.server.sessionCount).toBe(1);
    });

    test('evicts sessions that idle past the TTL', async () => {
      const started = await startServer({ sessionTtlMs: 150 });

      const response = await rawInitialize(started);
      expect(response.status).toBe(200);
      expect(started.server.sessionCount).toBe(1);

      await sleep(600);

      expect(started.server.sessionCount).toBe(0);

      // The evicted session id is no longer routable.
      const sessionId = response.headers.get('mcp-session-id') as string;
      const afterEviction = await fetch(started.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: ACCEPT_BOTH,
          Authorization: `Bearer ${BEARER}`,
          'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }),
      });
      await afterEviction.body?.cancel();
      expect(afterEviction.status).toBe(404);
    });

    test('stop() closes every live session', async () => {
      const started = await startServer();
      await connectClient(started);
      expect(started.server.sessionCount).toBe(1);

      await started.server.stop();

      expect(started.server.sessionCount).toBe(0);
    });
  });

  describe('environment configuration', () => {
    test('reads the documented environment variables', () => {
      const options = resolveMcpHttpOptionsFromEnv({
        MCP_HTTP_PORT: '3999',
        MCP_HTTP_HOST: '0.0.0.0',
        MCP_HTTP_PATH: '/mcp-remote',
        MCP_HTTP_BEARER: BEARER,
        MCP_HTTP_ALLOWED_ORIGINS: 'https://a.example, https://b.example',
        MCP_HTTP_MAX_SESSIONS: '7',
        MCP_HTTP_SESSION_TTL_MS: '60000',
      });

      expect(options).toEqual({
        port: 3999,
        host: '0.0.0.0',
        path: '/mcp-remote',
        bearerToken: BEARER,
        allowedOrigins: ['https://a.example', 'https://b.example'],
        maxSessions: 7,
        sessionTtlMs: 60_000,
      });
    });

    test('falls back to the documented defaults', () => {
      const options = resolveMcpHttpOptionsFromEnv({});

      expect(options).toMatchObject({
        port: 3001,
        host: '127.0.0.1',
        path: '/mcp',
        bearerToken: undefined,
        allowedOrigins: [],
        maxSessions: 128,
        sessionTtlMs: 1_800_000,
      });
    });

    test('rejects invalid numeric environment values', () => {
      expect(() => resolveMcpHttpOptionsFromEnv({ MCP_HTTP_PORT: 'nope' })).toThrow(/MCP_HTTP_PORT/);
      expect(() => resolveMcpHttpOptionsFromEnv({ MCP_HTTP_MAX_SESSIONS: '0' }))
        .toThrow(/MCP_HTTP_MAX_SESSIONS/);
      expect(() => resolveMcpHttpOptionsFromEnv({ MCP_HTTP_SESSION_TTL_MS: '-1' }))
        .toThrow(/MCP_HTTP_SESSION_TTL_MS/);
    });
  });
});
