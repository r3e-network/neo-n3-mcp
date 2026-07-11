/**
 * Logging utility for Neo N3 MCP Server
 * Provides structured logging to console and/or file
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LOG_FILES = 3;

/**
 * Rotate log file: current → .1 → .2 → .3 (oldest deleted)
 */
export function rotateLogFile(
  logPath: string,
  maxSize: number = MAX_LOG_SIZE,
  maxFiles: number = MAX_LOG_FILES
): void {
  try {
    if (!fs.existsSync(logPath)) return;

    const stats = fs.statSync(logPath);
    if (stats.size < maxSize) return;

    // Cascade: .2→.3, .1→.2, current→.1
    for (let i = maxFiles; i >= 1; i--) {
      const from = i === 1 ? logPath : `${logPath}.${i - 1}`;
      const to = `${logPath}.${i}`;
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
    }

    // Delete anything beyond maxFiles
    const beyond = `${logPath}.${maxFiles + 1}`;
    if (fs.existsSync(beyond)) {
      fs.unlinkSync(beyond);
    }
  } catch (error) {
    console.error(`Log rotation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_LOG_CONSOLE = !(process.env.NODE_ENV || '').toLowerCase().includes('test');
const DEFAULT_LOG_FILE_PATH = './logs/neo-n3-mcp.log';
const LOGGER_HOOKS_REGISTERED = '__neoN3McpLoggerHooksRegistered__';
const REDACTED = '[REDACTED]';
const SENSITIVE_CONTEXT_KEY = /(?:^|_)(?:args?|arguments?|authorization|api_?key|password|private_?key|secret|token|wif)(?:$|_)/i;
const SENSITIVE_CONTEXT_KEY_SUFFIX = /(?:authorization|apiKey|password|privateKey|secret|accessToken|bearerToken|wif)$/i;
const URL_CONTEXT_KEY = /(?:url|uri|endpoint|rpcaddress)$/i;
const WIF_TEXT_PATTERN = /(?<![1-9A-HJ-NP-Za-km-z])[KL][1-9A-HJ-NP-Za-km-z]{51}(?![1-9A-HJ-NP-Za-km-z])/g;

function sanitizeUrl(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return REDACTED;
  }
}

function sanitizeText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url))
    .replace(WIF_TEXT_PATTERN, REDACTED);
}

function sanitizeLogValue(value: unknown, key: string, seen: WeakSet<object>): unknown {
  if (SENSITIVE_CONTEXT_KEY.test(key) || SENSITIVE_CONTEXT_KEY_SUFFIX.test(key)) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return URL_CONTEXT_KEY.test(key) ? sanitizeUrl(value) : sanitizeText(value);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry, '', seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeLogValue(entryValue, entryKey, seen),
    ])
  );
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>();
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeLogValue(value, key, seen)])
  );
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logToConsole: boolean;
  private logToFile: boolean;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;
  private writeCount = 0;

  private constructor() {
    const loggingConfig = config.logging;
    this.logLevel = this.stringToLogLevel(loggingConfig?.level || DEFAULT_LOG_LEVEL);
    this.logToConsole = loggingConfig?.console !== undefined ? loggingConfig.console : DEFAULT_LOG_CONSOLE;
    this.logToFile = Boolean(loggingConfig?.fileEnabled);
    this.logFilePath = loggingConfig?.filePath || DEFAULT_LOG_FILE_PATH;

    if (this.logToFile) {
      try {
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.openLogStream();
      } catch (error) {
        console.error(`Failed to create log stream: ${error instanceof Error ? error.message : String(error)}`);
        this.logToFile = false;
      }
    }
  }

  private stringToLogLevel(level?: string): LogLevel {
    switch ((level || DEFAULT_LOG_LEVEL).toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(sanitizeContext(context))}` : '';
    return `[${timestamp}] [${level}] ${sanitizeText(message)}${contextStr}`;
  }

  private openLogStream(): void {
    try {
      const stream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      stream.on('error', (error) => {
        if (this.logStream === stream) {
          this.logStream = null;
          this.logToFile = false;
        }
        console.error(`Log stream failed: ${error.message}`);
      });
      this.logStream = stream;
    } catch (error) {
      this.logStream = null;
      this.logToFile = false;
      console.error(`Failed to create log stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: Record<string, unknown>): void {
    if (level < this.logLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(levelStr, message, context);

    if (this.logToConsole) {
      // MCP reserves stdout for JSON-RPC frames, so every diagnostic uses stderr.
      console.error(formattedMessage);
    }

    if (this.logToFile && this.logStream) {
      try {
        this.logStream.write(formattedMessage + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.writeCount++;
      if (this.writeCount % 100 === 0) {
        rotateLogFile(this.logFilePath);
        if (!fs.existsSync(this.logFilePath)) {
          this.logStream.end();
          this.logStream = null;
          this.openLogStream();
        }
      }
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }

  public close(): void {
    if (this.logStream) {
      try {
        this.logStream.end();
      } catch (error) {
        console.error(`Error closing log stream: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.logStream = null;
      }
    }
  }
}

export const logger = Logger.getInstance();

const closeLogger = () => logger.close();
const loggerGlobalState = globalThis as typeof globalThis & { [LOGGER_HOOKS_REGISTERED]?: boolean };

if (!loggerGlobalState[LOGGER_HOOKS_REGISTERED]) {
  process.once('exit', closeLogger);
  loggerGlobalState[LOGGER_HOOKS_REGISTERED] = true;
}
