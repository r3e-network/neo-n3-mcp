import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ValidationError } from '../utils/errors';
import { SubmissionOutcomeUnknownError } from '../utils/rpc-deadline';

export type WriteOperationState =
  | 'awaiting_approval'
  | 'approved'
  | 'preparing'
  | 'submitting'
  | 'outcome_unknown'
  | 'submitted'
  | 'rejected'
  | 'failed_before_submission'
  | 'declined'
  | 'expired';

export interface WriteIntent {
  operation: string;
  network: string;
  signerAddress: string;
  payload: Record<string, unknown>;
}

export interface PreparedTransaction {
  rawTransaction: string;
  txid: string;
  validUntilBlock: number;
  metadata?: Record<string, unknown>;
}

export interface WriteExecutionCallbacks {
  prepare(): Promise<PreparedTransaction>;
  submit(prepared: PreparedTransaction): Promise<string>;
  reconcile(txid: string): Promise<boolean>;
  isExpired(validUntilBlock: number): Promise<boolean>;
  buildResult(txid: string, metadata?: Record<string, unknown>): Record<string, unknown>;
}

export interface WriteOperationRecord extends WriteIntent {
  intentId: string;
  fingerprint: string;
  state: WriteOperationState;
  createdAt: string;
  updatedAt: string;
  rawTransaction?: string;
  txid?: string;
  validUntilBlock?: number;
  metadata?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const WRITE_OPERATION_STATES = new Set<WriteOperationState>([
  'awaiting_approval',
  'approved',
  'preparing',
  'submitting',
  'outcome_unknown',
  'submitted',
  'rejected',
  'failed_before_submission',
  'declined',
  'expired',
]);
const MAX_WRITE_INTENT_BYTES = 256 * 1024;
const MAX_WRITE_INTENT_RECORDS = 1000;

export class WriteOperationService {
  private static readonly processLockToken = randomUUID();
  private static readonly activeOperationsByDirectory = new Map<string, Map<string, Promise<void>>>();
  private readonly activeOperations: Map<string, Promise<void>>;
  private readonly stateDirectory: string;

  constructor(stateDirectory: string) {
    this.stateDirectory = path.resolve(stateDirectory);
    try {
      fs.mkdirSync(this.stateDirectory, { recursive: true, mode: 0o700 });
      const directoryStat = fs.lstatSync(this.stateDirectory);
      if (directoryStat.isSymbolicLink()) {
        throw new ValidationError('Write state directory must not be a symlink');
      }
      if (!directoryStat.isDirectory()) {
        throw new ValidationError('Write state path must be a directory');
      }
      fs.chmodSync(this.stateDirectory, 0o700);
      this.acquireWriterLock();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(`Write state directory is unavailable: ${this.safeErrorMessage(error)}`);
    }
    this.activeOperations = WriteOperationService.activeOperationsByDirectory.get(this.stateDirectory)
      ?? new Map<string, Promise<void>>();
    WriteOperationService.activeOperationsByDirectory.set(this.stateDirectory, this.activeOperations);
  }

  reserve(idempotencyKey: string, intent: WriteIntent): WriteOperationRecord {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new ValidationError(
        'Idempotency key must contain 8-128 letters, numbers, periods, underscores, colons, or hyphens'
      );
    }
    this.validateIntent(intent);
    if (Buffer.byteLength(canonicalJson(intent), 'utf8') > MAX_WRITE_INTENT_BYTES) {
      throw new ValidationError('Write intent is too large');
    }

    const intentId = sha256(idempotencyKey);
    const fingerprint = sha256(canonicalJson(intent));
    const existing = this.read(intentId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ValidationError('Idempotency key is already bound to a different request');
      }
      return existing;
    }
    const recordCount = fs.readdirSync(this.stateDirectory)
      .filter((name) => /^[0-9a-f]{64}\.json$/.test(name))
      .length;
    if (recordCount >= MAX_WRITE_INTENT_RECORDS) {
      throw new ValidationError(
        `Write intent journal quota reached (${MAX_WRITE_INTENT_RECORDS} records); archive terminal records before retrying`
      );
    }

