import { jest } from '@jest/globals';
import {
  validateAddress,
  validateHash,
  validateAmount,
  validatePassword,
  validateScriptHash,
  validateNetwork,
  validateContractName,
  validateContractOperation,
  validateInteger,
  validateBoolean,
  sanitizeString
} from '../../src/utils/validation';
import { NeoNetwork } from '../../src/services/neo-service';
import { ValidationError } from '../../src/utils/errors';

describe('Validation Utilities', () => {
  describe('validateAddress', () => {
    test('should validate correct Neo N3 address', () => {
      const address = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
      expect(validateAddress(address)).toBe(address);
    });

    test('should throw error for invalid address', () => {
      expect(() => {
        validateAddress('invalid-address');
      }).toThrow(ValidationError);
    });

    test('should throw error for empty address', () => {
      expect(() => {
        validateAddress('');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string address', () => {
      expect(() => {
        validateAddress(123 as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateHash', () => {
    test('should validate correct hash', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(validateHash(hash)).toBe(hash);
    });

    test('should validate hash without 0x prefix', () => {
      const hash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(validateHash(hash)).toBe('0x' + hash);
    });

    test('should throw error for invalid hash', () => {
      expect(() => {
        validateHash('invalid-hash');
      }).toThrow(ValidationError);
    });

    test('should throw error for empty hash', () => {
      expect(() => {
        validateHash('');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string hash', () => {
      expect(() => {
        validateHash(123 as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateAmount', () => {
    test('should validate string amount', () => {
      expect(validateAmount('100')).toBe('100');
    });

    test('should validate number amount', () => {
      expect(validateAmount(100)).toBe('100');
    });

    test('should validate decimal amount', () => {
      expect(validateAmount('10.5')).toBe('10.5');
    });

    test('should throw error for negative amount', () => {
      expect(() => {
        validateAmount('-10');
      }).toThrow(ValidationError);
    });

    test('should throw error for zero amount', () => {
      expect(() => {
        validateAmount('0');
      }).toThrow(ValidationError);
    });

    test('should throw error for invalid amount', () => {
      expect(() => {
        validateAmount('invalid');
      }).toThrow(ValidationError);
    });
  });

  describe('validatePassword', () => {
    test('should validate password with minimum length', () => {
      const password = 'password123';
      expect(validatePassword(password)).toBe(password);
    });

    test('should throw error for short password', () => {
      expect(() => {
        validatePassword('pass');
      }).toThrow(ValidationError);
    });

    test('should throw error for empty password', () => {
      expect(() => {
        validatePassword('');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string password', () => {
      expect(() => {
        validatePassword(123 as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateScriptHash', () => {
    test('should validate correct script hash', () => {
      const scriptHash = '0x1234567890abcdef1234567890abcdef12345678';
      expect(validateScriptHash(scriptHash)).toBe(scriptHash);
    });

    test('should validate script hash without 0x prefix', () => {
      const scriptHash = '1234567890abcdef1234567890abcdef12345678';
      expect(validateScriptHash(scriptHash)).toBe('0x' + scriptHash);
    });

    test('should throw error for invalid script hash', () => {
      expect(() => {
        validateScriptHash('invalid-script-hash');
      }).toThrow(ValidationError);
    });

    test('should throw error for empty script hash', () => {
      expect(() => {
        validateScriptHash('');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string script hash', () => {
      expect(() => {
        validateScriptHash(123 as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateNetwork', () => {
    test('should validate mainnet', () => {
      expect(validateNetwork('mainnet')).toBe(NeoNetwork.MAINNET);
    });

    test('should validate testnet', () => {
      expect(validateNetwork('testnet')).toBe(NeoNetwork.TESTNET);
    });

    test('should throw error for invalid network', () => {
      expect(() => {
        validateNetwork('invalid-network');
      }).toThrow(ValidationError);
    });

    test('should default to mainnet for empty network', () => {
      expect(validateNetwork('')).toBe(NeoNetwork.MAINNET);
    });

    test('should default to mainnet for undefined network', () => {
      expect(validateNetwork(undefined)).toBe(NeoNetwork.MAINNET);
    });

    test('should throw error for non-string network', () => {
      expect(() => {
        validateNetwork(123 as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateContractName', () => {
    const availableContracts = ['NeoFS', 'NeoBurger', 'Flamingo'];

    test('should validate contract name in the list', () => {
      expect(validateContractName('NeoFS', availableContracts)).toBe('NeoFS');
    });

    test('should trim whitespace from contract name', () => {
      expect(validateContractName(' NeoFS ', availableContracts)).toBe('NeoFS');
    });

    test('should throw error for contract name not in the list', () => {
      expect(() => {
        validateContractName('InvalidContract', availableContracts);
      }).toThrow(ValidationError);
    });

    test('should throw error for empty contract name', () => {
      expect(() => {
        validateContractName('', availableContracts);
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string contract name', () => {
      expect(() => {
        validateContractName(123 as any, availableContracts);
      }).toThrow(ValidationError);
    });

    test('should accept any contract name if available list is empty', () => {
      expect(validateContractName('AnyContract', [])).toBe('AnyContract');
    });
  });

  describe('validateContractOperation', () => {
    const availableOperations = ['transfer', 'balanceOf', 'totalSupply'];

    test('should validate operation in the list', () => {
      expect(validateContractOperation('transfer', availableOperations)).toBe('transfer');
    });

    test('should trim whitespace from operation', () => {
      expect(validateContractOperation(' transfer ', availableOperations)).toBe('transfer');
    });

    test('should throw error for operation not in the list', () => {
      expect(() => {
        validateContractOperation('invalidOperation', availableOperations);
      }).toThrow(ValidationError);
    });

    test('should throw error for empty operation', () => {
      expect(() => {
        validateContractOperation('', availableOperations);
      }).toThrow(ValidationError);
    });

    test('should throw error for non-string operation', () => {
      expect(() => {
        validateContractOperation(123 as any, availableOperations);
      }).toThrow(ValidationError);
    });

    test('should accept any operation if available list is empty', () => {
      expect(validateContractOperation('anyOperation', [])).toBe('anyOperation');
    });
  });

  describe('validateInteger', () => {
    test('should validate string integer', () => {
      expect(validateInteger('100')).toBe(100);
    });

    test('should validate number integer', () => {
      expect(validateInteger(100)).toBe(100);
    });

    test('should throw error for decimal string', () => {
      expect(() => {
        validateInteger('10.5');
      }).toThrow(ValidationError);
    });

    test('should throw error for decimal number', () => {
      expect(() => {
        validateInteger(10.5);
      }).toThrow(ValidationError);
    });

    test('should throw error for negative integer', () => {
      expect(() => {
        validateInteger(-10);
      }).toThrow(ValidationError);
    });

    test('should throw error for invalid integer format', () => {
      expect(() => {
        validateInteger('invalid');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-number/non-string value', () => {
      expect(() => {
        validateInteger({} as any);
      }).toThrow(ValidationError);
    });
  });

  describe('validateBoolean', () => {
    test('should validate boolean true', () => {
      expect(validateBoolean(true)).toBe(true);
    });

    test('should validate boolean false', () => {
      expect(validateBoolean(false)).toBe(false);
    });

    test('should validate string "true"', () => {
      expect(validateBoolean('true')).toBe(true);
    });

    test('should validate string "false"', () => {
      expect(validateBoolean('false')).toBe(false);
    });

    test('should validate number 1', () => {
      expect(validateBoolean(1)).toBe(true);
    });

    test('should validate number 0', () => {
      expect(validateBoolean(0)).toBe(false);
    });

    test('should throw error for invalid boolean value', () => {
      expect(() => {
        validateBoolean('invalid');
      }).toThrow(ValidationError);
    });

    test('should throw error for non-boolean/non-string/non-number value', () => {
      expect(() => {
        validateBoolean({} as any);
      }).toThrow(ValidationError);
    });
  });

  describe('sanitizeString', () => {
    test('should sanitize string with control characters', () => {
      expect(sanitizeString('test\u0000string')).toBe('teststring');
    });

    test('should sanitize string with HTML tags', () => {
      expect(sanitizeString('test<script>alert(1)</script>string')).toBe('testalert(1)string');
    });

    test('should trim whitespace', () => {
      expect(sanitizeString(' test string ')).toBe('test string');
    });

    test('should throw error for non-string value', () => {
      expect(() => {
        sanitizeString(123 as any);
      }).toThrow(ValidationError);
    });
  });
});
