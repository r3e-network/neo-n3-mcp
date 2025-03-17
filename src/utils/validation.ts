import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Validate a Neo N3 address
 * @param address Address to validate
 * @returns Validated address
 * @throws McpError if the address is invalid
 */
export function validateAddress(address: unknown): string {
  if (typeof address !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Address must be a string');
  }
  
  // Neo N3 addresses are 34 characters long and start with 'N'
  if (!/^N[A-Za-z0-9]{33}$/.test(address)) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid Neo N3 address format');
  }
  
  return address;
}

/**
 * Validate a transaction or block hash
 * @param hash Hash to validate
 * @returns Validated hash
 * @throws McpError if the hash is invalid
 */
export function validateHash(hash: unknown): string {
  if (typeof hash !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Hash must be a string');
  }
  
  // Neo transaction/block hashes are 64 hex characters (with or without 0x prefix)
  const hexHash = hash.startsWith('0x') ? hash.substring(2) : hash;
  if (!/^[A-Fa-f0-9]{64}$/.test(hexHash)) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid hash format');
  }
  
  return hash;
}

/**
 * Validate an amount
 * @param amount Amount to validate
 * @returns Validated amount as a string
 * @throws McpError if the amount is invalid
 */
export function validateAmount(amount: unknown): string {
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw new McpError(ErrorCode.InvalidParams, 'Amount must be a string or number');
  }
  
  const amountStr = amount.toString();
  
  // Check if it's a valid decimal number
  if (!/^\d+(\.\d+)?$/.test(amountStr)) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid amount format');
  }
  
  return amountStr;
}

/**
 * Validate a password
 * @param password Password to validate
 * @returns Validated password
 * @throws McpError if the password is invalid
 */
export function validatePassword(password: unknown): string {
  if (typeof password !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Password must be a string');
  }
  
  if (password.length < 8) {
    throw new McpError(ErrorCode.InvalidParams, 'Password must be at least 8 characters long');
  }
  
  return password;
}

/**
 * Validate a contract script hash
 * @param scriptHash Script hash to validate
 * @returns Validated script hash
 * @throws McpError if the script hash is invalid
 */
export function validateScriptHash(scriptHash: unknown): string {
  if (typeof scriptHash !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Script hash must be a string');
  }
  
  // Neo N3 script hashes are 40 hex characters (with or without 0x prefix)
  const hexScriptHash = scriptHash.startsWith('0x') ? scriptHash.substring(2) : scriptHash;
  if (!/^[A-Fa-f0-9]{40}$/.test(hexScriptHash)) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid script hash format');
  }
  
  return scriptHash;
}
