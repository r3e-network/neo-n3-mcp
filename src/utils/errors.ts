/**
 * Custom error types for Neo N3 MCP Server
 * Provides specialized error classes for different categories of errors
 */

export enum ErrorType {
  VALIDATION_ERROR = 'ValidationError',
  CONTRACT_ERROR = 'ContractError',
  TRANSACTION_ERROR = 'TransactionError',
  NETWORK_ERROR = 'NetworkError',
  RATE_LIMIT_ERROR = 'RateLimitError',
  INTERNAL_ERROR = 'InternalError'
}

/**
 * Base error class for all Neo MCP errors
 */
export class NeoMcpError extends Error {
  public readonly type: ErrorType;
  public readonly details?: Record<string, any>;
  
  constructor(message: string, type: ErrorType, details?: Record<string, any>) {
    super(message);
    this.name = 'NeoMcpError';
    this.type = type;
    this.details = details;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NeoMcpError);
    }
  }
  
  /**
   * Convert to a format suitable for API responses
   */
  toResponse(): Record<string, any> {
    return {
      error: {
        type: this.type,
        message: this.message,
        details: this.details
      }
    };
  }
}

/**
 * Error for invalid input parameters
 */
export class ValidationError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error for smart contract execution issues
 */
export class ContractError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.CONTRACT_ERROR, details);
    this.name = 'ContractError';
  }
}

/**
 * Error for transaction creation, signing, or submission issues
 */
export class TransactionError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.TRANSACTION_ERROR, details);
    this.name = 'TransactionError';
  }
}

/**
 * Error for network connectivity issues
 */
export class NetworkError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.NETWORK_ERROR, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.RATE_LIMIT_ERROR, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Error for internal server issues
 */
export class InternalError extends NeoMcpError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorType.INTERNAL_ERROR, details);
    this.name = 'InternalError';
  }
} 