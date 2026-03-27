/**
 * Wallet Service for Neo N3 MCP
 *
 * This module provides wallet management functionality for the Neo N3 MCP server.
 */

import * as neonJs from '@cityofzion/neon-js';
import type { Account } from '@cityofzion/neon-core/lib/wallet/Account';
import * as fs from 'fs';
import * as path from 'path';
import { validatePassword } from '../utils/validation';
import { WalletInfo } from '../types/neo';

export class WalletService {
  private walletsDir: string;

  constructor(walletsDir: string = './wallets') {
    this.walletsDir = walletsDir;
    this.ensureWalletsDirExists();
  }

  private ensureWalletsDirExists() {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true });
    }
  }

  async createWallet(password: string): Promise<WalletInfo> {
    try {
      validatePassword(password);
      const account = new neonJs.wallet.Account();
      const walletInfo = await this.buildEncryptedWalletInfo(account, password);

      this.saveWallet(account.address, walletInfo);
      return walletInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create wallet: ${errorMessage}`);
    }
  }

  async getWallet(address: string): Promise<WalletInfo> {
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

  async importWallet(key: string, password?: string): Promise<WalletInfo> {
    try {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import wallet: ${errorMessage}`);
    }
  }

  private async buildEncryptedWalletInfo(account: Account, password: string): Promise<WalletInfo> {
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
    try {
      const walletPath = path.join(this.walletsDir, `${address}.json`);
      fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
      fs.chmodSync(walletPath, 0o600);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save wallet: ${errorMessage}`);
    }
  }
}
