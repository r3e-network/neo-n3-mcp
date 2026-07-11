import * as http from 'http';
import { AddressInfo } from 'net';

import { HttpServer } from '../src/http-server';
import { NeoNetwork } from '../src/services/neo-service';
import { logger } from '../src/utils/logger';
import { RateLimitError } from '../src/utils/errors';
import { rateLimiter } from '../src/utils/rate-limiter';
import { TEST_WIF } from './test-wallet';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'OPTIONS';
  body?: unknown;
  rawBody?: string | Buffer;
  headers?: http.OutgoingHttpHeaders;
};

function request(
  port: number,
  path: string,
  options: RequestOptions = {}
): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders; }> {
  const method = options.method ?? 'GET';
  const payload = options.rawBody ?? (
    options.body === undefined ? undefined : JSON.stringify(options.body)
  );
  const headers: http.OutgoingHttpHeaders = { ...options.headers };

  if (payload !== undefined) {
    headers['Content-Length'] = Buffer.byteLength(payload);
    if (headers['Content-Type'] === undefined && headers['content-type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
            headers: res.headers
          });
        });
      }
    );

    req.on('error', reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForPort(server: HttpServer): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const address = server.getAddress() as AddressInfo | null;
    if (address && typeof address.port === 'number') {
      return address.port;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('HTTP server did not start listening in time');
}

const mockKnownRecipientScriptHash = '0xf970f4ccecd765b63732b821775dc38c25d74b39';
const mockKnownRecipientAddress = 'NdxiFLMContract1111111111111111111';
const mockApplicationLog = {
  txid: '0xabc',
  executions: [{
    vmstate: 'HALT',
    notifications: [{
      eventname: 'Transfer',
      parsed: {
        type: 'nep17_transfer',
        amount: '42',
        asset: {
          symbol: 'GAS',
          name: 'GasToken',
          scriptHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
          logo: 'data:image/svg+xml;utf8,mock-gas-logo',
        },
        to: {
          address: mockKnownRecipientAddress,
          scriptHash: mockKnownRecipientScriptHash,
          displayName: 'Flamingo',
          name: 'Flamingo',
          kind: 'contract',
          logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
          knownAccount: {
            id: 'flamingo',
            name: 'Flamingo',
            kind: 'contract',
            scriptHash: mockKnownRecipientScriptHash,
            address: mockKnownRecipientAddress,
            logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
          },
        },
      },
    }],
  }],
};
const mockNep17Transfers = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  sent: [
    {
      txhash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      transferaddress: mockKnownRecipientAddress,
      amount: '42',
      timestamp: 1710000000000,
      direction: 'sent',
      timestampIso: new Date(1710000000000).toISOString(),
      to: {
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
        logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
      },
      asset: {
        symbol: 'GAS',
        name: 'GasToken',
        scriptHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
        logo: 'data:image/svg+xml;utf8,mock-gas-logo',
      },
    }
  ],
  received: [],
};
const mockNep11AssetHash = '0x1234567890abcdef1234567890abcdef12345678';
const mockNep11Balances = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  balance: [
    {
      assethash: mockNep11AssetHash,
      amount: '2',
      tokens: [
        { tokenid: 'nft-1', amount: '1' },
        { tokenid: 'nft-2', amount: '1' }
      ],
      asset: {
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      }
    }
  ]
};
const mockNep11Transfers = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  sent: [
    {
      txhash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      assethash: mockNep11AssetHash,
      transferaddress: mockKnownRecipientAddress,
      amount: '1',
      tokenid: 'nft-1',
      timestamp: 1710000002000,
      direction: 'sent',
      timestampIso: new Date(1710000002000).toISOString(),
      to: {
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
        logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
      },
      asset: {
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      },
    }
  ],
  received: [],
};

