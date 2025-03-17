import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Handle errors and convert them to MCP-compatible error responses
 * @param error Error to handle
 * @returns MCP-compatible error response
 */
export function handleError(error: any): { content: Array<{type: string, text: string}>, isError: boolean } {
  console.error('Error:', error);
  
  // If it's already an MCP error, use it directly
  if (error instanceof McpError) {
    return {
      content: [
        {
          type: 'text',
          text: error.message,
        },
      ],
      isError: true,
    };
  }
  
  // Handle different types of errors
  if (error.code === 'ECONNREFUSED') {
    return {
      content: [
        {
          type: 'text',
          text: 'Could not connect to Neo N3 node. Please check the node URL and try again.',
        },
      ],
      isError: true,
    };
  }

  // Handle Neo N3 specific errors
  if (error.message && error.message.includes('Insufficient funds')) {
    return {
      content: [
        {
          type: 'text',
          text: 'Insufficient funds to complete the transaction.',
        },
      ],
      isError: true,
    };
  }

  if (error.message && error.message.includes('Invalid signature')) {
    return {
      content: [
        {
          type: 'text',
          text: 'Invalid signature. Please check your wallet credentials.',
        },
      ],
      isError: true,
    };
  }

  if (error.message && error.message.includes('Unknown asset')) {
    return {
      content: [
        {
          type: 'text',
          text: error.message,
        },
      ],
      isError: true,
    };
  }
  
  // Generic error handler
  return {
    content: [
      {
        type: 'text',
        text: `An error occurred: ${error.message || 'Unknown error'}`,
      },
    ],
    isError: true,
  };
}

/**
 * Create a success response
 * @param data Data to include in the response
 * @returns MCP-compatible success response
 */
export function createSuccessResponse(data: any): { content: Array<{type: string, text: string}> } {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create an error response
 * @param message Error message
 * @param code Error code
 * @returns MCP-compatible error response
 */
export function createErrorResponse(message: string, code?: ErrorCode): { content: Array<{type: string, text: string}>, isError: boolean } {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
}
