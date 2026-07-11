import * as neonJs from '@cityofzion/neon-js';
import { chmodSync, chownSync, mkdtempSync, symlinkSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SignerProvider } from '../src/services/signer-provider';

describe('SignerProvider', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'neo-signer-provider-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('loads one owner-only WIF and requires the public signer address to match', () => {
    const account = new neonJs.wallet.Account();
    const signerFile = join(directory, 'signer.wif');
    writeFileSync(signerFile, `${account.WIF}\n`, { mode: 0o600 });

    const provider = new SignerProvider(signerFile);

    expect(provider.signerAddress).toBe(account.address);
    expect(provider.getAccount(account.address).address).toBe(account.address);
    expect(() => provider.getAccount(new neonJs.wallet.Account().address)).toThrow(/configured signer/i);
  });

  test('rejects signer files readable by group or other users', () => {
    const account = new neonJs.wallet.Account();
    const signerFile = join(directory, 'signer.wif');
    writeFileSync(signerFile, account.WIF, { mode: 0o600 });
    chmodSync(signerFile, 0o640);

    expect(() => new SignerProvider(signerFile)).toThrow(/owner-only/i);
  });

  test('rejects a signer file owned by another user when ownership can be changed', () => {
    if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
    const account = new neonJs.wallet.Account();
    const signerFile = join(directory, 'foreign-signer.wif');
    writeFileSync(signerFile, account.WIF, { mode: 0o600 });
    chownSync(signerFile, 65534, 65534);

    expect(() => new SignerProvider(signerFile)).toThrow(/owned by the current user/i);
  });

  test('rejects symlinked and invalid signer files without leaking file contents', () => {
    const target = join(directory, 'target.wif');
    const link = join(directory, 'signer.wif');
    const invalidSecret = 'not-a-valid-secret-wif';
    writeFileSync(target, invalidSecret, { mode: 0o600 });
    symlinkSync(target, link);

    expect(() => new SignerProvider(link)).toThrow(/regular.*non-symlink|symlink/i);

    let error: Error | undefined;
    try {
      new SignerProvider(target);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).toMatch(/valid Neo WIF/i);
    expect(error?.message).not.toContain(invalidSecret);
  });

  test('rejects an oversized signer file before reading it', () => {
    const signerFile = join(directory, 'oversized.wif');
    writeFileSync(signerFile, 'x'.repeat(5000), { mode: 0o600 });

    expect(() => new SignerProvider(signerFile)).toThrow(/too large/i);
  });
});
