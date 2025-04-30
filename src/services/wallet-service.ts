/**
 * Wallet Service for Neo N3 MCP
 * 
 * This module provides wallet management functionality for the Neo N3 MCP server.
 */

import * as neonJs from '@cityofzion/neon-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class WalletService {
  private walletsDir: string;

  constructor(walletsDir: string = './wallets') {
    this.walletsDir = walletsDir;
    this.ensureWalletsDirExists();
  }

  /**
   * Ensure the wallets directory exists
   */
  private ensureWalletsDirExists() {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true });
    }
  }

  /**
   * Create a new wallet
   * @param password Password to encrypt the wallet
   * @returns Wallet information
   */
  async createWallet(password: string): Promise<any> {
    try {
      // Create a new account
      const account = new neonJs.wallet.Account();
      
      // Encrypt the private key
      const encryptedPrivateKey = this.encryptPrivateKey(account.privateKey, password);
      
      // Create wallet info
      const walletInfo = {
        address: account.address,
        publicKey: account.publicKey,
        encryptedPrivateKey,
        createdAt: new Date().toISOString()
      };
      
      // Save the wallet
      this.saveWallet(account.address, walletInfo);
      
      return walletInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create wallet: ${errorMessage}`);
    }
  }

  /**
   * Get wallet information
   * @param address Wallet address
   * @returns Wallet information
   */
  async getWallet(address: string): Promise<any> {
    try {
      const walletPath = path.join(this.walletsDir, `${address}.json`);
      
      if (!fs.existsSync(walletPath)) {
        throw new Error(`Wallet not found: ${address}`);
      }
      
      const walletData = fs.readFileSync(walletPath, 'utf-8');
      return JSON.parse(walletData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get wallet: ${errorMessage}`);
    }
  }

  /**
   * Import a wallet from private key or WIF
   * @param key Private key or WIF
   * @param password Password to encrypt the wallet
   * @returns Wallet information
   */
  async importWallet(key: string, password: string = 'password'): Promise<any> {
    try {
      // Create an account from the key
      const account = new neonJs.wallet.Account(key);
      
      // Encrypt the private key
      const encryptedPrivateKey = this.encryptPrivateKey(account.privateKey, password);
      
      // Create wallet info
      const walletInfo = {
        address: account.address,
        publicKey: account.publicKey,
        encryptedPrivateKey,
        createdAt: new Date().toISOString()
      };
      
      // Save the wallet
      this.saveWallet(account.address, walletInfo);
      
      return walletInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import wallet: ${errorMessage}`);
    }
  }

  /**
   * Encrypt a private key
   * @param privateKey Private key to encrypt
   * @param password Password to use for encryption
   * @returns Encrypted private key
   */
  private encryptPrivateKey(privateKey: string, password: string): string {
    try {
      // Generate a random salt
      const salt = crypto.randomBytes(16);
      
      // Derive a key from the password
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      
      // Generate a random IV
      const iv = crypto.randomBytes(16);
      
      // Create a cipher
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return the encrypted private key with salt and IV
      return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to encrypt private key: ${errorMessage}`);
    }
  }

  /**
   * Decrypt a private key
   * @param encryptedPrivateKey Encrypted private key
   * @param password Password to use for decryption
   * @returns Decrypted private key
   */
  private decryptPrivateKey(encryptedPrivateKey: string, password: string): string {
    try {
      // Split the encrypted private key into salt, IV, and encrypted data
      const [saltHex, ivHex, encrypted] = encryptedPrivateKey.split(':');
      
      // Convert salt and IV from hex to Buffer
      const salt = Buffer.from(saltHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      
      // Derive a key from the password
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      
      // Create a decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt the private key
      let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      
      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to decrypt private key: ${errorMessage}`);
    }
  }

  /**
   * Save a wallet to disk
   * @param address Wallet address
   * @param walletInfo Wallet information
   */
  private saveWallet(address: string, walletInfo: any) {
    try {
      const walletPath = path.join(this.walletsDir, `${address}.json`);
      fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save wallet: ${errorMessage}`);
    }
  }
}
