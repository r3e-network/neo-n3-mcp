import * as neonJs from '@cityofzion/neon-js';
import { ValidationError } from './errors';

const HASH160_PATTERN = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HASH256_PATTERN = /^[0-9a-fA-F]{64}$/;
const CANONICAL_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const VM_INTEGER_MIN = -(1n << 255n);
const VM_INTEGER_MAX = (1n << 255n) - 1n;
const MAX_PARAMETER_DEPTH = 32;
const MAX_PARAMETER_NODES = 10_000;
const MAP_KEY_TYPES = new Set([
  'Boolean',
  'ByteArray',
  'Hash160',
  'Hash256',
  'Integer',
  'PublicKey',
  'String',
]);

export interface FormattedContractParameter {
  type: string;
  value?: string | boolean | FormattedContractParameter[] | Array<{
    key: FormattedContractParameter;
    value: FormattedContractParameter;
  }> | null;
}

interface FormatContext {
  nodes: number;
}

function validationError(message: string): never {
  throw new ValidationError(`Invalid contract parameter: ${message}`);
}

function normalizeInteger(value: unknown): string {
  let canonical: string;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      return validationError('Fractional numbers are not supported; numeric Integer values must be safe integers');
    }
    canonical = Object.is(value, -0) ? '0' : String(value);
  } else if (typeof value === 'string' && /^(?:0|-?[1-9]\d*)$/.test(value) && value !== '-0') {
    canonical = value;
  } else {
    return validationError('Integer values must be safe integer numbers or canonical signed decimal strings');
  }

  const integer = BigInt(canonical);
  if (integer < VM_INTEGER_MIN || integer > VM_INTEGER_MAX) {
    return validationError('Integer value exceeds the Neo VM integer range');
  }
  return integer.toString();
}

function normalizeInferredBigInt(value: bigint): string {
  if (value < VM_INTEGER_MIN || value > VM_INTEGER_MAX) {
    return validationError('Integer value exceeds the Neo VM integer range');
  }
  return value.toString();
}

function normalizeBase64(value: unknown): string {
  if (typeof value !== 'string' || !CANONICAL_BASE64_PATTERN.test(value)) {
    return validationError('ByteArray values must be canonical base64 strings');
  }
  if (Buffer.from(value, 'base64').toString('base64') !== value) {
    return validationError('ByteArray values must be canonical base64 strings');
  }
  return value;
}

function normalizeHash160(value: unknown): string {
  if (typeof value !== 'string') {
    return validationError('Hash160 values must be script hash or Neo N3 address strings');
  }
  if (HASH160_PATTERN.test(value)) {
    return value.replace(/^0x/i, '').toLowerCase();
  }
  try {
    if (neonJs.wallet.isAddress(value, neonJs.CONST.DEFAULT_ADDRESS_VERSION)) {
      const scriptHash = neonJs.wallet.getScriptHashFromAddress(value);
      if (/^[0-9a-fA-F]{40}$/.test(scriptHash)) {
        return scriptHash.toLowerCase();
      }
    }
  } catch {
    // The normalized validation error below is more useful than an SDK exception.
  }
  return validationError('Hash160 values require a 20-byte hash or checksum-valid Neo N3 address');
}

function normalizeHash256(value: unknown): string {
  if (typeof value !== 'string' || !HASH256_PATTERN.test(value)) {
    return validationError('Hash256 values must be unprefixed 32-byte hexadecimal strings');
  }
  return value.toLowerCase();
}

function normalizePublicKey(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:02|03)[0-9a-fA-F]{64}$/.test(value)) {
    return validationError('PublicKey values must be compressed 33-byte public keys');
  }
  try {
    if (!neonJs.wallet.isPublicKey(value, true)) {
      return validationError('PublicKey value is not a valid compressed curve point');
    }
  } catch {
    return validationError('PublicKey value is not a valid compressed curve point');
  }
  return value.toLowerCase();
}

function formatString(value: string): FormattedContractParameter {
  if (HASH160_PATTERN.test(value)) {
    return { type: 'Hash160', value: normalizeHash160(value) };
  }

  if (/^[A-Za-z0-9]{34}$/.test(value)) {
    try {
      if (neonJs.wallet.isAddress(value, neonJs.CONST.DEFAULT_ADDRESS_VERSION)) {
        return { type: 'Hash160', value: normalizeHash160(value) };
      }
    } catch {
      // Address-shaped application strings may legitimately be ordinary strings.
    }
  }

  return { type: 'String', value };
}