describe('HttpServer', () => {
  test('rejects malformed request targets inside the HTTP error boundary', async () => {
    const server = new HttpServer({} as any, {} as any, {} as any, 0);
    await waitForPort(server);
    const response = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      end: jest.fn(),
    } as any;

    try {
      await expect((server as any).handleRequest({
        url: 'http://%',
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      }, response)).resolves.toBeUndefined();
      expect(response.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid request URL' }));
    } finally {
      await server.stop();
    }
  });

  test.each(['0.0.0.0', '::', '192.0.2.10'])(
    'requires an API key when binding to non-loopback host %s',
    (host) => {
      expect(() => new HttpServer({} as any, {} as any, {} as any, 65_536, { host }))
        .toThrow(/api key.*non-loopback/i);
    }
  );

  test.each(['', 'too-short', 'a'.repeat(31)])(
    'rejects configured API keys shorter than 32 bytes',
    (apiKey) => {
      expect(() => new HttpServer({} as any, {} as any, {} as any, 65_536, { apiKey }))
        .toThrow(/api key.*32 bytes/i);
    }
  );

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid request body byte limit %p',
    (maxBodyBytes) => {
      expect(() => new HttpServer({} as any, {} as any, {} as any, 65_536, { maxBodyBytes }))
        .toThrow(/maxBodyBytes.*positive safe integer/i);
    }
  );

  test('configures finite HTTP lifecycle timeouts', async () => {
    const server = new HttpServer({} as any, {} as any, {} as any, 0, {
      requestTimeoutMs: 12_000,
      headersTimeoutMs: 2_000,
      keepAliveTimeoutMs: 1_000,
      shutdownGraceMs: 500,
    } as any);
    await waitForPort(server);

    try {
      const nodeServer = (server as any).server as http.Server;
      expect(nodeServer.requestTimeout).toBe(12_000);
      expect(nodeServer.headersTimeout).toBe(2_000);
      expect(nodeServer.keepAliveTimeout).toBe(1_000);
    } finally {
      await server.stop();
    }
  });

  test('keeps liveness, readiness, and preflight outside request limits', async () => {
    const checkLimit = jest.spyOn(rateLimiter, 'checkLimit').mockImplementation(() => {
      throw new RateLimitError('Rate limit exceeded');
    });
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(123),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      await expect(request(port, '/live')).resolves.toMatchObject({ statusCode: 200 });
      await expect(request(port, '/health')).resolves.toMatchObject({ statusCode: 200 });
      await expect(request(port, '/api/blockchain/height', { method: 'OPTIONS' })).resolves.toMatchObject({ statusCode: 204 });
      await expect(request(port, '/api/blockchain/height')).resolves.toMatchObject({ statusCode: 429 });
      expect(checkLimit).toHaveBeenCalledTimes(1);
    } finally {
      checkLimit.mockRestore();
      await server.stop();
    }
  });

  test('uses a forwarded client address only through an explicitly trusted proxy chain', async () => {
    const checkLimit = jest.spyOn(rateLimiter, 'checkLimit').mockReturnValue(true);
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(123),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      trustedProxies: ['127.0.0.1/32', '192.0.2.20/32'],
    });
    const port = await waitForPort(server);

    try {
      await expect(request(port, '/api/blockchain/height', {
        headers: { 'X-Forwarded-For': '203.0.113.10, 192.0.2.20' },
      })).resolves.toMatchObject({ statusCode: 200 });
      expect(checkLimit).toHaveBeenCalledWith('203.0.113.10');
    } finally {
      checkLimit.mockRestore();
      await server.stop();
    }
  });

  test('ignores forwarded client headers from an untrusted socket peer', async () => {
    const checkLimit = jest.spyOn(rateLimiter, 'checkLimit').mockReturnValue(true);
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(123),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      trustedProxies: ['192.0.2.20/32'],
    });
    const port = await waitForPort(server);

    try {
      await expect(request(port, '/api/blockchain/height', {
        headers: { 'X-Forwarded-For': '203.0.113.10' },
      })).resolves.toMatchObject({ statusCode: 200 });
      expect(checkLimit).toHaveBeenCalledWith('127.0.0.1');
    } finally {
      checkLimit.mockRestore();
      await server.stop();
    }
  });

  test('requires a valid bearer token when API authentication is configured', async () => {
    const apiKey = 'a'.repeat(32);
    const neoService = {
      getBlockchainInfo: jest.fn().mockResolvedValue({ height: 12345 }),
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0, { apiKey });
    const port = await waitForPort(server);

    try {
      const missingToken = await request(port, '/api/blockchain/info');
      expect(missingToken.statusCode).toBe(401);
      expect(JSON.parse(missingToken.body)).toEqual({ error: 'Unauthorized' });

      const invalidToken = await request(port, '/api/blockchain/info', {
        headers: { Authorization: 'Bearer invalid' }
      });
      expect(invalidToken.statusCode).toBe(401);

      const authorized = await request(port, '/api/blockchain/info', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      expect(authorized.statusCode).toBe(200);
      expect(neoService.getBlockchainInfo).toHaveBeenCalledTimes(1);

      const health = await request(port, '/health');
      expect(health.statusCode).toBe(200);
    } finally {
      await server.stop();
    }
  });

  test('exempts only GET health probes from authentication and rate limiting', async () => {
    const apiKey = 'a'.repeat(32);
    const checkLimit = jest.spyOn(rateLimiter, 'checkLimit').mockReturnValue(true);
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(123),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, { apiKey });
    const port = await waitForPort(server);

    try {
      for (const path of ['/live', '/health']) {
        const response = await request(port, path, { method: 'POST', body: {} });
        expect(response.statusCode).toBe(401);
      }
      expect(checkLimit).toHaveBeenCalledTimes(2);
    } finally {
      checkLimit.mockRestore();
      await server.stop();
    }
  });

  test('maps typed validation failures to a safe bad-request response', async () => {
    const { ValidationError } = await import('../src/utils/errors');
    const walletService = {
      createWallet: jest.fn().mockRejectedValue(new ValidationError('Password must contain at least 8 characters')),
    } as any;
    const server = new HttpServer({} as any, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets', {
        method: 'POST',
        body: { password: 'weak' },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toMatchObject({
        error: 'Bad request',
        details: 'Password must contain at least 8 characters',
      });
    } finally {
      await server.stop();
    }
  });

  test('rejects invalid WIFs without returning or logging the supplied secret', async () => {
    const secret = 'super-secret-invalid-wif';
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      transferAssets: jest.fn()
    } as any;
    const writeCoordinator = {
      signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      reserve: jest.fn(),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      writesEnabled: true,
      writeApprovalApiKey: 'independent-approval-key-1234567890',
      writeCoordinator,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers', {
        method: 'POST',
        body: {
          fromWIF: secret,
          toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          asset: 'GAS',
          amount: '1',
          confirm: true
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain(secret);
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(secret);
      expect(writeCoordinator.reserve).not.toHaveBeenCalled();
      expect(neoService.transferAssets).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      await server.stop();
    }
  });

  test('rejects unsupported request content types', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const walletService = { createWallet: jest.fn() } as any;
    const server = new HttpServer(neoService, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets', {
        method: 'POST',
        rawBody: 'password=not-json',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      expect(response.statusCode).toBe(415);
      expect(JSON.parse(response.body)).toEqual({ error: 'Content-Type must be application/json' });
      expect(walletService.createWallet).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('rejects malformed and non-object JSON request bodies', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const walletService = { createWallet: jest.fn() } as any;
    const server = new HttpServer(neoService, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const malformed = await request(port, '/api/wallets', {
        method: 'POST',
        rawBody: '{',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(malformed.statusCode).toBe(400);
      expect(JSON.parse(malformed.body)).toEqual({ error: 'Request body must contain valid JSON' });

      const array = await request(port, '/api/wallets', {
        method: 'POST',
        body: []
      });
      expect(array.statusCode).toBe(400);
      expect(JSON.parse(array.body)).toEqual({ error: 'Request body must be a JSON object' });
    } finally {
      await server.stop();
    }
  });

  test('rejects request bodies above the configured byte limit', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const walletService = { createWallet: jest.fn() } as any;
    const server = new HttpServer(neoService, walletService, {} as any, 0, {
      maxBodyBytes: 32,
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets', {
        method: 'POST',
        body: { password: 'x'.repeat(64) }
      });

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body)).toEqual({ error: 'Request body exceeds 32 bytes' });
      expect(walletService.createWallet).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('sets defensive response headers and only allows configured CORS origins', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      corsOrigins: ['https://console.example.com/']
    });
    const port = await waitForPort(server);

    try {
      const allowed = await request(port, '/health', {
        headers: { Origin: 'https://console.example.com' }
      });
      expect(allowed.headers['access-control-allow-origin']).toBe('https://console.example.com');
      expect(allowed.headers['cache-control']).toBe('no-store');
      expect(allowed.headers['x-content-type-options']).toBe('nosniff');

      const rejected = await request(port, '/health', {
        headers: { Origin: 'https://attacker.example' }
      });
      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await server.stop();
    }
  });

  test.each([
    ['nep17', 'getNep17Transfers'],
    ['nep11', 'getNep11Transfers'],
  ])('rejects malformed and unsafe %s transfer timestamps', async (standard, methodName) => {
    const transferMethod = jest.fn();
    const neoService = {
      [methodName]: transferMethod,
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      for (const timestamp of ['123junk', String(Number.MAX_SAFE_INTEGER + 1)]) {
        const response = await request(
          port,
          `/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/${standard}-transfers?fromTimestampMs=${timestamp}`
        );
        expect(response.statusCode).toBe(400);
      }
      expect(transferMethod).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('maps malformed encoded path segments to a bad request', async () => {
    const server = new HttpServer({} as any, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/%E0%A4%A');
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid encoded path segment' });
    } finally {
      await server.stop();
    }
  });

  test('exposes bind failures through an awaitable startup boundary', async () => {
    const occupied = http.createServer();
    await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
    const address = occupied.address() as AddressInfo;
    const server = new HttpServer({} as any, {} as any, {} as any, address.port);

    try {
      expect(typeof (server as any).ready).toBe('function');
      await expect((server as any).ready()).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      await server.stop();
      await new Promise<void>((resolve, reject) => {
        occupied.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  test('serves a healthy status payload', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/health');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        status: 'healthy',
        network: NeoNetwork.TESTNET,
        blockCount: 12345,
        height: 12344
      });
    } finally {
      await server.stop();
    }
  });

  test('deduplicates and briefly caches readiness RPC checks', async () => {
    let resolveBlockCount!: (value: number) => void;
    const blockCount = new Promise<number>((resolve) => {
      resolveBlockCount = resolve;
    });
    const neoService = {
      getBlockCount: jest.fn().mockReturnValue(blockCount),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      healthCacheTtlMs: 1_000,
    } as any);
    const first = (server as any).getHealthStatus();
    const second = (server as any).getHealthStatus();

    try {
      expect(neoService.getBlockCount).toHaveBeenCalledTimes(1);

      resolveBlockCount(42);
      await expect(Promise.all([first, second])).resolves.toEqual([
        expect.objectContaining({ status: 'healthy', blockCount: 42 }),
        expect.objectContaining({ status: 'healthy', blockCount: 42 }),
      ]);
      await expect((server as any).getHealthStatus()).resolves.toMatchObject({
        status: 'healthy',
        blockCount: 42,
      });
      expect(neoService.getBlockCount).toHaveBeenCalledTimes(1);
    } finally {
      resolveBlockCount(42);
      await Promise.allSettled([first, second]);
      await server.stop();
    }
  });

  test.each([
    ['an unknown transaction', 'Unknown transaction', 404],
    ['an RPC deadline', 'RPC request timed out after 10ms', 504],
    ['a malformed upstream response', 'Neo RPC returned an invalid GAS balance', 502],
    ['an oversized upstream response', 'Neo RPC response exceeds 16777216 bytes', 502],
  ])('maps %s to the appropriate upstream status', async (_name, message, expectedStatus) => {
    const neoService = {
      getTransaction: jest.fn().mockRejectedValue(new Error(message)),
      getBlockCount: jest.fn().mockRejectedValue(new Error(message)),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const path = expectedStatus === 404
        ? `/api/transactions/0x${'0'.repeat(64)}`
        : '/api/blockchain/height';
      const response = await request(port, path);
      expect(response.statusCode).toBe(expectedStatus);
    } finally {
      await server.stop();
    }
  });

  test.each(['balance', 'unclaimed-gas', 'nep17-transfers', 'nep11-balances', 'nep11-transfers'])(
    'rejects a checksum-invalid address on the %s account route',
    async (route) => {
      const neoService = {
        getBalance: jest.fn(),
        getUnclaimedGas: jest.fn(),
        getNep17Transfers: jest.fn(),
        getNep11Balances: jest.fn(),
        getNep11Transfers: jest.fn(),
        getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      } as any;
      const server = new HttpServer(neoService, {} as any, {} as any, 0);
      const port = await waitForPort(server);

      try {
        const response = await request(port, `/api/accounts/NbMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/${route}`);
        expect(response.statusCode).toBe(400);
        expect(Object.values(neoService).filter((value) => jest.isMockFunction(value))
          .every((mock: any) => mock.mock.calls.length === 0)).toBe(true);
      } finally {
        await server.stop();
      }
    }
  );

  test('serves unauthenticated liveness without depending on the Neo RPC', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockRejectedValue(new Error('secret upstream RPC failure')),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      apiKey: 'a'.repeat(32)
    });
    const port = await waitForPort(server);

    try {
      const liveness = await request(port, '/live');
      expect(liveness.statusCode).toBe(200);
      expect(JSON.parse(liveness.body)).toMatchObject({ status: 'alive' });
      expect(neoService.getBlockCount).not.toHaveBeenCalled();

      const readiness = await request(port, '/health');
      expect(readiness.statusCode).toBe(503);
      expect(JSON.parse(readiness.body)).toMatchObject({
        status: 'unhealthy',
        error: 'Neo RPC unavailable',
      });
      expect(readiness.body).not.toContain('secret upstream RPC failure');
      expect(neoService.getBlockCount).toHaveBeenCalledTimes(1);
    } finally {
      await server.stop();
    }
  });

  test('exposes prometheus-style metrics', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(456),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/metrics');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('neo_n3_mcp_uptime_seconds');
      expect(response.body).toContain('neo_n3_mcp_block_height{network="mainnet"} 455');
    } finally {
      await server.stop();
    }
  });

  test('reports block count and latest block height without an off-by-one error', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(456),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/blockchain/height');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ blockCount: 456, height: 455 });
    } finally {
      await server.stop();
    }
  });

  test('sanitizes stored wallet responses', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;
    const walletService = {
      getWallet: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        encryptedPrivateKey: 'secret-nep2',
        encryptedWIF: 'legacy-secret-nep2',
        WIF: 'raw-wif-secret',
        privateKey: 'raw-private-key-secret',
        createdAt: '2026-03-06T00:00:00.000Z'
      })
    } as any;

    const server = new HttpServer(neoService, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        createdAt: '2026-03-06T00:00:00.000Z'
      });
    } finally {
      await server.stop();
    }
  });

  test('serves transaction application logs', async () => {
    const neoService = {
      getApplicationLog: jest.fn().mockResolvedValue(mockApplicationLog),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const txid = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const response = await request(port, `/api/transactions/${txid}/application-log`);
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('txid', '0xabc');
      expect(payload.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(payload.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect(neoService.getApplicationLog).toHaveBeenCalledWith(txid);
    } finally {
      await server.stop();
    }
  });

  test('serves nep17 transfer history for an address', async () => {
    const neoService = {
      getNep17Transfers: jest.fn().mockResolvedValue(mockNep17Transfers),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep17-transfers?fromTimestampMs=0&toTimestampMs=1710000000000');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.sent[0]).toMatchObject({
        direction: 'sent',
        timestampIso: new Date(1710000000000).toISOString(),
      });
      expect(payload.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect(neoService.getNep17Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000000000,
      });
    } finally {
      await server.stop();
    }
  });

  test('serves nep11 balances for an address', async () => {
    const neoService = {
      getNep11Balances: jest.fn().mockResolvedValue(mockNep11Balances),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep11-balances');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.balance[0]).toMatchObject({
        assethash: mockNep11AssetHash,
        amount: '2',
      });
      expect(payload.balance[0].asset).toMatchObject({
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      });
      expect(neoService.getNep11Balances).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    } finally {
      await server.stop();
    }
  });

  test('serves nep11 transfer history for an address', async () => {
    const neoService = {
      getNep11Transfers: jest.fn().mockResolvedValue(mockNep11Transfers),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep11-transfers?fromTimestampMs=0&toTimestampMs=1710000002000');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.sent[0]).toMatchObject({
        tokenid: 'nft-1',
        direction: 'sent',
        timestampIso: new Date(1710000002000).toISOString(),
      });
      expect(payload.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect(neoService.getNep11Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000002000,
      });
    } finally {
      await server.stop();
    }
  });

  test('wait route parses polling options', async () => {
    const neoService = {
      waitForTransaction: jest.fn().mockResolvedValue({
        txid: '0xabc',
        confirmed: true,
        blockHeight: 999,
        applicationLog: mockApplicationLog,
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const txid = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const response = await request(port, `/api/transactions/${txid}/wait?timeoutMs=5000&pollIntervalMs=250&includeApplicationLog=true`);
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toMatchObject({ txid: '0xabc', confirmed: true, blockHeight: 999 });
      expect(payload.applicationLog.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(payload.applicationLog.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect(neoService.waitForTransaction).toHaveBeenCalledWith(txid, {
        timeoutMs: 5000,
        pollIntervalMs: 250,
        includeApplicationLog: true,
        signal: expect.any(AbortSignal),
      });
    } finally {
      await server.stop();
    }
  });

  test('wait route rejects malformed polling options before calling Neo RPC', async () => {
    const neoService = {
      waitForTransaction: jest.fn().mockResolvedValue({ confirmed: false }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);
    const txid = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    try {
      for (const query of [
        'timeoutMs=abc',
        'timeoutMs=0',
        'timeoutMs=-1',
        'timeoutMs=1.5',
        'timeoutMs=9007199254740992',
        'timeoutMs=120001',
        'pollIntervalMs=none',
        'pollIntervalMs=249',
        'includeApplicationLog=yes',
      ]) {
        const response = await request(port, `/api/transactions/${txid}/wait?${query}`);
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toMatchObject({
          error: expect.stringMatching(/must (?:be (?:a positive integer|true or false|at least)|not exceed)/),
        });
      }

      expect(neoService.waitForTransaction).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('aborts transaction polling when the HTTP client disconnects', async () => {
    let resolveWaitStarted: (() => void) | undefined;
    const waitStarted = new Promise<void>((resolve) => {
      resolveWaitStarted = resolve;
    });
    let observedSignal: AbortSignal | undefined;
    const neoService = {
      waitForTransaction: jest.fn().mockImplementation((_txid: string, options: { signal: AbortSignal }) => {
        observedSignal = options.signal;
        resolveWaitStarted?.();
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Operation aborted');
            error.name = 'OperationAbortedError';
            reject(error);
          }, { once: true });
        });
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);
    const txid = `0x${'a'.repeat(64)}`;
    const clientRequest = http.request({
      hostname: '127.0.0.1',
      port,
      path: `/api/transactions/${txid}/wait`,
      method: 'GET',
    });
    clientRequest.on('error', () => undefined);
    clientRequest.end();

    try {
      await waitStarted;
      const aborted = new Promise<void>((resolve) => {
        observedSignal?.addEventListener('abort', () => resolve(), { once: true });
      });
      clientRequest.destroy();
      await expect(aborted).resolves.toBeUndefined();
      expect(observedSignal?.aborted).toBe(true);
    } finally {
      clientRequest.destroy();
      await server.stop();
    }
  });

  test('force-closes requests that ignore cancellation after the shutdown grace period', async () => {
    let resolveWaitStarted: (() => void) | undefined;
    const waitStarted = new Promise<void>((resolve) => {
      resolveWaitStarted = resolve;
    });
    const neoService = {
      waitForTransaction: jest.fn().mockImplementation(() => {
        resolveWaitStarted?.();
        return new Promise(() => undefined);
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0, {
      shutdownGraceMs: 20,
    });
    const port = await waitForPort(server);
    const txid = `0x${'b'.repeat(64)}`;
    const clientRequest = http.request({
      hostname: '127.0.0.1',
      port,
      path: `/api/transactions/${txid}/wait`,
      method: 'GET',
    });
    clientRequest.on('error', () => undefined);
    clientRequest.end();

    await waitStarted;
    try {
      const stopped = await Promise.race([
        server.stop().then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
      ]);
      expect(stopped).toBe(true);
    } finally {
      clientRequest.destroy();
      await server.stop();
    }
  });

  test('serves unclaimed gas for an address', async () => {
    const neoService = {
      getUnclaimedGas: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        unclaimedGas: '123456789'
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/unclaimed-gas');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        unclaimedGas: '123456789'
      });
      expect(neoService.getUnclaimedGas).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    } finally {
      await server.stop();
    }
  });



  test('serves contract info by name or hash', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractInfo: jest.fn().mockResolvedValue({
        name: 'NeoFS',
        description: 'Decentralized storage',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operations: { operations: { transfer: { name: 'transfer' } }, count: 1, contractName: 'NeoFS', network: NeoNetwork.TESTNET, available: false },
        network: NeoNetwork.TESTNET,
        available: false
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/NeoFS');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        name: 'NeoFS',
        description: 'Decentralized storage',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operations: { operations: { transfer: { name: 'transfer' } }, count: 1, contractName: 'NeoFS', network: NeoNetwork.TESTNET, available: false },
        network: NeoNetwork.TESTNET,
        available: false
      });
      expect(contractService.getContractInfo).toHaveBeenCalledWith('NeoFS');
    } finally {
      await server.stop();
    }
  });

  test('serves contract info by Neo address reference', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractInfo: jest.fn().mockResolvedValue({
        name: 'NeoFS',
        description: 'Decentralized storage',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        address: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
        operations: { operations: { transfer: { name: 'transfer' } }, count: 1, contractName: 'NeoFS', network: NeoNetwork.TESTNET, available: true },
        network: NeoNetwork.TESTNET,
        available: true
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        name: 'NeoFS',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        available: true
      });
      expect(contractService.getContractInfo).toHaveBeenCalledWith('NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M');
    } finally {
      await server.stop();
    }
  });

  test('serves contract info for encoded contract names', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractInfo: jest.fn().mockResolvedValue({
        name: 'Flamingo USD',
        description: 'Indexed contract',
        scriptHash: '0x1005d400bcc2a56b7352f09e273be3f9933a5fb1',
        network: NeoNetwork.TESTNET,
        available: true,
        operations: { operations: {}, count: 0, contractName: 'Flamingo USD', network: NeoNetwork.TESTNET, available: true }
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/Flamingo%20USD');
      expect(response.statusCode).toBe(200);
      expect(contractService.getContractInfo).toHaveBeenCalledWith('Flamingo USD');
    } finally {
      await server.stop();
    }
  });

  test('serves contract deployment status by generic reference', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractStatus: jest.fn().mockResolvedValue({
        deployed: true,
        status: 'deployed',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        address: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
        manifestName: 'NeoFS',
        operationCount: 1,
        network: NeoNetwork.TESTNET
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M/status');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        deployed: true,
        status: 'deployed',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
      });
      expect(contractService.getContractStatus).toHaveBeenCalledWith('NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M');
    } finally {
      await server.stop();
    }
  });

  test('serves contract deployment status for encoded contract names', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractStatus: jest.fn().mockResolvedValue({
        deployed: true,
        status: 'deployed',
        scriptHash: '0x1005d400bcc2a56b7352f09e273be3f9933a5fb1',
        manifestName: 'Flamingo USD',
        network: NeoNetwork.TESTNET
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/Flamingo%20USD/status');
      expect(response.statusCode).toBe(200);
      expect(contractService.getContractStatus).toHaveBeenCalledWith('Flamingo USD');
    } finally {
      await server.stop();
    }
  });

  test('returns a resource error for unresolved contract names', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContractInfo: jest.fn().mockRejectedValue(new Error('Unable to resolve contract reference "bridge". Provide a known contract name, script hash, or Neo address.'))
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/bridge');
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Resource not found',
        details: 'Unable to resolve contract reference "bridge". Provide a known contract name, script hash, or Neo address.',
        path: '/api/contracts/bridge',
        method: 'GET'
      });
    } finally {
      await server.stop();
    }
  });

  test('rejects named contract invocation when the contract is not live on the current network', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeReadContract: jest.fn()
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockRejectedValue(new Error('Contract NeoFS is not deployed on testnet')),
      isContractDeployed: jest.fn().mockResolvedValue(false)
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'balanceOf',
          args: []
        }
      });
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Resource not found',
        details: 'Contract NeoFS is not deployed on testnet',
        path: '/api/contracts/invoke',
        method: 'POST'
      });
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('invokes contracts via generic HTTP route using contractName', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'balanceOf',
          args: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ state: 'HALT', stack: [{ value: '100' }] });
      expect(contractService.invokeReadContract).toHaveBeenCalledWith('NeoFS', 'balanceOf', []);
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('invokes contracts via generic HTTP route using a Neo address reference', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contract: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
          operation: 'balanceOf',
          args: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ state: 'HALT', stack: [{ value: '100' }] });
      expect(contractService.invokeReadContract).toHaveBeenCalledWith('NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M', 'balanceOf', []);
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });



  test('rejects named write contract targets', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeContract: jest.fn().mockResolvedValue({ txid: '0xneo' })
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      invokeWriteContract: jest.fn().mockResolvedValue({ txid: '0xcontract' })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'transfer',
          args: [],
          fromWIF: TEST_WIF,
          confirm: true
        }
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: expect.stringMatching(/must use \/api\/contracts\/invoke\/write/i),
      });
      expect(contractService.invokeWriteContract).not.toHaveBeenCalled();
      expect(neoService.invokeContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('supports stateless wallet import without a password', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;
    const walletService = {
      importWallet: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key'
      })
    } as any;

    const server = new HttpServer(neoService, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets/import', {
        method: 'POST',
        body: {
          privateKeyOrWIF: TEST_WIF
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key'
      });
      expect(walletService.importWallet).toHaveBeenCalledWith(TEST_WIF, undefined);
    } finally {
      await server.stop();
    }
  });

  test('never returns encrypted key material from persisted wallet administration', async () => {
    const walletService = {
      createWallet: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        encryptedPrivateKey: 'secret-nep2',
        encryptedWIF: 'legacy-secret-nep2',
        keyFormat: 'nep2',
        createdAt: '2026-07-10T00:00:00.000Z',
      }),
    } as any;
    const server = new HttpServer({ getNetwork: () => NeoNetwork.TESTNET } as any, walletService, {} as any, 0, {
      walletAdministrationEnabled: true,
    });
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets', {
        method: 'POST',
        body: { password: 'strong-password' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        keyFormat: 'nep2',
        createdAt: '2026-07-10T00:00:00.000Z',
      });
      expect(response.body).not.toMatch(/encrypted|secret-nep2/i);
    } finally {
      await server.stop();
    }
  });

  test('rejects disabled write routes before parsing secret-bearing bodies', async () => {
    const neoService = {
      transferAssets: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers', {
        method: 'POST',
        rawBody: '{not-json',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({ error: 'State-changing operations are disabled' });
      expect(neoService.transferAssets).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('creates a durable write intent and requires a separate approval principal', async () => {
    const apiKey = 'initial-request-api-key-1234567890';
    const approvalApiKey = 'independent-approval-key-1234567890';
    const intent = {
      intentId: 'a'.repeat(64),
      fingerprint: 'b'.repeat(64),
      state: 'awaiting_approval',
      operation: 'transfer_assets',
      network: NeoNetwork.TESTNET,
      signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      payload: {
        toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
        asset: 'GAS',
        amount: '1',
      },
      createdAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    };
    const writeCoordinator = {
      signerAddress: intent.signerAddress,
      reserve: jest.fn().mockReturnValue(intent),
      get: jest.fn().mockReturnValue(intent),
      approve: jest.fn().mockReturnValue({ ...intent, state: 'approved' }),
      execute: jest.fn().mockResolvedValue({ txid: `0x${'c'.repeat(64)}` }),
    } as any;
    const neoService = { getNetwork: () => NeoNetwork.TESTNET } as any;
    const contractService = { getNetwork: () => NeoNetwork.TESTNET } as any;
    const server = new HttpServer(neoService, {} as any, contractService, 0, {
      apiKey,
      writesEnabled: true,
      writeApprovalApiKey: approvalApiKey,
      writeCoordinator,
    });
    const port = await waitForPort(server);

    try {
      const created = await request(port, '/api/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Idempotency-Key': 'transfer-request-http-001',
        },
        body: {
          network: NeoNetwork.TESTNET,
          toAddress: intent.payload.toAddress,
          asset: intent.payload.asset,
          amount: intent.payload.amount,
        },
      });
      expect(created.statusCode).toBe(202);
      expect(JSON.parse(created.body)).toMatchObject({
        intentId: intent.intentId,
        fingerprint: intent.fingerprint,
        state: 'awaiting_approval',
        signerAddress: intent.signerAddress,
      });
      expect(writeCoordinator.reserve).toHaveBeenCalledWith('transfer-request-http-001', {
        operation: 'transfer_assets',
        network: NeoNetwork.TESTNET,
        payload: intent.payload,
      });

      const wrongPrincipal = await request(
        port,
        `/api/write-intents/${intent.intentId}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: { fingerprint: intent.fingerprint },
        },
      );
      expect(wrongPrincipal.statusCode).toBe(401);

      const approved = await request(
        port,
        `/api/write-intents/${intent.intentId}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${approvalApiKey}` },
          body: { fingerprint: intent.fingerprint },
        },
      );
      expect(approved.statusCode).toBe(200);
      expect(JSON.parse(approved.body)).toEqual({ txid: `0x${'c'.repeat(64)}` });
      expect(writeCoordinator.approve).toHaveBeenCalledWith(intent.intentId, intent.fingerprint);
      expect(writeCoordinator.execute).toHaveBeenCalledWith(
        intent.intentId,
        neoService,
        contractService,
      );
    } finally {
      await server.stop();
    }
  });

  test('serves block details by hash as well as height', async () => {
    const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const neoService = {
      getBlock: jest.fn().mockResolvedValue({ hash: blockHash, index: 1234 }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, `/api/blocks/${blockHash}`);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ hash: blockHash, index: 1234 });
      expect(neoService.getBlock).toHaveBeenCalledWith(blockHash);
    } finally {
      await server.stop();
    }
  });

  test.each([
    String(Number.MAX_SAFE_INTEGER + 1),
    '12.5',
    'not-a-block-hash',
  ])('rejects an invalid block selector before calling Neo RPC: %s', async (blockSelector) => {
    const neoService = {
      getBlock: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, `/api/blocks/${blockSelector}`);
      expect(response.statusCode).toBe(400);
      expect(neoService.getBlock).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('rejects a short transaction hash before calling Neo RPC', async () => {
    const neoService = {
      getTransaction: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transactions/abc123');
      expect(response.statusCode).toBe(400);
      expect(neoService.getTransaction).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('estimates transfer fees via HTTP', async () => {
    const estimate = {
      networkFeeDatos: '10000000',
      systemFeeDatos: '5000000',
      networkFeeGas: '0.1',
      systemFeeGas: '0.05',
    };
    const neoService = {
      calculateTransferFee: jest.fn().mockResolvedValue(estimate),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers/estimate-fees', {
        method: 'POST',
        body: {
          fromAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          asset: 'NEO',
          amount: '1'
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(estimate);
      expect(neoService.calculateTransferFee).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'NEO', '1');
    } finally {
      await server.stop();
    }
  });

  test('estimates invoke fees via HTTP using contractName', async () => {
    const estimate = {
      networkFeeDatos: '20000000',
      systemFeeDatos: '7000000',
      networkFeeGas: '0.2',
      systemFeeGas: '0.07',
    };
    const neoService = {
      calculateInvokeFee: jest.fn().mockResolvedValue(estimate),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      getContractScriptHash: jest.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
      resolveContractScriptHash: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678')
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke/estimate-fees', {
        method: 'POST',
        body: {
          signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          contractName: 'NeoFS',
          operation: 'transfer',
          args: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(estimate);
      expect(contractService.resolveContractScriptHash).toHaveBeenCalledWith('NeoFS');
      expect(neoService.calculateInvokeFee).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', '0x1234567890abcdef1234567890abcdef12345678', 'transfer', []);
    } finally {
      await server.stop();
    }
  });

  test('rejects structurally invalid write and fee bodies before service dispatch', async () => {
    const neoService = {
      calculateTransferFee: jest.fn().mockResolvedValue({}),
      transferAssets: jest.fn().mockResolvedValue({ txid: '0xtransfer' }),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT' }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const walletService = {
      createWallet: jest.fn().mockResolvedValue({ address: 'wallet' }),
    } as any;
    const contractService = {
      deployContract: jest.fn().mockResolvedValue({ txid: '0xdeploy' }),
    } as any;
    const writeCoordinator = { reserve: jest.fn() } as any;
    const server = new HttpServer(neoService, walletService, contractService, 0, {
      writesEnabled: true,
      walletAdministrationEnabled: true,
      writeApprovalApiKey: 'independent-approval-key-1234567890',
      writeCoordinator,
    });
    const port = await waitForPort(server);
    const address = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';

    try {
      const responses = await Promise.all([
        request(port, '/api/transfers/estimate-fees', {
          method: 'POST',
          body: { fromAddress: address, toAddress: address, asset: {}, amount: '1' },
        }),
        request(port, '/api/transfers', {
          method: 'POST',
          body: { network: NeoNetwork.TESTNET, toAddress: {}, asset: 'NEO', amount: '1' },
        }),
        request(port, '/api/contracts/invoke', {
          method: 'POST',
          body: {
            scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
            operation: {},
            args: {},
          },
        }),
        request(port, '/api/contracts/deploy', {
          method: 'POST',
          body: { network: NeoNetwork.TESTNET, nef: {}, manifest: [] },
        }),
        request(port, '/api/wallets', {
          method: 'POST',
          body: { password: {} },
        }),
      ]);

      for (const response of responses) {
        expect(response.statusCode).toBe(400);
      }
      expect(neoService.calculateTransferFee).not.toHaveBeenCalled();
      expect(neoService.transferAssets).not.toHaveBeenCalled();
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
      expect(contractService.deployContract).not.toHaveBeenCalled();
      expect(writeCoordinator.reserve).not.toHaveBeenCalled();
      expect(walletService.createWallet).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test.each([false, null, 0])(
    'rejects explicit non-array contract args across estimate, read, and write routes (%p)',
    async (args) => {
      const neoService = {
        calculateInvokeFee: jest.fn(),
        invokeReadContract: jest.fn(),
        invokeContract: jest.fn(),
        getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      } as any;
      const contractService = {
        assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      } as any;
      const writeCoordinator = { reserve: jest.fn() } as any;
      const server = new HttpServer(neoService, {} as any, contractService, 0, {
        writesEnabled: true,
        writeApprovalApiKey: 'independent-approval-key-1234567890',
        writeCoordinator,
      });
      const port = await waitForPort(server);
      const scriptHash = '0x1234567890abcdef1234567890abcdef12345678';

      try {
        const responses = await Promise.all([
          request(port, '/api/contracts/invoke/estimate-fees', {
            method: 'POST',
            body: {
              signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
              scriptHash,
              operation: 'symbol',
              args,
            },
          }),
          request(port, '/api/contracts/invoke', {
            method: 'POST',
            body: { scriptHash, operation: 'symbol', args },
          }),
          request(port, '/api/contracts/invoke/write', {
            method: 'POST',
            body: { network: NeoNetwork.TESTNET, scriptHash, operation: 'transfer', args },
          }),
        ]);

        for (const response of responses) {
          expect(response.statusCode).toBe(400);
          expect(JSON.parse(response.body)).toEqual({ error: 'args must be an array' });
        }
        expect(neoService.calculateInvokeFee).not.toHaveBeenCalled();
        expect(neoService.invokeReadContract).not.toHaveBeenCalled();
        expect(neoService.invokeContract).not.toHaveBeenCalled();
        expect(writeCoordinator.reserve).not.toHaveBeenCalled();
      } finally {
        await server.stop();
      }
    }
  );

  test('does not reinterpret an invalid HTTP write credential as a read invocation', async () => {
    const neoService = {
      invokeReadContract: jest.fn(),
      invokeContract: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn(),
    } as any;
    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          fromWIF: '',
          scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
          operation: 'transfer',
          args: [],
          confirm: true,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
      expect(neoService.invokeContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });
});
