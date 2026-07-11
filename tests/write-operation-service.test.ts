import { mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { WriteOperationService } from '../src/services/write-operation-service';
import { SubmissionOutcomeUnknownError } from '../src/utils/rpc-deadline';

describe('WriteOperationService', () => {
  let stateDirectory: string;

  beforeEach(() => {
    stateDirectory = mkdtempSync(join(tmpdir(), 'neo-write-operations-'));
  });

  afterEach(async () => {
    await rm(stateDirectory, { recursive: true, force: true });
  });

  const intent = {
    operation: 'transfer_assets',
    network: 'testnet',
    signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
    payload: {
      asset: 'GAS',
      amount: '1',
      toAddress: 'NR8vZB6LijzinRcjbc1y8mZ8gbqrERbGpr',
    },
  };

  test('reserves one immutable intent per idempotency key', () => {
    const service = new WriteOperationService(stateDirectory);
    const first = service.reserve('transfer-request-001', intent);
    const retry = service.reserve('transfer-request-001', intent);

    expect(retry).toEqual(first);
    expect(first).toMatchObject({
      state: 'awaiting_approval',
      operation: 'transfer_assets',
      network: 'testnet',
    });
    expect(first.intentId).toMatch(/^[0-9a-f]{64}$/);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(() => service.reserve('transfer-request-001', {
      ...intent,
      payload: { ...intent.payload, amount: '2' },
    })).toThrow(/idempotency key.*different request/i);
  });

  test('persists approval and the exact signed transaction before submission', () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-002', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    service.markPreparing(reserved.intentId);
    service.recordPrepared(reserved.intentId, {
      rawTransaction: 'aa55',
      txid: `0x${'a'.repeat(64)}`,
      validUntilBlock: 12345,
    });
    service.markOutcomeUnknown(reserved.intentId, 'RPC response was not definitive');

    const reloaded = new WriteOperationService(stateDirectory).getById(reserved.intentId);
    expect(reloaded).toMatchObject({
      state: 'outcome_unknown',
      rawTransaction: 'aa55',
      txid: `0x${'a'.repeat(64)}`,
      validUntilBlock: 12345,
    });
    expect(statSync(stateDirectory).mode & 0o077).toBe(0);
    expect(statSync(join(stateDirectory, `${reserved.intentId}.json`)).mode & 0o077).toBe(0);
    expect(readFileSync(join(stateDirectory, `${reserved.intentId}.json`), 'utf8')).not.toContain('transfer-request-002');
  });

  test('durably fsyncs a newly reserved intent and its directory', () => {
    const fsync = jest.spyOn(require('fs'), 'fsyncSync');
    const service = new WriteOperationService(stateDirectory);
    fsync.mockClear();

    service.reserve('transfer-request-fsync', intent);

    expect(fsync).toHaveBeenCalledTimes(2);
    fsync.mockRestore();
  });

  test('does not delete a competing journal record when exclusive creation loses a race', () => {
    const service = new WriteOperationService(stateDirectory);
    const fsModule = require('fs') as typeof import('fs');
    const originalOpen = fsModule.openSync;
    const competingContents = '{"createdBy":"another-process"}';
    const open = jest.spyOn(fsModule, 'openSync').mockImplementation((filePath, flags, mode) => {
      if (typeof filePath === 'string' && filePath.endsWith('.json') && flags === 'wx') {
        const descriptor = originalOpen(filePath, 'wx', 0o600);
        try {
          writeFileSync(descriptor, competingContents, 'utf8');
        } finally {
          fsModule.closeSync(descriptor);
        }
        throw Object.assign(new Error('already exists'), { code: 'EEXIST' });
      }
      return originalOpen(filePath, flags, mode);
    });

    try {
      expect(() => service.reserve('transfer-request-race', intent)).toThrow(/already exists/i);
      const intentId = require('crypto').createHash('sha256')
        .update('transfer-request-race', 'utf8')
        .digest('hex');
      expect(readFileSync(join(stateDirectory, `${intentId}.json`), 'utf8')).toBe(competingContents);
    } finally {
      open.mockRestore();
    }
  });

  test('rejects a symlink used as the state directory', async () => {
    const symlinkPath = `${stateDirectory}-link`;
    symlinkSync(stateDirectory, symlinkPath, 'dir');
    try {
      expect(() => new WriteOperationService(symlinkPath)).toThrow(/symlink/i);
    } finally {
      await rm(symlinkPath, { force: true });
    }
  });

  test('rejects malformed persisted records instead of trusting parsed JSON', () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-invalid-record', intent);
    writeFileSync(
      join(stateDirectory, `${reserved.intentId}.json`),
      JSON.stringify({ ...reserved, state: 'invented-state' }),
      { mode: 0o600 }
    );

    expect(() => service.getById(reserved.intentId)).toThrow(/persisted write intent/i);
  });

  test('persists plain-object preparation metadata across restarts', () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-metadata', intent);
    service.approve(reserved.intentId, reserved.fingerprint);

    expect(() => service.recordPrepared(reserved.intentId, {
      rawTransaction: 'aa55',
      txid: `0x${'f'.repeat(64)}`,
      validUntilBlock: 12345,
      metadata: [] as unknown as Record<string, unknown>,
    })).toThrow(/metadata.*object/i);

    service.recordPrepared(reserved.intentId, {
      rawTransaction: 'aa55',
      txid: `0x${'f'.repeat(64)}`,
      validUntilBlock: 12345,
      metadata: { contractHash: `0x${'1'.repeat(40)}` },
    });

    expect(new WriteOperationService(stateDirectory).getById(reserved.intentId).metadata).toEqual({
      contractHash: `0x${'1'.repeat(40)}`,
    });
  });

  test('requires the exact fingerprint for approval and preserves terminal results', () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-003', intent);

    expect(() => service.approve(reserved.intentId, 'b'.repeat(64))).toThrow(/fingerprint/i);
    service.approve(reserved.intentId, reserved.fingerprint);
    service.recordPrepared(reserved.intentId, {
      rawTransaction: 'aa55',
      txid: `0x${'c'.repeat(64)}`,
      validUntilBlock: 12345,
    });
    service.markBroadcastSucceeded(reserved.intentId);
    service.complete(reserved.intentId, { txid: `0x${'c'.repeat(64)}` });

    expect(service.getById(reserved.intentId)).toMatchObject({
      state: 'submitted',
      result: { txid: `0x${'c'.repeat(64)}` },
    });
  });

  test('serializes concurrent work for the same intent', async () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-004', intent);
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = service.runExclusive(reserved.intentId, async () => {
      events.push('first-start');
      await firstCanFinish;
      events.push('first-end');
    });
    const second = service.runExclusive(reserved.intentId, async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-end', 'second']);
  });

  test('replays the persisted transaction after an unknown outcome without preparing again', async () => {
    const txid = `0x${'d'.repeat(64)}`;
    const prepared = { rawTransaction: 'aa55', txid, validUntilBlock: 50_000 };
    const firstService = new WriteOperationService(stateDirectory);
    const reserved = firstService.reserve('transfer-request-005', intent);
    firstService.approve(reserved.intentId, reserved.fingerprint);
    const prepare = jest.fn().mockResolvedValue(prepared);
    const firstSubmit = jest.fn().mockRejectedValue(
      new SubmissionOutcomeUnknownError(txid, 'transport_error')
    );

    const firstReconcile = jest.fn().mockResolvedValue(false);
    await expect(firstService.execute(reserved.intentId, {
      prepare,
      submit: firstSubmit,
      reconcile: firstReconcile,
      isExpired: jest.fn().mockResolvedValue(false),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).rejects.toBeInstanceOf(SubmissionOutcomeUnknownError);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(firstReconcile).not.toHaveBeenCalled();
    expect(firstSubmit).toHaveBeenCalledWith(prepared);

    const restartedService = new WriteOperationService(stateDirectory);
    const retryPrepare = jest.fn();
    const retrySubmit = jest.fn().mockResolvedValue(txid);
    await expect(restartedService.execute(reserved.intentId, {
      prepare: retryPrepare,
      submit: retrySubmit,
      reconcile: jest.fn().mockResolvedValue(false),
      isExpired: jest.fn().mockResolvedValue(false),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).resolves.toEqual({ txid });

    expect(retryPrepare).not.toHaveBeenCalled();
    expect(retrySubmit).toHaveBeenCalledWith(prepared);
    expect(restartedService.getById(reserved.intentId)).toMatchObject({
      state: 'submitted',
      rawTransaction: prepared.rawTransaction,
      txid,
      result: { txid },
    });
  });

  test('reconciles an uncertain transaction before considering byte-identical resubmission', async () => {
    const txid = `0x${'e'.repeat(64)}`;
    const prepared = { rawTransaction: 'bb66', txid, validUntilBlock: 50_000 };
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-006', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    service.markPreparing(reserved.intentId);
    service.recordPrepared(reserved.intentId, prepared);
    service.markOutcomeUnknown(reserved.intentId, 'timeout');
    const submit = jest.fn();

    await expect(service.execute(reserved.intentId, {
      prepare: jest.fn(),
      submit,
      reconcile: jest.fn().mockResolvedValue(true),
      isExpired: jest.fn().mockResolvedValue(false),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).resolves.toEqual({ txid });
    expect(submit).not.toHaveBeenCalled();
  });

  test('does not mark a relayed transaction rejected when local result persistence fails', async () => {
    const txid = `0x${'f'.repeat(64)}`;
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-post-submit-failure', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    jest.spyOn(service, 'complete').mockImplementationOnce(() => {
      throw new Error('simulated local persistence failure');
    });
    const submit = jest.fn().mockResolvedValue(txid);

    await expect(service.execute(reserved.intentId, {
      prepare: jest.fn().mockResolvedValue({
        rawTransaction: 'aa55',
        txid,
        validUntilBlock: 50_000,
      }),
      submit,
      reconcile: jest.fn(),
      isExpired: jest.fn(),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).rejects.toThrow(/persistence failure/i);

    expect(service.getById(reserved.intentId).state).toBe('submitted');
    await expect(service.execute(reserved.intentId, {
      prepare: jest.fn(),
      submit: jest.fn(),
      reconcile: jest.fn(),
      isExpired: jest.fn(),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).resolves.toEqual({ txid });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('allows approval retries for already approved and recoverable records', () => {
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-approval-retry', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    service.recordPrepared(reserved.intentId, {
      rawTransaction: 'aa55',
      txid: `0x${'9'.repeat(64)}`,
      validUntilBlock: 50_000,
    });
    service.markOutcomeUnknown(reserved.intentId, 'timeout');

    expect(service.approve(reserved.intentId, reserved.fingerprint).state)
      .toBe('outcome_unknown');
    service.markBroadcastSucceeded(reserved.intentId);
    service.complete(reserved.intentId, { txid: `0x${'9'.repeat(64)}` });
    expect(service.approve(reserved.intentId, reserved.fingerprint).state).toBe('submitted');
  });

  test('rejects a state directory locked by another live process', () => {
    const foreignPid = process.ppid;
    if (!foreignPid || foreignPid === process.pid) return;
    writeFileSync(join(stateDirectory, '.writer.lock'), JSON.stringify({ pid: foreignPid }), {
      mode: 0o600,
    });

    expect(() => new WriteOperationService(stateDirectory))
      .toThrow(/another process|writer lock/i);
  });

  test('rejects oversized intent payloads before creating a journal', () => {
    const service = new WriteOperationService(stateDirectory);

    expect(() => service.reserve('oversized-intent-request', {
      ...intent,
      payload: { data: 'x'.repeat(300_000) },
    })).toThrow(/too large/i);
  });

  test('enforces a bounded journal record quota', () => {
    const service = new WriteOperationService(stateDirectory);
    const readdir = jest.spyOn(require('fs'), 'readdirSync').mockReturnValue(
      Array.from({ length: 1000 }, (_, index) => `${String(index).padStart(64, '0')}.json`)
    );

    expect(() => service.reserve('journal-quota-request', intent)).toThrow(/quota/i);
    readdir.mockRestore();
  });

  test('completes a submitted journal without reconciling or submitting again', async () => {
    const txid = `0x${'2'.repeat(64)}`;
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-submitted', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    service.recordPrepared(reserved.intentId, {
      rawTransaction: 'cc77',
      txid,
      validUntilBlock: 50_000,
      metadata: { asset: 'GAS' },
    });
    service.markBroadcastSucceeded(reserved.intentId);
    const buildResult = jest.fn((submittedTxid, metadata) => ({
      txid: submittedTxid,
      metadata,
    }));
    const callbacks = {
      prepare: jest.fn(),
      submit: jest.fn(),
      reconcile: jest.fn(),
      isExpired: jest.fn(),
      buildResult,
    };

    await expect(new WriteOperationService(stateDirectory).execute(
      reserved.intentId,
      callbacks
    )).resolves.toEqual({ txid, metadata: { asset: 'GAS' } });

    expect(callbacks.prepare).not.toHaveBeenCalled();
    expect(callbacks.reconcile).not.toHaveBeenCalled();
    expect(callbacks.submit).not.toHaveBeenCalled();
    expect(buildResult).toHaveBeenCalledWith(txid, { asset: 'GAS' });
  });

  test('records a definitive submission failure as rejected', async () => {
    const txid = `0x${'3'.repeat(64)}`;
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-rejected', intent);
    service.approve(reserved.intentId, reserved.fingerprint);

    await expect(service.execute(reserved.intentId, {
      prepare: jest.fn().mockResolvedValue({
        rawTransaction: 'dd88',
        txid,
        validUntilBlock: 50_000,
      }),
      submit: jest.fn().mockRejectedValue(new Error('policy rejected transaction')),
      reconcile: jest.fn(),
      isExpired: jest.fn(),
      buildResult: (submittedTxid) => ({ txid: submittedTxid }),
    })).rejects.toThrow('policy rejected transaction');

    expect(service.getById(reserved.intentId)).toMatchObject({
      state: 'rejected',
      error: 'policy rejected transaction',
    });
  });

  test('passes preparation metadata to result construction after successful submission', async () => {
    const txid = `0x${'4'.repeat(64)}`;
    const metadata = { contractHash: `0x${'5'.repeat(40)}` };
    const service = new WriteOperationService(stateDirectory);
    const reserved = service.reserve('transfer-request-result-metadata', intent);
    service.approve(reserved.intentId, reserved.fingerprint);
    const buildResult = jest.fn((submittedTxid, preparedMetadata) => ({
      txid: submittedTxid,
      ...preparedMetadata,
    }));

    await expect(service.execute(reserved.intentId, {
      prepare: jest.fn().mockResolvedValue({
        rawTransaction: 'ee99',
        txid,
        validUntilBlock: 50_000,
        metadata,
      }),
      submit: jest.fn().mockResolvedValue(txid),
      reconcile: jest.fn(),
      isExpired: jest.fn(),
      buildResult,
    })).resolves.toEqual({ txid, ...metadata });

    expect(buildResult).toHaveBeenCalledWith(txid, metadata);
  });
});
