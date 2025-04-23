import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { NeoMcpError, ErrorType } from './errors.js';
import { logger } from './logger.js';

/**
 * Error mapping from Neo N3 error messages to user-friendly messages
 */
const ERROR_MAPPINGS: Record<string, { message: string, code: ErrorCode }> = {
  // Connection errors
  'ECONNREFUSED': {
    message: 'Could not connect to Neo N3 node. Please check the node URL and try again.',
    code: ErrorCode.InternalError
  },
  'ETIMEDOUT': {
    message: 'Connection to Neo N3 node timed out. The network might be congested or the node might be down.',
    code: ErrorCode.InternalError
  },
  'ENOTFOUND': {
    message: 'Neo N3 node address not found. Please check the node URL.',
    code: ErrorCode.InternalError
  },

  // Transaction errors
  'Insufficient funds': {
    message: 'Insufficient funds to complete the transaction. Please ensure you have enough balance.',
    code: ErrorCode.InvalidParams
  },
  'Invalid signature': {
    message: 'Invalid signature. Please check your wallet credentials.',
    code: ErrorCode.InvalidParams
  },
  'Unknown asset': {
    message: 'Unknown asset. Please check the asset name or hash.',
    code: ErrorCode.InvalidParams
  },
  'Transaction rejected': {
    message: 'Transaction was rejected by the network. It might conflict with network rules.',
    code: ErrorCode.InternalError
  },
  'VM fault': {
    message: 'Smart contract execution failed. The operation could not be completed.',
    code: ErrorCode.InternalError
  },
  'Already exists': {
    message: 'Transaction already exists in the blockchain.',
    code: ErrorCode.InvalidParams
  },

  // Validation errors
  'Invalid address': {
    message: 'Invalid Neo N3 address format. Please provide a valid address.',
    code: ErrorCode.InvalidParams
  },
  'Invalid hash': {
    message: 'Invalid hash format. Please provide a valid transaction or block hash.',
    code: ErrorCode.InvalidParams
  },
  'Invalid amount': {
    message: 'Invalid amount. Please provide a valid positive number.',
    code: ErrorCode.InvalidParams
  },
  'Invalid network': {
    message: 'Invalid network. Please use "mainnet" or "testnet".',
    code: ErrorCode.InvalidParams
  },

  // Contract errors
  'Contract not found': {
    message: 'Smart contract not found. Please check the contract name or hash.',
    code: ErrorCode.InvalidParams
  },
  'Method not found': {
    message: 'Contract method not found. Please check the operation name.',
    code: ErrorCode.InvalidParams
  },
  'Invalid argument': {
    message: 'Invalid contract argument. Please check the argument types and values.',
    code: ErrorCode.InvalidParams
  }
};

/**
 * Find the appropriate error mapping based on error message
 * @param errorMessage The error message to match
 * @returns Matched error mapping or undefined
 */
function findErrorMapping(errorMessage: string): { message: string, code: ErrorCode } | undefined {
  if (!errorMessage) return undefined;

  // Check for exact matches first
  if (ERROR_MAPPINGS[errorMessage]) {
    return ERROR_MAPPINGS[errorMessage];
  }

  // Check for partial matches
  for (const key of Object.keys(ERROR_MAPPINGS)) {
    if (errorMessage.includes(key)) {
      return ERROR_MAPPINGS[key];
    }
  }

  return undefined;
}

/**
 * Handle errors and convert them to MCP-compatible error responses
 * @param error Error to handle
 * @returns MCP-compatible error response
 */
export function handleError(error: any): { error: { message: string, code: ErrorCode } } {
  // Log the error for debugging
  logger.error('Error occurred:', { error: error.toString(), stack: error.stack });

  // If it's already an MCP error, use it directly
  if (error instanceof McpError) {
    return {
      error: {
        message: error.message,
        code: error.code
      }
    };
  }

  // If it's a Neo MCP error, convert it
  if (error instanceof NeoMcpError) {
    const code = error.type === ErrorType.VALIDATION_ERROR ?
      ErrorCode.InvalidParams :
      ErrorCode.InternalError;

    return {
      error: {
        message: error.message,
        code: code
      }
    };
  }

  // Handle connection errors
  if (error.code && typeof error.code === 'string') {
    const mapping = ERROR_MAPPINGS[error.code];
    if (mapping) {
      return {
        error: {
          message: mapping.message,
          code: mapping.code
        }
      };
    }
  }

  // Handle errors with messages
  if (error.message && typeof error.message === 'string') {
    const mapping = findErrorMapping(error.message);
    if (mapping) {
      return {
        error: {
          message: mapping.message,
          code: mapping.code
        }
      };
    }

    // If no mapping found, use the original message
    return {
      error: {
        message: error.message,
        code: ErrorCode.InternalError
      }
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    const mapping = findErrorMapping(error);
    if (mapping) {
      return {
        error: {
          message: mapping.message,
          code: mapping.code
        }
      };
    }

    return {
      error: {
        message: error,
        code: ErrorCode.InternalError
      }
    };
  }

  // Generic error handler for unknown error types
  return {
    error: {
      message: 'Unknown error',
      code: ErrorCode.InternalError
    }
  };
}

/**
 * Create a success response
 * @param data Data to include in the response
 * @returns MCP-compatible success response
 */
export function createSuccessResponse(data: any): { result: any } {
  return {
    result: data
  };
}

/**
 * Create an error response
 * @param message Error message
 * @param code Error code
 * @returns MCP-compatible error response
 */
export function createErrorResponse(message: string, code: ErrorCode = ErrorCode.InternalError): { error: { message: string, code: ErrorCode } } {
  return {
    error: {
      message,
      code
    }
  };
}
