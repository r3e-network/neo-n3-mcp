/**
 * Logging utility for Neo N3 MCP Server
 * Provides structured logging to console and/or file
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';

/**
 * Log levels enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Logger class - singleton pattern
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logToConsole: boolean;
  private logToFile: boolean;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;
  
  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.logLevel = this.stringToLogLevel(config.logging.level);
    this.logToConsole = config.logging.console;
    this.logToFile = config.logging.file;
    this.logFilePath = config.logging.filePath;
    
    if (this.logToFile) {
      try {
        // Ensure directory exists
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
  
  /**
   * Convert string log level to enum
   * @param level Log level string
   * @returns LogLevel enum value
   */
  private stringToLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }
  
  /**
   * Get singleton instance
   * @returns Logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * Format log message with timestamp and context
   * @param level Log level string
   * @param message Log message
   * @param context Optional context object
   * @returns Formatted message
   */
  private formatMessage(level: string, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }
  
  /**
   * Internal log method
   * @param level Log level
   * @param levelStr Log level string
   * @param message Log message
   * @param context Optional context object
   */
  private log(level: LogLevel, levelStr: string, message: string, context?: Record<string, any>): void {
    if (level < this.logLevel) {
      return;
    }
    
    const formattedMessage = this.formatMessage(levelStr, message, context);
    
    if (this.logToConsole) {
      const consoleMethod = level === LogLevel.ERROR ? console.error :
                            level === LogLevel.WARN ? console.warn :
                            level === LogLevel.INFO ? console.info :
                            console.debug;
      consoleMethod(formattedMessage);
    }
    
    if (this.logToFile && this.logStream) {
      try {
        this.logStream.write(formattedMessage + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Log debug message
   * @param message Log message
   * @param context Optional context object
   */
  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }
  
  /**
   * Log info message
   * @param message Log message
   * @param context Optional context object
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }
  
  /**
   * Log warning message
   * @param message Log message
   * @param context Optional context object
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }
  
  /**
   * Log error message
   * @param message Log message
   * @param context Optional context object
   */
  public error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }
  
  /**
   * Close log stream
   */
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

// Create singleton instance
export const logger = Logger.getInstance();

// Add shutdown handling
process.on('exit', () => logger.close());
process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
}); 