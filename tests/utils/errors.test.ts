import { jest } from '@jest/globals';
import {
  NeoMcpError,
  ErrorType,
  ValidationError,
  ContractError,
  TransactionError,
  NetworkError,
  RateLimitError,
  WalletError,
  InternalError
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('NeoMcpError', () => {
    test('should create a base error with type and message', () => {
      const error = new NeoMcpError('Test error', ErrorType.INTERNAL_ERROR);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error.name).toBe('NeoMcpError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(ErrorType.INTERNAL_ERROR);
    });
    
    test('should create a base error with details', () => {
      const details = { code: 123, context: 'test' };
      const error = new NeoMcpError('Test error', ErrorType.INTERNAL_ERROR, details);
      
      expect(error.details).toEqual(details);
    });
    
    test('should convert to response format', () => {
      const details = { code: 123 };
      const error = new NeoMcpError('Test error', ErrorType.INTERNAL_ERROR, details);
      const response = error.toResponse();
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('type', ErrorType.INTERNAL_ERROR);
      expect(response.error).toHaveProperty('message', 'Test error');
      expect(response.error).toHaveProperty('details', details);
    });
  });
  
  describe('ValidationError', () => {
    test('should create a validation error', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
    });
    
    test('should create a validation error with details', () => {
      const details = { field: 'username', constraint: 'required' };
      const error = new ValidationError('Invalid input', details);
      
      expect(error.details).toEqual(details);
    });
  });
  
  describe('ContractError', () => {
    test('should create a contract error', () => {
      const error = new ContractError('Contract execution failed');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(ContractError);
      expect(error.name).toBe('ContractError');
      expect(error.message).toBe('Contract execution failed');
      expect(error.type).toBe(ErrorType.CONTRACT_ERROR);
    });
  });
  
  describe('TransactionError', () => {
    test('should create a transaction error', () => {
      const error = new TransactionError('Transaction failed');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.name).toBe('TransactionError');
      expect(error.message).toBe('Transaction failed');
      expect(error.type).toBe(ErrorType.TRANSACTION_ERROR);
    });
  });
  
  describe('NetworkError', () => {
    test('should create a network error', () => {
      const error = new NetworkError('Network connection failed');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network connection failed');
      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
    });
  });
  
  describe('RateLimitError', () => {
    test('should create a rate limit error', () => {
      const error = new RateLimitError('Too many requests');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Too many requests');
      expect(error.type).toBe(ErrorType.RATE_LIMIT_ERROR);
    });
  });
  
  describe('WalletError', () => {
    test('should create a wallet error', () => {
      const error = new WalletError('Wallet operation failed');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(WalletError);
      expect(error.name).toBe('WalletError');
      expect(error.message).toBe('Wallet operation failed');
      expect(error.type).toBe(ErrorType.WALLET_ERROR);
    });
  });
  
  describe('InternalError', () => {
    test('should create an internal error', () => {
      const error = new InternalError('Internal server error');
      
      expect(error).toBeInstanceOf(NeoMcpError);
      expect(error).toBeInstanceOf(InternalError);
      expect(error.name).toBe('InternalError');
      expect(error.message).toBe('Internal server error');
      expect(error.type).toBe(ErrorType.INTERNAL_ERROR);
    });
  });
});
