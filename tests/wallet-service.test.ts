/**
 * Unit tests for the WalletService
 */

import { WalletService } from '../src/services/wallet-service';
import * as fs from 'fs';
import * as path from 'path';
import * as neonJs from '@cityofzion/neon-js';

jest.mock('@cityofzion/neon-js', () => ({
  wallet: {
    Account: jest.fn().mockImplementation((key?: string) => ({
      address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      publicKey: 'test-public-key',
      privateKey: key || 'mock-private-key',
      WIF: 'KxMockWalletImportWif111111111111111111111111111111111111111'
    })),
    encrypt: jest.fn().mockResolvedValue('6PYKMockEncryptedWalletKey111111111111111111111111111111111111')
  }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  chmodSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));

describe('WalletService', () => {
  let walletService: WalletService;
  const testWalletsDir = './test-wallets';

  beforeEach(() => {
    jest.clearAllMocks();
    walletService = new WalletService(testWalletsDir);
  });

  describe('constructor', () => {
    it('should create a wallet service with the specified directory', () => {
      expect(walletService).toBeDefined();
      expect(fs.existsSync).toHaveBeenCalledWith(testWalletsDir);
    });

    it('should create the wallets directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      const service = new WalletService(testWalletsDir);
      expect(service).toBeDefined();
      expect(fs.mkdirSync).toHaveBeenCalledWith(testWalletsDir, { recursive: true });
    });
  });

  describe('createWallet', () => {
    it('should create a new wallet with the specified password', async () => {
      const result = await walletService.createWallet('password123');

      expect(result).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result).toHaveProperty('publicKey', 'test-public-key');
      expect(result).toHaveProperty('encryptedPrivateKey');
      expect(result).toHaveProperty('keyFormat', 'nep2');
      expect(result).toHaveProperty('createdAt');
      expect(result.encryptedPrivateKey).toBe('6PYKMockEncryptedWalletKey111111111111111111111111111111111111');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [walletPath, walletPayload] = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(walletPath).toBe(path.join(testWalletsDir, 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr.json'));
      expect(typeof walletPayload).toBe('string');
      expect(fs.chmodSync).toHaveBeenCalledWith(walletPath, 0o600);
    });

    it('should throw an error if wallet creation fails', async () => {
      (neonJs.wallet.Account as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('account creation failed');
      });

      await expect(walletService.createWallet('password123')).rejects.toThrow('Failed to create wallet');
    });
  });

  describe('getWallet', () => {
    it('should return wallet information for the specified address', async () => {
      const mockWalletData = {
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'encrypted-private-key',
        keyFormat: 'nep2',
        createdAt: new Date().toISOString()
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockWalletData));

      const result = await walletService.getWallet('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');

      expect(result).toEqual(mockWalletData);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(testWalletsDir, 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr.json'),
        'utf-8'
      );
    });

    it('should throw an error if the wallet does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      await expect(walletService.getWallet('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr')).rejects.toThrow('Wallet not found');
    });
  });

  describe('importWallet', () => {
    it('should import a wallet from a private key and persist when password is provided', async () => {
      const result = await walletService.importWallet('private-key', 'password123');

      expect(result).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result).toHaveProperty('publicKey', 'test-public-key');
      expect(result).toHaveProperty('encryptedPrivateKey');
      expect(result).toHaveProperty('keyFormat', 'nep2');
      expect(result.encryptedPrivateKey).toBe('6PYKMockEncryptedWalletKey111111111111111111111111111111111111');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(testWalletsDir, 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr.json'),
        expect.any(String)
      );
      expect(fs.chmodSync).toHaveBeenCalledWith(
        path.join(testWalletsDir, 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr.json'),
        0o600
      );
    });

    it('should support stateless import without a password', async () => {
      const result = await walletService.importWallet('private-key');

      expect(result).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'test-public-key'
      });
      expect(neonJs.wallet.encrypt).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should throw an error if wallet import fails', async () => {
      (neonJs.wallet.Account as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('invalid key');
      });

      await expect(walletService.importWallet('bad-key', 'password123')).rejects.toThrow('Failed to import wallet');
    });
  });
});
