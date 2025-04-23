import { jest } from '@jest/globals';
import { Logger, LogLevel } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock path module
jest.mock('path', () => ({
  dirname: jest.fn(() => '/mock/dir')
}));

// Mock config
jest.mock('../../src/config.js', () => ({
  config: {
    logging: {
      level: 'debug',
      console: true,
      file: true,
      filePath: '/mock/dir/neo-mcp.log'
    }
  }
}));

describe('Logger', () => {
  let originalConsole: any;

  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    // Mock console methods
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  test('Logger is a singleton', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('debug method logs to console when level is DEBUG', () => {
    // Mock existsSync to return true
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const logger = Logger.getInstance();
    logger.debug('Debug message');

    expect(console.debug).toHaveBeenCalled();
    expect((console.debug as jest.Mock).mock.calls[0][0]).toContain('[DEBUG] Debug message');
  });

  test('info method logs to console when level is INFO', () => {
    const logger = Logger.getInstance();
    logger.info('Info message');

    expect(console.info).toHaveBeenCalled();
    expect((console.info as jest.Mock).mock.calls[0][0]).toContain('[INFO] Info message');
  });

  test('warn method logs to console when level is WARN', () => {
    const logger = Logger.getInstance();
    logger.warn('Warning message');

    expect(console.warn).toHaveBeenCalled();
    expect((console.warn as jest.Mock).mock.calls[0][0]).toContain('[WARN] Warning message');
  });

  test('error method logs to console when level is ERROR', () => {
    const logger = Logger.getInstance();
    logger.error('Error message');

    expect(console.error).toHaveBeenCalled();
    expect((console.error as jest.Mock).mock.calls[0][0]).toContain('[ERROR] Error message');
  });

  test('log includes context when provided', () => {
    const logger = Logger.getInstance();
    const context = { key: 'value' };

    logger.info('Info with context', context);

    expect(console.info).toHaveBeenCalled();
    expect((console.info as jest.Mock).mock.calls[0][0]).toContain(JSON.stringify(context));
  });

  test('log creates directory if it does not exist', () => {
    // Mock existsSync to return false
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Force a new instance by clearing the singleton
    // @ts-ignore - accessing private property for testing
    Logger.instance = undefined;

    // Get a new instance to trigger constructor
    const logger = Logger.getInstance();

    // Log something to ensure the directory is created
    logger.info('Test message');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/dir', { recursive: true });
  });

  test('close method ends the log stream', () => {
    const logger = Logger.getInstance();
    const mockStream = fs.createWriteStream('');

    // Access private property for testing
    (logger as any).logStream = mockStream;

    logger.close();

    expect(mockStream.end).toHaveBeenCalled();
    expect((logger as any).logStream).toBeNull();
  });
});