    const now = new Date().toISOString();
    const record: WriteOperationRecord = {
      ...intent,
      intentId,
      fingerprint,
      state: 'awaiting_approval',
      createdAt: now,
      updatedAt: now,
    };
    this.create(record);
    return record;
  }

  getById(intentId: string): WriteOperationRecord {
    this.validateIntentId(intentId);
    const record = this.read(intentId);
    if (!record) {
      throw new ValidationError('Write intent not found');
    }
    return record;
  }

  approve(intentId: string, fingerprint: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (record.fingerprint !== fingerprint) {
      throw new ValidationError('Write intent fingerprint does not match');
    }
    if (['approved', 'preparing', 'submitting', 'outcome_unknown', 'submitted'].includes(record.state)) {
      return record;
    }
    if (record.state !== 'awaiting_approval') {
      throw new ValidationError(`Write intent cannot be approved from state ${record.state}`);
    }
    return this.update(record, { state: 'approved' });
  }

  decline(intentId: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (record.state !== 'awaiting_approval') {
      throw new ValidationError(`Write intent cannot be declined from state ${record.state}`);
    }
    return this.update(record, { state: 'declined' });
  }

  markPreparing(intentId: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (record.state !== 'approved' && record.state !== 'preparing') {
      throw new ValidationError(`Write intent cannot be prepared from state ${record.state}`);
    }
    return record.state === 'preparing' ? record : this.update(record, { state: 'preparing' });
  }

  recordPrepared(intentId: string, prepared: PreparedTransaction): WriteOperationRecord {
    const record = this.getById(intentId);
    if (!['approved', 'preparing'].includes(record.state)) {
      throw new ValidationError(`Prepared transaction cannot be recorded from state ${record.state}`);
    }
    this.validatePreparedTransaction(prepared);
    return this.update(record, { ...prepared, state: 'submitting' });
  }

  markOutcomeUnknown(intentId: string, error: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (!record.rawTransaction || !record.txid) {
      throw new ValidationError('Cannot mark an unprepared write intent as outcome unknown');
    }
    return this.update(record, { state: 'outcome_unknown', error });
  }

  markRejected(intentId: string, error: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (!record.rawTransaction || !record.txid) {
      throw new ValidationError('Cannot reject an unprepared write intent during submission');
    }
    return this.update(record, { state: 'rejected', error });
  }

  markBroadcastSucceeded(intentId: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (!record.rawTransaction || !record.txid) {
      throw new ValidationError('Cannot submit an unprepared write intent');
    }
    return this.update(record, { state: 'submitted', error: undefined });
  }

  complete(intentId: string, result: Record<string, unknown>): WriteOperationRecord {
    const record = this.getById(intentId);
    if (record.state !== 'submitted') {
      throw new ValidationError(`Write intent cannot complete from state ${record.state}`);
    }
    return this.update(record, { result });
  }

  failBeforeSubmission(intentId: string, error: string): WriteOperationRecord {
    const record = this.getById(intentId);
    if (record.rawTransaction) {
      throw new ValidationError('A prepared transaction cannot fail before submission');
    }
    return this.update(record, { state: 'failed_before_submission', error });
  }

  execute(
    intentId: string,
    callbacks: WriteExecutionCallbacks
  ): Promise<Record<string, unknown>> {
    return this.runExclusive(intentId, async () => {
      let record = this.getById(intentId);
      if (record.state === 'submitted' && record.result) {
        return record.result;
      }
      if (record.state === 'submitted') {
        const result = callbacks.buildResult(record.txid as string, record.metadata);
        this.complete(intentId, result);
        return result;
      }
      if (['declined', 'expired', 'rejected', 'failed_before_submission'].includes(record.state)) {
        throw new ValidationError(record.error || `Write intent is terminal in state ${record.state}`);
      }
      if (record.state === 'awaiting_approval') {
        throw new ValidationError('Write intent has not been approved');
      }

      let preparedThisExecution = false;
      if (!record.rawTransaction || !record.txid || !record.validUntilBlock) {
        try {
          this.markPreparing(intentId);
          const prepared = await callbacks.prepare();
          record = this.recordPrepared(intentId, prepared);
          preparedThisExecution = true;
        } catch (error) {
          this.failBeforeSubmission(intentId, this.safeErrorMessage(error));
          throw error;
        }
      }

      const prepared: PreparedTransaction = {
        rawTransaction: record.rawTransaction as string,
        txid: record.txid as string,
        validUntilBlock: record.validUntilBlock as number,
        metadata: record.metadata,
      };

      if (!preparedThisExecution && (record.state === 'outcome_unknown' || record.state === 'submitting')) {
        if (await callbacks.reconcile(prepared.txid)) {
          this.markBroadcastSucceeded(intentId);
          const result = callbacks.buildResult(prepared.txid, prepared.metadata);
          this.complete(intentId, result);
          return result;
        }
        if (await callbacks.isExpired(prepared.validUntilBlock)) {
          this.update(this.getById(intentId), {
            state: 'expired',
            error: 'Prepared transaction expired before it could be observed on-chain',
          });
          throw new ValidationError('Prepared transaction expired; use a new idempotency key');
        }
      }

      let submittedTxid: string;
      try {
        submittedTxid = await callbacks.submit(prepared);
        if (submittedTxid.toLowerCase() !== prepared.txid.toLowerCase()) {
          throw new SubmissionOutcomeUnknownError(prepared.txid, 'inconsistent_response');
        }
      } catch (error) {
        if (error instanceof SubmissionOutcomeUnknownError) {
          this.markOutcomeUnknown(intentId, this.safeErrorMessage(error));
        } else {
          this.markRejected(intentId, this.safeErrorMessage(error));
        }
        throw error;
      }
      this.markBroadcastSucceeded(intentId);
      const result = callbacks.buildResult(prepared.txid, prepared.metadata);
      this.complete(intentId, result);
      return result;
    });
  }

  async runExclusive<T>(intentId: string, operation: () => Promise<T>): Promise<T> {
    this.validateIntentId(intentId);
    const previous = this.activeOperations.get(intentId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.activeOperations.set(intentId, queued);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.activeOperations.get(intentId) === queued) {
        this.activeOperations.delete(intentId);
      }
    }
  }

  private safeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Write operation failed';
  }

  private acquireWriterLock(): void {
    const lockPath = path.join(this.stateDirectory, '.writer.lock');
    const lockContent = `${JSON.stringify({
      token: WriteOperationService.processLockToken,
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`;
    try {
      fs.writeFileSync(lockPath, lockContent, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      this.fsyncStateDirectory();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    let ownerToken: string | undefined;
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { token?: unknown };
      if (typeof lock.token === 'string') ownerToken = lock.token;
    } catch {
      ownerToken = undefined;
    }
    if (ownerToken === WriteOperationService.processLockToken) return;
    throw new ValidationError(
      'Write state directory is locked by another process. Remove .writer.lock only after verifying no writer is running.'
    );
  }

  private validateIntent(intent: WriteIntent): void {
    if (!isPlainObject(intent)
      || typeof intent.operation !== 'string' || !intent.operation
      || typeof intent.network !== 'string' || !intent.network
      || typeof intent.signerAddress !== 'string' || !intent.signerAddress) {
      throw new ValidationError('Write intent requires operation, network, signerAddress, and payload');
    }
    if (!isPlainObject(intent.payload)) {
      throw new ValidationError('Write intent payload must be an object');
    }
  }

  private validatePreparedTransaction(prepared: PreparedTransaction): void {
    if (!/^[0-9a-fA-F]+$/.test(prepared.rawTransaction) || prepared.rawTransaction.length % 2 !== 0) {
      throw new ValidationError('Prepared transaction must be an even-length hexadecimal string');
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(prepared.txid)) {
      throw new ValidationError('Prepared transaction ID must be a 32-byte hash');
    }
    if (!Number.isSafeInteger(prepared.validUntilBlock) || prepared.validUntilBlock <= 0) {
      throw new ValidationError('Prepared transaction validity height must be a positive integer');
    }
    if (prepared.metadata !== undefined && !isPlainObject(prepared.metadata)) {
      throw new ValidationError('Prepared transaction metadata must be a plain object');
    }
  }

  private validatePersistedRecord(value: unknown, expectedIntentId: string): WriteOperationRecord {
    if (!isPlainObject(value)) {
      throw new ValidationError('Persisted write intent must be an object');
    }
    const record = value as unknown as WriteOperationRecord;
    try {
      this.validateIntent(record);
      if (record.intentId !== expectedIntentId) throw new Error('identifier does not match its filename');
      if (!/^[0-9a-f]{64}$/.test(record.fingerprint)) throw new Error('fingerprint is invalid');
      const expectedFingerprint = sha256(canonicalJson({
        operation: record.operation,
        network: record.network,
        signerAddress: record.signerAddress,
        payload: record.payload,
      }));
      if (record.fingerprint !== expectedFingerprint) throw new Error('fingerprint does not match the intent');
      if (!WRITE_OPERATION_STATES.has(record.state)) throw new Error('state is invalid');
      if (!this.isIsoDate(record.createdAt) || !this.isIsoDate(record.updatedAt)) {
        throw new Error('timestamps are invalid');
      }
      if (record.error !== undefined && typeof record.error !== 'string') throw new Error('error is invalid');
      if (record.result !== undefined && !isPlainObject(record.result)) throw new Error('result is invalid');

      const hasAnyPreparedField = record.rawTransaction !== undefined
        || record.txid !== undefined
        || record.validUntilBlock !== undefined
        || record.metadata !== undefined;
      if (hasAnyPreparedField) {
        this.validatePreparedTransaction(record as PreparedTransaction);
      }
      if (['submitting', 'outcome_unknown', 'submitted', 'rejected', 'expired'].includes(record.state)
        && !hasAnyPreparedField) {
        throw new Error(`state ${record.state} requires a prepared transaction`);
      }
      if (record.result !== undefined && record.state !== 'submitted') {
        throw new Error('only submitted intents may contain a result');
      }
      return record;
    } catch (error) {
      throw new ValidationError(`Invalid persisted write intent: ${this.safeErrorMessage(error)}`);
    }
  }

  private isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  }

  private validateIntentId(intentId: string): void {
    if (!/^[0-9a-f]{64}$/.test(intentId)) {
      throw new ValidationError('Invalid write intent identifier');
    }
  }

  private recordPath(intentId: string): string {
    return path.join(this.stateDirectory, `${intentId}.json`);
  }

  private read(intentId: string): WriteOperationRecord | undefined {
    this.validateIntentId(intentId);
    const filePath = this.recordPath(intentId);
    let descriptor: number | undefined;
    try {
      const fileStat = fs.lstatSync(filePath);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        throw new ValidationError('Persisted write intent must be a regular file, not a symlink');
      }
      if ((fileStat.mode & 0o077) !== 0) {
        throw new ValidationError('Persisted write intent file permissions are too broad');
      }
      descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const openedFileStat = fs.fstatSync(descriptor);
      if (!openedFileStat.isFile() || (openedFileStat.mode & 0o077) !== 0) {
        throw new ValidationError('Persisted write intent must be an owner-only regular file');
      }
      const parsed = JSON.parse(fs.readFileSync(descriptor, 'utf8')) as unknown;
      return this.validatePersistedRecord(parsed, intentId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      if (error instanceof ValidationError) throw error;
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid persisted write intent JSON: ${error.message}`);
      }
      throw error;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  }

  private create(record: WriteOperationRecord): void {
    const filePath = this.recordPath(record.intentId);
    let descriptor: number | undefined;
    let created = false;
    let fileSynced = false;
    try {
      descriptor = fs.openSync(filePath, 'wx', 0o600);
      created = true;
      fs.writeFileSync(descriptor, JSON.stringify(record, null, 2), 'utf8');
      fs.fsyncSync(descriptor);
      fileSynced = true;
      fs.closeSync(descriptor);
      descriptor = undefined;
      this.fsyncStateDirectory();
    } catch (error) {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (created && !fileSynced) fs.rmSync(filePath, { force: true });
      throw error;
    }
  }

  private update(
    record: WriteOperationRecord,
    changes: Partial<WriteOperationRecord>
  ): WriteOperationRecord {
    const updated = {
      ...record,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    const filePath = this.recordPath(record.intentId);
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(updated, null, 2), 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fs.renameSync(temporaryPath, filePath);
      this.fsyncStateDirectory();
      return updated;
    } catch (error) {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      fs.rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  private fsyncStateDirectory(): void {
    const directoryDescriptor = fs.openSync(
      this.stateDirectory,
      fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW
    );
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  }
}
