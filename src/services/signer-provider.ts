import * as fs from 'fs';
import * as neonJs from '@cityofzion/neon-js';
import type { NeonAccount } from '../types/neon';
import { ValidationError } from '../utils/errors';

const MAX_SIGNER_FILE_BYTES = 1024;

export class SignerProvider {
  private readonly account: NeonAccount;
  readonly signerAddress: string;

  constructor(signerWifFile: string) {
    if (!signerWifFile?.trim()) {
      throw new Error('A signer WIF file is required');
    }

    const filePath = signerWifFile.trim();
    const noFollow = (fs.constants as typeof fs.constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
    let descriptor: number | undefined;
    let wif: string;
    try {
      descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
      const fileStat = fs.fstatSync(descriptor);
      if (!fileStat.isFile()) {
        throw new Error('Signer WIF file must be a regular, non-symlink file');
      }
      if ((fileStat.mode & 0o077) !== 0) {
        throw new Error('Signer WIF file must be owner-only (mode 0600 or stricter)');
      }
      if (typeof process.getuid === 'function' && fileStat.uid !== process.getuid()) {
        throw new Error('Signer WIF file must be owned by the current user');
      }
      if (fileStat.size > MAX_SIGNER_FILE_BYTES) {
        throw new Error('Signer WIF file is too large');
      }
      wif = fs.readFileSync(descriptor, 'utf8').trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        throw new Error('Signer WIF file must be a regular, non-symlink file');
      }
      throw error;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
    if (!neonJs.wallet.isWIF(wif)) {
      throw new Error('Signer file must contain a valid Neo WIF');
    }

    try {
      this.account = new neonJs.wallet.Account(wif);
      this.signerAddress = this.account.address;
    } catch {
      throw new Error('Signer file must contain a valid Neo WIF');
    }
  }

  getAccount(requestedAddress: string): NeonAccount {
    if (requestedAddress !== this.signerAddress) {
      throw new ValidationError(
        `Requested signer does not match the configured signer address ${this.signerAddress}`
      );
    }
    return this.account;
  }
}
