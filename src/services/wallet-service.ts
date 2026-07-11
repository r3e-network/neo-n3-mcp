/**
 * Wallet Service for Neo N3 MCP
 *
 * This module provides wallet management functionality for the Neo N3 MCP server.
 */

import * as neonJs from '@cityofzion/neon-js';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { validateAddress, validatePassword } from '../utils/validation';
import { ValidationError } from '../utils/errors';
import { WalletInfo } from '../types/neo';
import type { NeonAccount } from '../types/neon';

const SENSITIVE_WALLET_FIELD = /(?:wif|privatekey|encryptedkey|password|secret)/i;

export function sanitizeWalletMetadata(wallet: WalletInfo): WalletInfo {
  return Object.fromEntries(
    Object.entries(wallet).filter(([key]) => {
      const normalizedKey = key.replace(/[_-]/g, '');
      return normalizedKey.toLowerCase() !== 'key' && !SENSITIVE_WALLET_FIELD.test(normalizedKey);
    })
  ) as WalletInfo;
}

export class WalletService {
  private walletsDir: string;

  constructor(walletsDir: string = './wallets') {
    this.walletsDir = walletsDir;
    this.ensureWalletsDirExists();
  }

  private ensureWalletsDirExists() {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true, mode: 0o700 });
    }
    fs.chmodSync(this.walletsDir, 0o700);
  }

  async createWallet(password: string): Promise<WalletInfo> {
    try {
      validatePassword(password);
      const account = new neonJs.wallet.Account();
      const walletInfo = await this.buildEncryptedWalletInfo(account, password);

      this.saveWallet(account.address, walletInfo);
      return walletInfo;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Failed to create wallet');
    }
  }

  async getWallet(address: string): Promise<WalletInfo> {
    try {
      validateAddress(address);
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

  async importWallet(key: string, password?: string): Promise<WalletInfo> {
    try {
      if (typeof key !== 'string' || !(neonJs.wallet.isWIF(key) || neonJs.wallet.isPrivateKey(key))) {
        throw new ValidationError('Invalid private key or WIF format');
      }
      const account = new neonJs.wallet.Account(key);

      if (!password) {
        return {
          address: account.address,
          publicKey: account.publicKey,
        };
      }

      validatePassword(password);
      const walletInfo = await this.buildEncryptedWalletInfo(account, password);
      this.saveWallet(account.address, walletInfo);
      return walletInfo;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error('Failed to import wallet');
    }
  }

  private async buildEncryptedWalletInfo(account: NeonAccount, password: string): Promise<WalletInfo> {
    const encryptedPrivateKey = await neonJs.wallet.encrypt(account.WIF, password);
    return {
      address: account.address,
      publicKey: account.publicKey,
      encryptedPrivateKey,
      keyFormat: 'nep2',
      createdAt: new Date().toISOString()
    };
  }

  private saveWallet(address: string, walletInfo: WalletInfo) {
    const walletPath = path.join(this.walletsDir, `${address}.json`);
    const temporaryPath = `${walletPath}.${process.pid}.${randomUUID()}.tmp`;

    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(walletInfo, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      fs.renameSync(temporaryPath, walletPath);
    } catch (error) {
      fs.rmSync(temporaryPath, { force: true });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save wallet: ${errorMessage}`);
    }
  }
}
