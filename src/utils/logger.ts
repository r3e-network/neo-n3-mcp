/**
 * Logging utility for Neo N3 MCP Server
 * Provides structured logging to console and/or file
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_LOG_CONSOLE = !(process.env.NODE_ENV || '').toLowerCase().includes('test');
const DEFAULT_LOG_FILE_PATH = './logs/neo-n3-mcp.log';
const LOGGER_HOOKS_REGISTERED = '__neoN3McpLoggerHooksRegistered__';

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

  private constructor() {
    const loggingConfig = (config as any)?.logging;
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

        this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
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

  private formatMessage(level: string, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: Record<string, any>): void {
    if (level < this.logLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(levelStr, message, context);

    if (this.logToConsole) {
      if (level >= LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level >= LogLevel.WARN) {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }

    if (this.logToFile && this.logStream) {
      try {
        this.logStream.write(formattedMessage + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
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
