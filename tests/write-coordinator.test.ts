import { mkdtempSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { NeoNetwork } from '../src/services/neo-service';
import { WriteCoordinator } from '../src/services/write-coordinator';
import { WriteOperationService } from '../src/services/write-operation-service';

describe('WriteCoordinator', () => {
  let stateDirectory: string;
  const account = {
    address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
    scriptHash: 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e',
  } as any;
  const signerProvider = {
    signerAddress: account.address,
    getAccount: jest.fn().mockReturnValue(account),
  };

  beforeEach(() => {
    stateDirectory = mkdtempSync(join(tmpdir(), 'neo-write-coordinator-'));
    signerProvider.getAccount.mockClear();
  });

  afterEach(async () => {
    await rm(stateDirectory, { recursive: true, force: true });
  });

  test('binds reserved intents to the configured signer without accepting secrets', () => {
    const coordinator = new WriteCoordinator(
      signerProvider,
      new WriteOperationService(stateDirectory),
    );

    const record = coordinator.reserve('transfer-request-100', {
      operation: 'transfer_assets',
      network: NeoNetwork.TESTNET,
      payload: {
        toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
        asset: 'GAS',
        amount: '1',
      },
    });

    expect(record.signerAddress).toBe(account.address);
    expect(JSON.stringify(record)).not.toMatch(/wif|private.?key|password/i);
  });

  test('prepares, persists, and submits a transfer through the configured account', async () => {
    const operationService = new WriteOperationService(stateDirectory);
    const coordinator = new WriteCoordinator(signerProvider, operationService);
    const txid = `0x${'a'.repeat(64)}`;
    const prepared = { rawTransaction: 'aa55', txid, validUntilBlock: 12345 };
    const record = coordinator.reserve('transfer-request-101', {
      operation: 'transfer_assets',
      network: NeoNetwork.TESTNET,
      payload: {
        toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
        asset: 'GAS',
        amount: '1',
      },
    });
    coordinator.approve(record.intentId, record.fingerprint);
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      prepareTransferTransaction: jest.fn().mockResolvedValue(prepared),
      submitPreparedTransaction: jest.fn().mockResolvedValue(txid),
      getTransaction: jest.fn().mockRejectedValue(new Error('Unknown transaction')),
      getBlockCount: jest.fn().mockResolvedValue(100),
    } as any;
    const contractService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
    } as any;

    await expect(coordinator.execute(record.intentId, neoService, contractService))
      .resolves.toMatchObject({
        txid,
        operation: 'transfer_assets',
        network: NeoNetwork.TESTNET,
        signerAddress: account.address,
      });

    expect(signerProvider.getAccount).toHaveBeenCalledWith(account.address);
    expect(neoService.prepareTransferTransaction).toHaveBeenCalledWith(
      account,
      'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
      'GAS',
      '1',
    );
    expect(neoService.submitPreparedTransaction).toHaveBeenCalledWith(prepared);
    expect(operationService.getById(record.intentId)).toMatchObject({
      state: 'submitted',
      rawTransaction: 'aa55',
      result: { txid },
    });
  });

  test('refuses to execute an intent against services for another network', async () => {
    const coordinator = new WriteCoordinator(
      signerProvider,
      new WriteOperationService(stateDirectory),
    );
    const record = coordinator.reserve('transfer-request-102', {
      operation: 'claim_gas',
      network: NeoNetwork.MAINNET,
      payload: {},
    });
    coordinator.approve(record.intentId, record.fingerprint);

    await expect(coordinator.execute(
      record.intentId,
      { getNetwork: () => NeoNetwork.TESTNET } as any,
      { getNetwork: () => NeoNetwork.TESTNET } as any,
    )).rejects.toThrow(/network/i);
  });

  test.each([
    ['transfer_assets', { toAddress: 'invalid', asset: 'GAS', amount: '1' }],
    ['transfer_assets', {
      toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr', asset: 'GAS', amount: '0',
    }],
    ['invoke_contract_write', { scriptHash: 'not-a-hash', operation: 'transfer', args: [] }],
    ['invoke_contract_write', {
      scriptHash: '0x1234567890abcdef1234567890abcdef12345678', operation: '', args: [],
    }],
    ['deploy_contract', { nef: { encoding: 'hex', data: '' }, manifest: {} }],
  ] as const)('rejects invalid %s intent before reservation', (operation, payload) => {
    const coordinator = new WriteCoordinator(
      signerProvider,
      new WriteOperationService(stateDirectory),
    );

    expect(() => coordinator.reserve('invalid-write-request', {
      operation,
      network: NeoNetwork.TESTNET,
      payload,
    })).toThrow();
  });
});
