describe('Config environment variable compatibility', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('prefers documented RPC environment variable names', () => {
    process.env.NEO_MAINNET_RPC = 'https://mainnet.example.org';
    process.env.NEO_TESTNET_RPC = 'https://testnet.example.org';
    delete process.env.NEO_MAINNET_RPC_URL;
    delete process.env.NEO_TESTNET_RPC_URL;

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.mainnetRpcUrl).toBe('https://mainnet.example.org');
      expect(config.testnetRpcUrl).toBe('https://testnet.example.org');
    });
  });

  test('supports the documented NEO_NETWORK alias', () => {
    process.env.NEO_NETWORK = 'testnet';
    delete process.env.NEO_NETWORK_MODE;

    jest.isolateModules(() => {
      const { config, NetworkMode } = require('../src/config');
      expect(config.networkMode).toBe(NetworkMode.TESTNET_ONLY);
    });
  });

  test('falls back to legacy RPC environment variable names', () => {
    delete process.env.NEO_MAINNET_RPC;
    delete process.env.NEO_TESTNET_RPC;
    process.env.NEO_MAINNET_RPC_URL = 'https://legacy-mainnet.example.org';
    process.env.NEO_TESTNET_RPC_URL = 'https://legacy-testnet.example.org';

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.mainnetRpcUrl).toBe('https://legacy-mainnet.example.org');
      expect(config.testnetRpcUrl).toBe('https://legacy-testnet.example.org');
    });
  });

  test('loads the Neo RPC timeout from the environment', () => {
    process.env.NEO_RPC_TIMEOUT_MS = '2500';

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.rpcTimeoutMs).toBe(2500);
    });
  });

  test('uses a transaction fee ceiling with deployment headroom by default', () => {
    delete process.env.NEO_MAX_TRANSACTION_FEE_GAS;

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.maxTransactionFeeGas).toBe('20');
    });
  });

  test('disables all state-changing tools by default', () => {
    delete process.env.NEO_ENABLE_WRITES;

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.writes.enabled).toBe(false);
    });
  });

  test('supports overriding and disabling the N3Index resolver', () => {
    process.env.N3INDEX_API_BASE_URL = 'https://example-n3index.test';
    process.env.N3INDEX_ENABLED = 'false';

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.n3index.baseUrl).toBe('https://example-n3index.test');
      expect(config.n3index.enabled).toBe(false);
    });
  });

  test('loads HTTP and wallet storage settings from the environment', () => {
    process.env.HTTP_HOST = '127.0.0.2';
    process.env.HTTP_API_KEY = 'a'.repeat(32);
    process.env.HTTP_CORS_ORIGINS = 'https://one.example, https://two.example';
    process.env.HTTP_MAX_BODY_BYTES = '2048';
    process.env.HTTP_TRUSTED_PROXIES = '127.0.0.1/32, 192.0.2.20';
    process.env.WALLETS_DIR = '/tmp/neo-wallets';

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.http).toEqual({
        host: '127.0.0.2',
        apiKey: 'a'.repeat(32),
        corsOrigins: ['https://one.example', 'https://two.example'],
        maxBodyBytes: 2048,
        trustedProxies: ['127.0.0.1/32', '192.0.2.20']
      });
      expect(config.wallets.directory).toBe('/tmp/neo-wallets');
    });
  });


  test('http entrypoint requires an explicit single network mode', () => {
    jest.isolateModules(() => {
      const { NetworkMode } = require('../src/config');
      const { resolveHttpNetwork } = require('../src/http');

      expect(() => resolveHttpNetwork(NetworkMode.BOTH)).toThrow('HTTP entrypoint requires NEO_NETWORK=mainnet or NEO_NETWORK=testnet');
      expect(resolveHttpNetwork(NetworkMode.MAINNET_ONLY)).toBe('mainnet');
      expect(resolveHttpNetwork(NetworkMode.TESTNET_ONLY)).toBe('testnet');
    });
  });

  test('http entrypoint requires authentication on non-loopback hosts', () => {
    jest.isolateModules(() => {
      const { resolveHttpSecurity } = require('../src/http');

      expect(() => resolveHttpSecurity('0.0.0.0', undefined)).toThrow(/HTTP_API_KEY/);
      expect(() => resolveHttpSecurity('::', undefined)).toThrow(/HTTP_API_KEY/);
      expect(resolveHttpSecurity('127.0.0.1', undefined)).toBeUndefined();
      expect(resolveHttpSecurity('localhost', undefined)).toBeUndefined();
      expect(resolveHttpSecurity('0.0.0.0', 'a'.repeat(32))).toBe('a'.repeat(32));
    });
  });

  test.each(['3000x', '1e3', '0x10', '-1', '65536', ' 3000 '])(
    'http entrypoint rejects a non-canonical PORT value %s',
    (value) => {
      jest.isolateModules(() => {
        const { parsePort } = require('../src/http');
        expect(() => parsePort(value)).toThrow(/Invalid PORT/);
      });
    }
  );
});
