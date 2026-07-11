describe('config and logger hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEO_MAINNET_RPC_URL;
    delete process.env.NEO_TESTNET_RPC_URL;
    delete process.env.NEO_NETWORK_MODE;
    delete process.env.NEO_MAINNET_RPC;
    delete process.env.NEO_TESTNET_RPC;
    delete process.env.NEO_NETWORK;
    delete process.env.LOG_FILE_ENABLED;
    delete process.env.LOG_FILE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('config supports documented rpc and network env aliases', () => {
    process.env.NEO_MAINNET_RPC = 'https://mainnet.example/rpc';
    process.env.NEO_TESTNET_RPC = 'https://testnet.example/rpc';
    process.env.NEO_NETWORK = 'testnet';

    const { config, NetworkMode } = require('../src/config');

    expect(config.mainnetRpcUrl).toBe('https://mainnet.example/rpc');
    expect(config.testnetRpcUrl).toBe('https://testnet.example/rpc');
    expect(config.networkMode).toBe(NetworkMode.TESTNET_ONLY);
  });


  test('config disables console logging by default in test environment', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_CONSOLE;

    const { config } = require('../src/config');

    expect(config.logging.console).toBe(false);
  });



  test('config disables console logging by default for test-like environments', () => {
    process.env.NODE_ENV = 'stress_test';
    delete process.env.LOG_CONSOLE;

    const { config } = require('../src/config');

    expect(config.logging.console).toBe(false);
  });

  test('config allows explicit console logging override in test environment', () => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_CONSOLE = 'true';

    const { config } = require('../src/config');

    expect(config.logging.console).toBe(true);
  });

  test('logger only registers a single exit hook and does not swallow process signals', () => {
    process.env.NODE_ENV = 'test';

    const loggerGlobalState = globalThis as typeof globalThis & { __neoN3McpLoggerHooksRegistered__?: boolean };
    delete loggerGlobalState.__neoN3McpLoggerHooksRegistered__;

    const originalOn = process.on;
    const onSpy = jest.fn().mockReturnValue(process);
    Object.defineProperty(process, 'on', {
      configurable: true,
      writable: true,
      value: onSpy
    });

    try {
      jest.isolateModules(() => {
        require('../src/utils/logger');
      });
      jest.resetModules();
      jest.isolateModules(() => {
        require('../src/utils/logger');
      });
    } finally {
      Object.defineProperty(process, 'on', {
        configurable: true,
        writable: true,
        value: originalOn
      });
      delete loggerGlobalState.__neoN3McpLoggerHooksRegistered__;
    }

    expect(onSpy.mock.calls.filter(([event]) => event === 'exit')).toHaveLength(1);
    expect(onSpy.mock.calls.filter(([event]) => event === 'SIGINT')).toHaveLength(0);
    expect(onSpy.mock.calls.filter(([event]) => event === 'SIGTERM')).toHaveLength(0);
  });



  test('logger keeps all console output on stderr so MCP stdout remains protocol-only', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_CONSOLE = 'true';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined as any);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined as any);

    try {
      jest.isolateModules(() => {
        const { logger } = require('../src/utils/logger');
        logger.info('info-check');
        logger.warn('warn-check');
        logger.error('error-check');
      });

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] info-check'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN] warn-check'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] error-check'));
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('logger redacts contract arguments and RPC URL path or query secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_CONSOLE = 'true';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined as any);

    try {
      jest.isolateModules(() => {
        const { logger } = require('../src/utils/logger');
        logger.info('redaction-check', {
          rpcUrl: 'https://rpc.example/private-path?token=super-secret-token',
          args: ['super-secret-argument'],
        });
      });

      const output = errorSpy.mock.calls.map(([message]) => String(message)).join('\n');
      expect(output).toContain('https://rpc.example');
      expect(output).not.toContain('private-path');
      expect(output).not.toContain('super-secret-token');
      expect(output).not.toContain('super-secret-argument');
      expect(output).toContain('[REDACTED]');
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('logger redacts WIF values embedded in messages and error details', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_CONSOLE = 'true';
    const wif = new (require('@cityofzion/neon-js').wallet.Account)().WIF;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined as any);

    try {
      jest.isolateModules(() => {
        const { logger } = require('../src/utils/logger');
        logger.error(`Invalid address: ${wif}`, {
          error: `Rejected value ${wif}`,
          stack: `Error: Rejected value ${wif}`,
        });
      });

      const output = errorSpy.mock.calls.map(([message]) => String(message)).join('\n');
      expect(output).not.toContain(wif);
      expect(output).toContain('[REDACTED]');
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('logger redacts camelCase credential fields without hiding public token IDs', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_CONSOLE = 'true';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined as any);

    try {
      jest.isolateModules(() => {
        const { logger } = require('../src/utils/logger');
        logger.info('credential-field-check', {
          fromWIF: 'from-wif-secret',
          privateKeyOrWIF: 'private-key-or-wif-secret',
          wallet: {
            encryptedPrivateKey: 'encrypted-private-key-secret',
            accessToken: 'access-token-secret',
            tokenId: 'public-token-id',
          },
        });
      });

      const output = errorSpy.mock.calls.map(([message]) => String(message)).join('\n');
      expect(output).not.toContain('from-wif-secret');
      expect(output).not.toContain('private-key-or-wif-secret');
      expect(output).not.toContain('encrypted-private-key-secret');
      expect(output).not.toContain('access-token-secret');
      expect(output).toContain('public-token-id');
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('console-only logging never opens a file after the rotation interval', () => {
    process.env.LOG_FILE_ENABLED = 'false';
    process.env.LOG_CONSOLE = 'false';
    const createWriteStream = jest.fn();

    jest.doMock('fs', () => ({
      existsSync: jest.fn(),
      statSync: jest.fn(),
      renameSync: jest.fn(),
      unlinkSync: jest.fn(),
      mkdirSync: jest.fn(),
      createWriteStream,
    }));

    jest.isolateModules(() => {
      const { logger } = require('../src/utils/logger');
      for (let index = 0; index < 101; index += 1) {
        logger.info(`console-only-${index}`);
      }
    });

    expect(createWriteStream).not.toHaveBeenCalled();
  });

  test('file stream errors disable file logging without crashing the process', () => {
    process.env.LOG_FILE_ENABLED = 'true';
    process.env.LOG_CONSOLE = 'false';
    const { EventEmitter } = require('events');
    const stream = Object.assign(new EventEmitter(), {
      write: jest.fn(),
      end: jest.fn(),
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined as any);

    jest.doMock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(true),
      statSync: jest.fn(),
      renameSync: jest.fn(),
      unlinkSync: jest.fn(),
      mkdirSync: jest.fn(),
      createWriteStream: jest.fn().mockReturnValue(stream),
    }));

    try {
      jest.isolateModules(() => {
        const { logger } = require('../src/utils/logger');
        logger.info('before-stream-error');
        stream.emit('error', new Error('read-only filesystem'));
        logger.info('after-stream-error');
      });

      expect(stream.write).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/log stream failed.*read-only filesystem/i));
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('logger respects explicit file path configuration', () => {
    process.env.LOG_FILE_ENABLED = 'true';
    process.env.LOG_FILE = '/tmp/neo-config-logger-test.log';

    const createWriteStream = jest.fn().mockReturnValue({
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    });
    const existsSync = jest.fn().mockReturnValue(false);
    const mkdirSync = jest.fn();

    jest.doMock('fs', () => ({
      existsSync,
      mkdirSync,
      createWriteStream
    }));

    jest.isolateModules(() => {
      const { logger } = require('../src/utils/logger');
      logger.info('logger-path-check');
    });

    expect(mkdirSync).toHaveBeenCalledWith('/tmp', { recursive: true });
    expect(createWriteStream).toHaveBeenCalledWith('/tmp/neo-config-logger-test.log', { flags: 'a' });
  });
});
