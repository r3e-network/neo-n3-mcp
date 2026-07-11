import * as http from 'http';
import * as neonJs from '@cityofzion/neon-js';
import { AddressInfo } from 'net';
import { NeoNetwork, NeoService } from '../src/services/neo-service';

describe('Neo RPC transport deadlines', () => {
  test('does not follow redirects from a validated RPC endpoint', async () => {
    let redirectedRequests = 0;
    const server = http.createServer((request, response) => {
      if (request.url === '/redirected') {
        redirectedRequests += 1;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 321 }));
        return;
      }
      response.writeHead(302, { Location: '/redirected' });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const service = new NeoService(`http://127.0.0.1:${port}`, NeoNetwork.TESTNET, {
      rpcTimeoutMs: 500,
    });

    try {
      await expect(service.getBlockCount()).rejects.toThrow();
      expect(redirectedRequests).toBe(0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  test('preserves JSON-RPC request and response semantics', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        requestBodies.push(requestBody);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          jsonrpc: '2.0',
          id: requestBody.id,
          result: requestBody.method === 'getversion'
            ? { protocol: { network: 894710606 } }
            : 321,
        }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const service = new NeoService(
      `http://127.0.0.1:${port}`,
      NeoNetwork.TESTNET,
      { rpcTimeoutMs: 500 },
    );

    try {
      await expect(service.getBlockCount()).resolves.toBe(321);
      expect(requestBodies).toHaveLength(2);
      expect(requestBodies[0]).toMatchObject({ method: 'getversion' });
      expect(requestBodies[1]).toMatchObject({
        jsonrpc: '2.0',
        method: 'getblockcount',
        params: [],
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  test('aborts the underlying HTTP request when the RPC deadline expires', async () => {
    let resolveSocketClosed: (() => void) | undefined;
    const socketClosed = new Promise<void>((resolve) => {
      resolveSocketClosed = resolve;
    });
    const server = http.createServer(() => {
      // Intentionally never send a response.
    });
    server.on('connection', (socket) => {
      socket.once('close', () => resolveSocketClosed?.());
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const service = new NeoService(
      `http://127.0.0.1:${port}`,
      NeoNetwork.TESTNET,
      { rpcTimeoutMs: 30 },
    );

    try {
      await expect(service.getBlockCount()).rejects.toThrow(/timed out.*30ms/i);
      const closedBeforeGracePeriod = await Promise.race([
        socketClosed.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200)),
      ]);

      expect(closedBeforeGracePeriod).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  test('sends invocation scripts as RPC base64 rather than raw hex', async () => {
    let requestBody: { method?: string; params?: unknown[] } = {};
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof requestBody;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: requestBody.method === 'getversion'
            ? { protocol: { network: 894710606 } }
            : { state: 'HALT', gasconsumed: '0', stack: [] },
        }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const service = new NeoService(`http://127.0.0.1:${port}`, NeoNetwork.TESTNET, {
      rpcTimeoutMs: 500,
    });
    const script = neonJs.sc.createScript({
      scriptHash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      operation: 'symbol',
      args: [],
    });

    try {
      await service.invokeReadContract(
        '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        'symbol',
      );
      expect(requestBody.method).toBe('invokescript');
      expect(requestBody.params?.[0]).toBe(neonJs.u.HexString.fromHex(script).toBase64());
      expect(requestBody.params?.[0]).not.toBe(script);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
