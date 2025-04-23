import { jest } from '@jest/globals';
import {
  handleError,
  createSuccessResponse,
  createErrorResponse
} from '../../src/utils/error-handler';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ValidationError, NetworkError } from '../../src/utils/errors';

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Error Handler Utilities', () => {
  describe('createSuccessResponse', () => {
    test('should create a success response with data', () => {
      const data = { test: 'data' };
      const response = createSuccessResponse(data);
      expect(response).toHaveProperty('result', data);
    });

    test('should create a success response with null data', () => {
      const response = createSuccessResponse(null);
      expect(response).toHaveProperty('result', null);
    });
  });

  describe('createErrorResponse', () => {
    test('should create an error response with message', () => {
      const message = 'Error message';
      const response = createErrorResponse(message);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', message);
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });

    test('should create an error response with message and code', () => {
      const message = 'Error message';
      const code = ErrorCode.InvalidParams;
      const response = createErrorResponse(message, code);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', message);
      expect(response.error).toHaveProperty('code', code);
    });
  });

  describe('handleError', () => {
    test('should handle McpError', () => {
      const error = new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Invalid parameters');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle NeoMcpError - ValidationError', () => {
      const error = new ValidationError('Invalid address format');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', 'Invalid address format');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle NeoMcpError - NetworkError', () => {
      const error = new NetworkError('Network connection failed');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', 'Network connection failed');
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });

    test('should handle connection errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Could not connect to Neo N3 node');
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });

    test('should handle transaction errors', () => {
      const error = new Error('Insufficient funds for transaction');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Insufficient funds');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle validation errors', () => {
      const error = new Error('Invalid address format');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Invalid Neo N3 address format');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle contract errors', () => {
      const error = new Error('Contract not found: NeoFS');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Smart contract not found');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle regular Error', () => {
      const error = new Error('Regular error');
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', 'Regular error');
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });

    test('should handle string error', () => {
      const error = 'String error';
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', 'String error');
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });

    test('should handle string error with mapping', () => {
      const error = 'Invalid network specified';
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Invalid network');
      expect(response.error).toHaveProperty('code', ErrorCode.InvalidParams);
    });

    test('should handle unknown error type', () => {
      const error = { custom: 'error' };
      const response = handleError(error);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('message', 'Unknown error');
      expect(response.error).toHaveProperty('code', ErrorCode.InternalError);
    });
  });
});
