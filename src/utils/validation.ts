/**
 * Validation utilities for Neo N3 MCP Server
 * Provides robust validation for input parameters
 *
 * This module contains comprehensive validation functions for all Neo N3 blockchain
 * related parameters, ensuring data integrity and security.
 */

import * as neonJs from '@cityofzion/neon-js';
import { NeoNetwork } from '../services/neo-service';
import { ValidationError } from './errors';
import { logger } from './logger';

// Constants for validation
const MAX_GAS_AMOUNT = 1_000_000_000; // 1 billion GAS
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;
const NEO_ADDRESS_PATTERN = /^[A-Za-z0-9]{34}$/;
const HASH_LENGTH = 64; // 32 bytes * 2 chars per byte
const SCRIPT_HASH_LENGTH = 40; // 20 bytes * 2 chars per byte
const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const POSITIVE_NUMBER_PATTERN = /^[0-9]+(\.[0-9]+)?$/;
const POSITIVE_INTEGER_PATTERN = /^[0-9]+$/;

/**
 * Validate Neo N3 address format
 * @param address Neo N3 address to validate
 * @returns Validated address
 * @throws ValidationError if invalid
 */
export function validateAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError('Address must be a non-empty string');
  }

  // Check basic format (Neo N3 addresses are 34 characters)
  if (!NEO_ADDRESS_PATTERN.test(address)) {
    throw new ValidationError(`Invalid Neo N3 address format: ${address}`);
  }

  try {
    // Use NeonJS to verify address
    const scriptHash = neonJs.wallet.getScriptHashFromAddress(address);
    if (!scriptHash || scriptHash.length !== SCRIPT_HASH_LENGTH) {
      throw new Error('Invalid address conversion');
    }
  } catch (error) {
    logger.warn(`Address validation failed: ${address}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new ValidationError(`Invalid Neo N3 address: ${address}`);
  }

  return address;
}

/**
 * Validate transaction hash format
 * @param hash Transaction hash to validate
 * @returns Validated hash
 * @throws ValidationError if invalid
 */
export function validateHash(hash: string): string {
  if (!hash || typeof hash !== 'string') {
    throw new ValidationError('Hash must be a non-empty string');
  }

  // Remove '0x' prefix if present
  const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;

  // Check length (64 characters for a transaction hash without '0x')
  if (cleanHash.length !== HASH_LENGTH) {
    throw new ValidationError(`Invalid hash length: ${hash}. Expected ${HASH_LENGTH} characters (without 0x prefix).`);
  }

  // Check if hexadecimal
  if (!HEX_PATTERN.test(cleanHash)) {
    throw new ValidationError(`Invalid hash format (not hexadecimal): ${hash}`);
  }

  // Return normalized form (with 0x prefix)
  return `0x${cleanHash}`;
}

/**
 * Validate script hash format
 * @param scriptHash Script hash to validate
 * @returns Validated script hash
 * @throws ValidationError if invalid
 */
export function validateScriptHash(scriptHash: string): string {
  if (!scriptHash || typeof scriptHash !== 'string') {
    throw new ValidationError('Script hash must be a non-empty string');
  }

  // Remove '0x' prefix if present
  const cleanHash = scriptHash.startsWith('0x') ? scriptHash.substring(2) : scriptHash;

  // Check length (40 characters for a Neo script hash without '0x')
  if (cleanHash.length !== SCRIPT_HASH_LENGTH) {
    throw new ValidationError(`Invalid script hash length: ${scriptHash}. Expected ${SCRIPT_HASH_LENGTH} characters (without 0x prefix).`);
  }

  // Check if hexadecimal
  if (!HEX_PATTERN.test(cleanHash)) {
    throw new ValidationError(`Invalid script hash format (not hexadecimal): ${scriptHash}`);
  }

  // Return normalized form (with 0x prefix)
  return `0x${cleanHash}`;
}

/**
 * Validate amount with decimal support
 * @param amount Amount to validate
 * @returns Normalized amount as string
 * @throws ValidationError if invalid
 */
export function validateAmount(amount: string | number): string {
  let numericAmount: number;

  if (typeof amount === 'string') {
    // Check for valid number format
    if (!POSITIVE_NUMBER_PATTERN.test(amount)) {
      throw new ValidationError(`Invalid amount format: ${amount}. Must be a positive number.`);
    }
    numericAmount = parseFloat(amount);
  } else if (typeof amount === 'number') {
    if (isNaN(amount) || !isFinite(amount)) {
      throw new ValidationError('Amount must be a valid number');
    }
    numericAmount = amount;
  } else {
    throw new ValidationError('Amount must be a number or numeric string');
  }

  // Check range
  if (numericAmount <= 0) {
    throw new ValidationError('Amount must be greater than zero');
  }

  // Check for reasonable max value
  if (numericAmount > MAX_GAS_AMOUNT) {
    throw new ValidationError(`Amount exceeds maximum allowed (${MAX_GAS_AMOUNT})`);
  }

  // Return normalized string format with up to 8 decimal places (Neo precision)
  return numericAmount.toString();
}

/**
 * Validate password
 * @param password Password to validate
 * @returns Validated password
 * @throws ValidationError if invalid
 */
export function validatePassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password must be a non-empty string');
  }

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  // Check maximum length to prevent DoS attacks
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be less than ${MAX_PASSWORD_LENGTH} characters long`);
  }

  // Return the password
  return password;
}

