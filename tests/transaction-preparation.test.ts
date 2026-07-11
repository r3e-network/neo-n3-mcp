import * as neonJs from '@cityofzion/neon-js';
import {
  DEFAULT_MAX_TRANSACTION_FEE_DATOS,
  prepareTransactionForSigning,
} from '../src/utils/transaction-preparation';
import type { NeonRpcClient } from '../src/types/neon';
import { ValidationError } from '../src/utils/errors';

describe('transaction preparation', () => {
  test('default fee ceiling leaves headroom above Neo deployment minimum', () => {
    const minimumDeploymentFeeDatos = 1_000_000_000n;

    expect(DEFAULT_MAX_TRANSACTION_FEE_DATOS).toBeGreaterThan(minimumDeploymentFeeDatos);
  });

  test('rejects a transaction when the signer cannot cover its GAS fees', async () => {
    const account = new neonJs.wallet.Account();
    const transaction = new neonJs.tx.Transaction();
    transaction.script = neonJs.u.HexString.fromHex('11');
    transaction.addSigner({
      account: account.scriptHash,
      scopes: neonJs.tx.WitnessScope.CalledByEntry,
    });

    const rpcClient = {
      getBlockCount: jest.fn().mockResolvedValue(100),
      invokeScript: jest.fn().mockResolvedValue({
        state: 'HALT',
        gasconsumed: '10000000',
      }),
      calculateNetworkFee: jest.fn().mockResolvedValue(2000000),
      invokeFunction: jest.fn().mockResolvedValue({
        state: 'HALT',
        stack: [{ type: 'Integer', value: '11999999' }],
      }),
    } as unknown as NeonRpcClient;

    await expect(
      prepareTransactionForSigning(transaction, account, rpcClient)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects RPC-provided fees above the configured transaction ceiling', async () => {
    const account = new neonJs.wallet.Account();
    const transaction = new neonJs.tx.Transaction();
    transaction.script = neonJs.u.HexString.fromHex('11');
    transaction.addSigner({
      account: account.scriptHash,
      scopes: neonJs.tx.WitnessScope.CalledByEntry,
    });
    const rpcClient = {
      getBlockCount: jest.fn().mockResolvedValue(100),
      invokeScript: jest.fn().mockResolvedValue({
        state: 'HALT',
        gasconsumed: '300000000000',
      }),
      calculateNetworkFee: jest.fn().mockResolvedValue(0),
      invokeFunction: jest.fn().mockResolvedValue({
        state: 'HALT',
        stack: [{ type: 'Integer', value: '400000000000' }],
      }),
    } as unknown as NeonRpcClient;

    await expect(
      prepareTransactionForSigning(transaction, account, rpcClient)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(rpcClient.invokeFunction).not.toHaveBeenCalled();
  });

  test('rejects malformed RPC-provided network fees', async () => {
    const account = new neonJs.wallet.Account();
    const transaction = new neonJs.tx.Transaction();
    transaction.script = neonJs.u.HexString.fromHex('11');
    transaction.addSigner({
      account: account.scriptHash,
      scopes: neonJs.tx.WitnessScope.CalledByEntry,
    });
    const rpcClient = {
      getBlockCount: jest.fn().mockResolvedValue(100),
      invokeScript: jest.fn().mockResolvedValue({ state: 'HALT', gasconsumed: '1' }),
      calculateNetworkFee: jest.fn().mockResolvedValue({ toString: () => '-1' }),
      invokeFunction: jest.fn(),
    } as unknown as NeonRpcClient;

    await expect(
      prepareTransactionForSigning(transaction, account, rpcClient)
    ).rejects.toThrow(/invalid network fee/i);
  });

  test.each(['BREAK', '', undefined])('rejects non-HALT system-fee VM state %p', async (state) => {
    const account = new neonJs.wallet.Account();
    const transaction = new neonJs.tx.Transaction();
    transaction.script = neonJs.u.HexString.fromHex('11');
    transaction.addSigner({
      account: account.scriptHash,
      scopes: neonJs.tx.WitnessScope.CalledByEntry,
    });
    const rpcClient = {
      getBlockCount: jest.fn().mockResolvedValue(100),
      invokeScript: jest.fn().mockResolvedValue({ state, gasconsumed: '1' }),
      calculateNetworkFee: jest.fn(),
      invokeFunction: jest.fn(),
    } as unknown as NeonRpcClient;

    await expect(prepareTransactionForSigning(transaction, account, rpcClient))
      .rejects.toThrow(/script execution failed|VM state/i);
    expect(rpcClient.calculateNetworkFee).not.toHaveBeenCalled();
  });
});
