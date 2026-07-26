// Neo N3 endpoints are configured as ordered lists so a dead seed does not take
// reads down. The singular NEO_MAINNET_RPC / NEO_TESTNET_RPC names stay working
// for existing deployments, and mainnetRpcUrl/testnetRpcUrl stay readable as the
// primary entry.

describe('Neo N3 RPC endpoint lists', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function withEnv(vars: Record<string, string | undefined>, assertions: (config: any) => void) {
    for (const key of [
      'NEO_MAINNET_RPC', 'NEO_MAINNET_RPC_URL', 'NEO_MAINNET_RPC_URLS',
      'NEO_TESTNET_RPC', 'NEO_TESTNET_RPC_URL', 'NEO_TESTNET_RPC_URLS',
    ]) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.isolateModules(() => {
      const { config } = require('../src/config');
      assertions(config);
    });
  }

  test('defaults ship more than one mainnet and testnet endpoint', () => {
    withEnv({}, (config) => {
      expect(config.mainnetRpcUrls.length).toBeGreaterThan(1);
      expect(config.testnetRpcUrls.length).toBeGreaterThan(1);
      // Every default must be a distinct HTTPS URL: duplicates would look like
      // redundancy while providing none.
      expect(new Set(config.mainnetRpcUrls).size).toBe(config.mainnetRpcUrls.length);
      for (const url of [...config.mainnetRpcUrls, ...config.testnetRpcUrls]) {
        expect(url).toMatch(/^https:\/\//);
      }
    });
  });

  test('does not default to mainnet1.neo.coz.io, which is dead', () => {
    // Pinned deliberately: this endpoint returned Cloudflare 520 on every attempt
    // and its being the sole default is what took mainnet reads out entirely.
    withEnv({}, (config) => {
      expect(config.mainnetRpcUrls.join(',')).not.toContain('mainnet1.neo.coz.io');
      expect(config.mainnetRpcUrl).not.toContain('mainnet1.neo.coz.io');
    });
  });

  test('NEO_MAINNET_RPC_URLS parses a comma-separated list', () => {
    withEnv({ NEO_MAINNET_RPC_URLS: 'https://a.example, https://b.example ,https://c.example' }, (config) => {
      expect(config.mainnetRpcUrls).toEqual([
        'https://a.example',
        'https://b.example',
        'https://c.example',
      ]);
    });
  });

  test('the singular env var still works and becomes the only entry', () => {
    withEnv({ NEO_MAINNET_RPC: 'https://solo.example' }, (config) => {
      expect(config.mainnetRpcUrls).toEqual(['https://solo.example']);
      expect(config.mainnetRpcUrl).toBe('https://solo.example');
    });
  });

  test('the plural env var wins over the singular one', () => {
    withEnv({
      NEO_MAINNET_RPC: 'https://singular.example',
      NEO_MAINNET_RPC_URLS: 'https://plural-a.example,https://plural-b.example',
    }, (config) => {
      expect(config.mainnetRpcUrls).toEqual(['https://plural-a.example', 'https://plural-b.example']);
      expect(config.mainnetRpcUrl).toBe('https://plural-a.example');
    });
  });

  test('mainnetRpcUrl / testnetRpcUrl mirror the first list entry', () => {
    withEnv({
      NEO_MAINNET_RPC_URLS: 'https://m1.example,https://m2.example',
      NEO_TESTNET_RPC_URLS: 'https://t1.example,https://t2.example',
    }, (config) => {
      expect(config.mainnetRpcUrl).toBe('https://m1.example');
      expect(config.testnetRpcUrl).toBe('https://t1.example');
    });
  });

  test('validateConfig rejects a bad URL anywhere in the list, not just first', () => {
    // A typo in the third entry must not sit undetected until the first two nodes fail.
    process.env.NEO_MAINNET_RPC_URLS = 'https://good.example,https://also-good.example,not-a-url';
    delete process.env.NEO_ALLOW_INSECURE_RPC;
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).toThrow(/NEO_MAINNET_RPC/);
    });
  });

  test('validateConfig rejects plaintext HTTP in a list entry', () => {
    process.env.NEO_TESTNET_RPC_URLS = 'https://good.example,http://insecure.example';
    delete process.env.NEO_ALLOW_INSECURE_RPC;
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).toThrow(/NEO_TESTNET_RPC/);
    });
  });

  test('validateConfig accepts a fully valid list', () => {
    process.env.NEO_MAINNET_RPC_URLS = 'https://good.example,https://also-good.example';
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).not.toThrow();
    });
  });
});