/**
 * Validate Neo network
 * @param network Network to validate
 * @returns Validated network
 * @throws ValidationError if invalid
 */
export function validateNetwork(network?: string): NeoNetwork {
  if (!network) {
    return NeoNetwork.MAINNET; // Default to mainnet
  }

  if (typeof network !== 'string') {
    throw new ValidationError('Network must be a string');
  }

  const normalizedNetwork = network.toLowerCase().trim();

  if (normalizedNetwork === NeoNetwork.MAINNET || normalizedNetwork === NeoNetwork.TESTNET) {
    return normalizedNetwork as NeoNetwork;
  }

  throw new ValidationError(`Invalid network: ${network}. Must be one of: ${NeoNetwork.MAINNET}, ${NeoNetwork.TESTNET}`);
}

/**
 * Sanitize string by removing control characters and trimming whitespace
 * @param input String to sanitize
 * @returns Sanitized string
 * @throws ValidationError if not a string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string');
  }

  // Remove control characters and trim whitespace
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Control chars
    .replace(/<[^>]*>/g, '')                        // Remove HTML tags
    .trim();
}

/**
 * Validate boolean value
 * @param value Boolean value to validate
 * @returns Validated boolean
 * @throws ValidationError if invalid
 */
export function validateBoolean(value: boolean | string | number): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.toLowerCase().trim();
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
    if (normalizedValue === '1') return true;
    if (normalizedValue === '0') return false;
    throw new ValidationError(`Invalid boolean value: ${value}. Must be 'true', 'false', '1', or '0'.`);
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    throw new ValidationError(`Invalid boolean value: ${value}. Must be 1 or 0.`);
  }

  throw new ValidationError('Boolean value must be a boolean, string, or number.');
}

/**
 * Validate positive integer
 * @param value Integer value to validate
 * @returns Validated integer
 * @throws ValidationError if invalid
 */
export function validateInteger(value: number | string): number {
  let intValue: number;

  if (typeof value === 'string') {
    if (!POSITIVE_INTEGER_PATTERN.test(value)) {
      throw new ValidationError(`Invalid integer format: ${value}`);
    }
    intValue = parseInt(value, 10);
  } else if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new ValidationError('Value must be an integer');
    }
    intValue = value;
  } else {
    throw new ValidationError('Value must be a number or numeric string');
  }

  if (intValue < 0) {
    throw new ValidationError('Value must be a positive integer');
  }

  return intValue;
}

/**
 * Validate contract name
 * @param contractName Contract name to validate
 * @param availableContracts List of available contract names
 * @returns Validated contract name
 * @throws ValidationError if invalid
 */
export function validateContractName(contractName: string, availableContracts: string[]): string {
  if (!contractName || typeof contractName !== 'string') {
    throw new ValidationError('Contract name must be a non-empty string');
  }

  // Sanitize and normalize contract name
  const normalizedName = contractName.trim();

  // Check if contract name is in the list of available contracts
  if (availableContracts.length > 0 && !availableContracts.includes(normalizedName)) {
    throw new ValidationError(
      `Invalid contract name: ${normalizedName}. ` +
      `Available contracts: ${availableContracts.join(', ')}`
    );
  }

  return normalizedName;
}

/**
 * Validate contract operation
 * @param operation Operation name to validate
 * @param availableOperations List of available operations
 * @returns Validated operation name
 * @throws ValidationError if invalid
 */
export function validateContractOperation(operation: string, availableOperations: string[]): string {
  if (!operation || typeof operation !== 'string') {
    throw new ValidationError('Operation name must be a non-empty string');
  }

  // Sanitize and normalize operation name
  const normalizedOperation = operation.trim();

  // Check if operation is in the list of available operations
  if (availableOperations.length > 0 && !availableOperations.includes(normalizedOperation)) {
    throw new ValidationError(
      `Invalid operation: ${normalizedOperation}. ` +
      `Available operations: ${availableOperations.join(', ')}`
    );
  }

  return normalizedOperation;
}


