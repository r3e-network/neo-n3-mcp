/**
 * Validation utilities for Neo N3 MCP Server
 * Provides robust validation for input parameters
 */

import * as neonJs from '@cityofzion/neon-js';
import { NeoNetwork } from '../services/neo-service.js';
import { ValidationError } from './errors.js';
import { logger } from './logger.js';

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
  if (!/^[A-Za-z0-9]{34}$/.test(address)) {
    throw new ValidationError(`Invalid Neo N3 address format: ${address}`);
  }
  
  try {
    // Use NeonJS to verify address
    const scriptHash = neonJs.wallet.getScriptHashFromAddress(address);
    if (!scriptHash || scriptHash.length !== 40) {
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
  if (cleanHash.length !== 64) {
    throw new ValidationError(`Invalid hash length: ${hash}`);
  }
  
  // Check if hexadecimal
  if (!/^[0-9a-fA-F]+$/.test(cleanHash)) {
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
  if (cleanHash.length !== 40) {
    throw new ValidationError(`Invalid script hash length: ${scriptHash}`);
  }
  
  // Check if hexadecimal
  if (!/^[0-9a-fA-F]+$/.test(cleanHash)) {
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
    if (!/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
      throw new ValidationError(`Invalid amount format: ${amount}`);
    }
    numericAmount = parseFloat(amount);
  } else if (typeof amount === 'number') {
    numericAmount = amount;
  } else {
    throw new ValidationError('Amount must be a number or numeric string');
  }
  
  // Check range
  if (numericAmount <= 0) {
    throw new ValidationError('Amount must be greater than zero');
  }
  
  if (!isFinite(numericAmount)) {
    throw new ValidationError('Amount must be a finite number');
  }
  
  // Check for reasonable max value (1 billion GAS or NEO)
  const MAX_AMOUNT = 1_000_000_000;
  if (numericAmount > MAX_AMOUNT) {
    throw new ValidationError(`Amount exceeds maximum allowed (${MAX_AMOUNT})`);
  }
  
  // Return normalized string format
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
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
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
export function validateNetwork(network: string): NeoNetwork {
  if (!network) {
    return NeoNetwork.MAINNET; // Default to mainnet
  }
  
  const normalizedNetwork = network.toLowerCase();
  
  if (normalizedNetwork === NeoNetwork.MAINNET || normalizedNetwork === NeoNetwork.TESTNET) {
    return normalizedNetwork as NeoNetwork;
  }
  
  throw new ValidationError(`Invalid network: ${network}. Must be one of: ${NeoNetwork.MAINNET}, ${NeoNetwork.TESTNET}`);
}

/**
 * Safely sanitize string inputs
 * @param input String input to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string');
  }
  
  // Remove control characters and potentially dangerous sequences
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Control chars
    .replace(/[<>]/g, '')  // HTML tags
    .trim();
}

/**
 * Validate boolean value
 * @param value Boolean value to validate
 * @returns Validated boolean
 * @throws ValidationError if invalid
 */
export function validateBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  
  if (value === 1 || value === 0) {
    return value === 1;
  }
  
  throw new ValidationError('Invalid boolean value, must be true/false, 1/0, or boolean');
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
    if (!/^[0-9]+$/.test(value)) {
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
