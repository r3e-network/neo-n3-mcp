import * as neonJs from '@cityofzion/neon-js';
import { NeoNetwork, NeoService } from '../src/services/neo-service';

describe('NeoService wallet compatibility helpers', () => {
  jest.setTimeout(30_000);

  test('creates and imports a real encrypted NEP-2 wallet asynchronously', async () => {
    const service = new NeoService('http://127.0.0.1:10332', NeoNetwork.TESTNET);
    const password = 'correct horse battery staple';

    const created = await service.createWallet(password);
    expect(typeof created.encryptedPrivateKey).toBe('string');
    expect(neonJs.wallet.isNEP2(created.encryptedPrivateKey as unknown as string)).toBe(true);

    const imported = await service.importWallet(
      created.encryptedPrivateKey as unknown as string,
      password,
    );
    expect(imported).toEqual({
      address: created.address,
      publicKey: created.publicKey,
    });
  });

  test('rejects invalid wallet material without echoing it', async () => {
    const service = new NeoService('http://127.0.0.1:10332', NeoNetwork.TESTNET);
    const secret = 'invalid-secret-wallet-material';

    const outcome = Promise.resolve().then(() => service.importWallet(secret));
    await expect(outcome).rejects.toThrow(/invalid (?:WIF|private key|wallet)/i);
    await expect(outcome).rejects.not.toThrow(secret);
  });

  test('rejects empty or whitespace-only wallet passphrases', async () => {
    const service = new NeoService('http://127.0.0.1:10332', NeoNetwork.TESTNET);

    await expect(service.createWallet('')).rejects.toThrow(/password/i);
    await expect(service.createWallet('        ')).rejects.toThrow(/password/i);
  });
});
