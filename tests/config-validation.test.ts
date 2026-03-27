describe('Config Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts valid configuration', () => {
    process.env.NEO_NETWORK = 'mainnet';
    process.env.LOG_LEVEL = 'debug';
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).not.toThrow();
    });
  });

  it('rejects invalid LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'verbose';
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).toThrow(/LOG_LEVEL/);
    });
  });

  it('rejects non-numeric MAX_REQUESTS_PER_MINUTE', () => {
    process.env.MAX_REQUESTS_PER_MINUTE = 'abc';
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).toThrow(/MAX_REQUESTS_PER_MINUTE/);
    });
  });

  it('rejects invalid RPC URL format', () => {
    process.env.NEO_MAINNET_RPC = 'not-a-url';
    jest.isolateModules(() => {
      const { validateConfig } = require('../src/config');
      expect(() => validateConfig()).toThrow(/NEO_MAINNET_RPC/);
    });
  });
});
