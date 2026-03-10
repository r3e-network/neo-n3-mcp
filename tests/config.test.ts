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

  test('supports overriding and disabling the N3Index resolver', () => {
    process.env.N3INDEX_API_BASE_URL = 'https://example-n3index.test';
    process.env.N3INDEX_ENABLED = 'false';

    jest.isolateModules(() => {
      const { config } = require('../src/config');
      expect(config.n3index.baseUrl).toBe('https://example-n3index.test');
      expect(config.n3index.enabled).toBe(false);
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
});
