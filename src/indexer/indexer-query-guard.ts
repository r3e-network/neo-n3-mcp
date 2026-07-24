/**
 * indexer-query-guard — the pure, adversarial guard for the generic `query_indexer`
 * tool (Phase 1). It is a pure function of `METHOD_CATALOG` (src/indexer/indexer-catalog.ts):
 * no I/O, no network, no imports from the tool handler.
 *
 * Two exported functions:
 *  - `assertAllowedMethod(method)` — the method allowlist gate (threat T1/T2). Rejects
 *    any method that is not a vetted, read-only catalog entry BEFORE any network call,
 *    mirroring `assertReadOnlyEvmMethod` (src/contracts/evm-rpc-client.ts) so the error
 *    text names the allowed set and the LLM can self-correct.
 *  - `buildMethodParams(desc, input)` — builds the upstream params object field-by-field
 *    from the descriptor's typed whitelist. Caller keys are NEVER spread through: any
 *    unknown/extra input key is rejected (threat T18), and every value is re-validated by
 *    its declared `ParamType` (threats T12 et al.). Pagination (`limit`/`skip`) is clamped
 *    to the per-method bounds rather than rejected (threats T13/T14).
 *
 * Because the upstream object is assembled only from vetted keys with validated primitive
 * values, no client-authored Mongo object can ever reach neo3fura through this path
 * (injection-proof by construction).
 *
 * Every rejection throws `ValidationError` (src/utils/errors.ts). No input — however
 * malformed or adversarial — may escape as an uncaught crash.
 */

import { ValidationError } from '../utils/errors';
import {
  sanitizeString,
  validateAddress,
  validateBoolean,
  validateHash,
  validateInteger,
  validateScriptHash,
} from '../utils/validation';
import { METHOD_CATALOG, type MethodDescriptor, type ParamSpec } from './indexer-catalog';

/**
 * Input keys tolerated on the params object but NOT forwarded upstream. `network` is
 * resolved independently by the handler (Phase 1 is mainnet-only); it never becomes a
 * Mongo/RPC param, so it is silently ignored here rather than rejected as unknown (T18).
 */
const IGNORED_INPUT_KEYS: ReadonlySet<string> = new Set(['network', 'method', 'params']);

/** Bounds for the `name` param type (server-built bounded regex search upstream). */
const MAX_NAME_LENGTH = 64;

/** Bounds and charset for the `tokenId` param type (base64/hex token id). */
const MAX_TOKEN_ID_LENGTH = 128;
const TOKEN_ID_PATTERN = /^[A-Za-z0-9+/=]+$/;

/**
 * Assert that a caller-supplied method name is a vetted, read-only catalog entry.
 * The catalog key set IS the allowlist (threats T1/T2): write/admin mutators, node
 * passthroughs, and made-up methods are all absent and therefore rejected here, before
 * any URL is resolved or any network call is made.
 *
 * @param method The LLM-facing method key (e.g. `get_address_summary`).
 * @returns The frozen `MethodDescriptor` for the method.
 * @throws {ValidationError} for a missing, non-string, or non-allowlisted method — with a
 *   message that enumerates the permitted methods (mirrors `assertReadOnlyEvmMethod`).
 */
export function assertAllowedMethod(method: string): MethodDescriptor {
  if (!method || typeof method !== 'string') {
    throw new ValidationError(
      `Indexer query method must be a non-empty string. Permitted methods: ${allowedMethodList()}.`,
    );
  }
  const descriptor = METHOD_CATALOG.get(method);
  if (!descriptor) {
    throw new ValidationError(
      `Indexer query method "${method}" is not allowed. Permitted methods: ${allowedMethodList()}.`,
    );
  }
  return descriptor;
}

/**
 * Build the upstream RPC params object for a vetted method from caller input.
 *
 * For each param declared on `desc.params`: read `input[camelKey]`; reject a missing
 * required value; validate/normalize a present value by its `ParamType`; write the result
 * under the exact PascalCase `rpcKey`. `limit`/`skip` are clamped to the method's
 * pagination bounds (and defaulted when absent) instead of rejected. Any input key that is
 * neither a declared param nor a tolerated key (`network`) is rejected (T18) — caller keys
 * are never spread into the upstream object.
 *
 * @param desc  The descriptor returned by {@link assertAllowedMethod}.
 * @param input The caller-supplied params object (may be `undefined`/`null` for no-arg
 *   methods).
 * @returns A fresh object keyed by the upstream PascalCase param names, values validated.
 * @throws {ValidationError} for a non-object input, an unknown key, a missing required
 *   param, or any value that fails its type validation.
 */
export function buildMethodParams(
  desc: MethodDescriptor,
  input: unknown,
): Record<string, unknown> {
  const params = asPlainObject(input);
  const declaredKeys = new Set(Object.keys(desc.params));

  // Strict per-method whitelist: reject any key not declared (or explicitly tolerated).
  for (const key of Object.keys(params)) {
    if (!declaredKeys.has(key) && !IGNORED_INPUT_KEYS.has(key)) {
      const allowed = [...declaredKeys].join(', ') || '(none)';
      throw new ValidationError(
        `Unknown parameter "${key}" for indexer method "${desc.rpcMethod}". Allowed parameters: ${allowed}.`,
      );
    }
  }

  const upstream: Record<string, unknown> = {};
  for (const [camelKey, spec] of Object.entries(desc.params)) {
    const rawValue = params[camelKey];

    // Pagination params are clamped to the method bounds, not rejected, and are always
    // emitted (defaulted when absent) so upstream never runs an unbounded page.
    if (desc.pagination && (camelKey === 'limit' || camelKey === 'skip')) {
      upstream[spec.rpcKey] = clampPagination(camelKey, rawValue, desc);
      continue;
    }

    if (rawValue === undefined || rawValue === null) {
      if (spec.required) {
        throw new ValidationError(
          `Missing required parameter "${camelKey}" for indexer method "${desc.rpcMethod}".`,
        );
      }
      continue;
    }

    upstream[spec.rpcKey] = validateByType(camelKey, spec, rawValue);
  }

  return upstream;
}