function formatTypedParameter(
  value: Record<string, unknown>,
  context: FormatContext,
  depth: number
): FormattedContractParameter {
  const type = value.type;
  if (typeof type !== 'string') {
    return validationError('typed values require a string type');
  }

  switch (type) {
    case 'Any':
      if (value.value !== null) {
        return validationError('Any values must be explicit null');
      }
      return { type, value: null };
    case 'Boolean':
      if (typeof value.value !== 'boolean') {
        return validationError('Boolean values must be booleans');
      }
      return { type, value: value.value };
    case 'Integer':
      return { type, value: normalizeInteger(value.value) };
    case 'String':
      if (typeof value.value !== 'string') {
        return validationError('String values must be strings');
      }
      return { type, value: value.value };
    case 'ByteArray':
      return { type, value: normalizeBase64(value.value) };
    case 'Hash160':
      return { type, value: normalizeHash160(value.value) };
    case 'Hash256':
      return { type, value: normalizeHash256(value.value) };
    case 'PublicKey':
      return { type, value: normalizePublicKey(value.value) };
    case 'Array':
      if (!Array.isArray(value.value)) {
        return validationError('Array values must be arrays');
      }
      return {
        type,
        value: value.value.map((entry) => formatContractParameter(entry, context, depth + 1)),
      };
    case 'Map': {
      if (!Array.isArray(value.value)) {
        return validationError('Map values must be arrays of key/value entries');
      }
      const keys = new Set<string>();
      const entries = value.value.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return validationError('Map entries must be key/value objects');
        }
        const record = entry as Record<string, unknown>;
        if (!Object.prototype.hasOwnProperty.call(record, 'key')
          || !Object.prototype.hasOwnProperty.call(record, 'value')) {
          return validationError('Map entries require both key and value');
        }
        const key = formatContractParameter(record.key, context, depth + 1);
        if (!MAP_KEY_TYPES.has(key.type)) {
          return validationError(`Map keys do not support ${key.type}`);
        }
        const keyIdentity = `${key.type}:${JSON.stringify(key.value)}`;
        if (keys.has(keyIdentity)) {
          return validationError('Map keys must be unique after canonicalization');
        }
        keys.add(keyIdentity);
        return {
          key,
          value: formatContractParameter(record.value, context, depth + 1),
        };
      });
      return { type, value: entries };
    }
    default:
      return validationError(`unsupported contract parameter type: ${type}`);
  }
}

function formatContractParameter(
  value: unknown,
  context: FormatContext,
  depth: number
): FormattedContractParameter {
  context.nodes += 1;
  if (context.nodes > MAX_PARAMETER_NODES) {
    return validationError(`parameter graph exceeds ${MAX_PARAMETER_NODES} values`);
  }
  if (depth > MAX_PARAMETER_DEPTH) {
    return validationError(`parameter nesting exceeds ${MAX_PARAMETER_DEPTH} levels`);
  }
  if (value === null) {
    return { type: 'Any', value: null };
  }
  if (value === undefined) {
    return validationError('undefined is not a supported contract argument');
  }
  if (typeof value === 'string') {
    return formatString(value);
  }
  if (typeof value === 'number') {
    return { type: 'Integer', value: normalizeInteger(value) };
  }
  if (typeof value === 'bigint') {
    return { type: 'Integer', value: normalizeInferredBigInt(value) };
  }
  if (typeof value === 'boolean') {
    return { type: 'Boolean', value };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { type: 'ByteArray', value: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) {
    return {
      type: 'Array',
      value: value.map((entry) => formatContractParameter(entry, context, depth + 1)),
    };
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown> & { toJson?: () => unknown };
    if (typeof record.toJson === 'function') {
      return formatContractParameter(record.toJson(), context, depth + 1);
    }
    if (Object.prototype.hasOwnProperty.call(record, 'type')) {
      return formatTypedParameter(record, context, depth);
    }
    const prototype = Object.getPrototypeOf(record);
    if (prototype !== Object.prototype && prototype !== null) {
      return validationError('unsupported object argument');
    }
    return {
      type: 'Map',
      value: Object.entries(record).map(([key, entryValue]) => ({
        key: { type: 'String', value: key },
        value: formatContractParameter(entryValue, context, depth + 1),
      })),
    };
  }

  return validationError(`unsupported argument type: ${typeof value}`);
}

export function formatContractParameters(values: unknown[]): FormattedContractParameter[] {
  if (!Array.isArray(values)) {
    throw new ValidationError('Contract arguments must be an array');
  }
  const context: FormatContext = { nodes: 0 };
  return values.map((value) => formatContractParameter(value, context, 0));
}