/** Enumerate the permitted method keys for error messages (mirrors the EVM guard). */
function allowedMethodList(): string {
  return [...METHOD_CATALOG.keys()].join(', ');
}

/** Narrow arbitrary input to a plain params object; treat null/undefined as empty. */
function asPlainObject(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Indexer query params must be an object');
  }
  return input as Record<string, unknown>;
}

/**
 * Clamp a `limit`/`skip` value into the method's pagination window (T13/T14). A present
 * value is first validated as a non-negative safe integer, then clamped; an absent value
 * falls back to the method default (`defaultLimit` for limit, 0 for skip).
 */
function clampPagination(
  key: 'limit' | 'skip',
  rawValue: unknown,
  desc: MethodDescriptor,
): number {
  const page = desc.pagination;
  if (!page) {
    // Unreachable given the call site guard, but keeps the function total.
    throw new ValidationError(`Method "${desc.rpcMethod}" does not support pagination`);
  }
  if (key === 'limit') {
    if (rawValue === undefined || rawValue === null) {
      return page.defaultLimit;
    }
    const value = validateInteger(rawValue as number | string);
    return Math.min(Math.max(value, 1), page.maxLimit);
  }
  // key === 'skip'
  if (rawValue === undefined || rawValue === null) {
    return 0;
  }
  const value = validateInteger(rawValue as number | string);
  return Math.min(Math.max(value, 0), page.maxSkip);
}

/** Validate and normalize a single param value by its declared type. */
function validateByType(camelKey: string, spec: ParamSpec, value: unknown): unknown {
  switch (spec.type) {
    case 'address':
      return validateAddressParam(camelKey, value);
    case 'scriptHash':
      return validateScriptHash(value as string);
    case 'hash':
      return validateHash(value as string);
    case 'blockHeight':
    case 'integer':
      return validateIntegerParam(camelKey, spec, value);
    case 'name':
      return validateNameParam(camelKey, value);
    case 'tokenId':
      return validateTokenIdParam(camelKey, value);
    case 'enum':
      return validateEnumParam(camelKey, spec, value);
    case 'boolean':
      return validateBoolean(value as boolean | string | number);
    default: {
      // Exhaustiveness guard: a new ParamType must be handled above.
      const unhandled: never = spec.type;
      throw new ValidationError(`Unsupported indexer parameter type: ${String(unhandled)}`);
    }
  }
}

/**
 * Validate an `address` param, accepting either a base58 Neo N3 address or a 0x script
 * hash reference (per the catalog `ParamType` contract). Both forms are validated shapes,
 * so no unvalidated string reaches upstream.
 */
function validateAddressParam(camelKey: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `Parameter "${camelKey}" must be a Neo N3 address or 0x script hash string`,
    );
  }
  try {
    return validateAddress(value);
  } catch {
    /* fall through to the script-hash form */
  }
  try {
    return validateScriptHash(value);
  } catch {
    throw new ValidationError(
      `Parameter "${camelKey}" is not a valid Neo N3 address or 0x script hash: ${value}`,
    );
  }
}

/** Validate a non-negative integer param, enforcing any declared min/max bounds. */
function validateIntegerParam(camelKey: string, spec: ParamSpec, value: unknown): number {
  const parsed = validateInteger(value as number | string);
  if (spec.min !== undefined && parsed < spec.min) {
    throw new ValidationError(`Parameter "${camelKey}" must be >= ${spec.min}`);
  }
  if (spec.max !== undefined && parsed > spec.max) {
    throw new ValidationError(`Parameter "${camelKey}" must be <= ${spec.max}`);
  }
  return parsed;
}

/** Validate a `name` param: sanitized, non-empty, at most {@link MAX_NAME_LENGTH} chars. */
function validateNameParam(camelKey: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Parameter "${camelKey}" must be a non-empty string`);
  }
  const sanitized = sanitizeString(value);
  if (sanitized.length < 1 || sanitized.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      `Parameter "${camelKey}" must be 1..${MAX_NAME_LENGTH} characters after sanitization`,
    );
  }
  return sanitized;
}

/** Validate a `tokenId` param: 1..{@link MAX_TOKEN_ID_LENGTH} chars of [A-Za-z0-9+/=]. */
function validateTokenIdParam(camelKey: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Parameter "${camelKey}" must be a token id string`);
  }
  if (
    value.length < 1 ||
    value.length > MAX_TOKEN_ID_LENGTH ||
    !TOKEN_ID_PATTERN.test(value)
  ) {
    throw new ValidationError(
      `Parameter "${camelKey}" must be 1..${MAX_TOKEN_ID_LENGTH} characters of [A-Za-z0-9+/=]`,
    );
  }
  return value;
}

/** Validate an `enum` param against the descriptor's permitted values. */
function validateEnumParam(camelKey: string, spec: ParamSpec, value: unknown): string {
  const values = spec.values ?? [];
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new ValidationError(
      `Parameter "${camelKey}" must be one of: ${values.join(', ') || '(none)'}`,
    );
  }
  return value;
}
