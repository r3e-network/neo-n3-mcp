/**
 * indexer-find-guard — the pure, adversarial guard for the Phase 2, gated `find_indexer`
 * tool. It is a pure function of `COLLECTION_CATALOG` (indexer-collections.ts): no I/O, no
 * network, no imports from the tool handler. It is the constrained-`find` sibling of the
 * fixed-method guard `indexer-query-guard.ts`.
 *
 * Where Phase 1 lets a caller pick a vetted method + typed scalar params, Phase 2 lets a
 * caller author a SMALL Mongo-shaped filter. That is a materially larger attack surface, so
 * `validateFind` re-builds the entire `{ Filter, Sort, Limit, Skip }` request field-by-field
 * from scratch — the caller's objects are NEVER spread or reused — enforcing:
 *
 *  - Collection allowlist: the collection key must be in the catalog (else reject).
 *  - Field allowlist (T18): every filter key and every sort key must be a
 *    conservatively-indexed field listed for that collection. Any other key — including a
 *    top-level `$or`/`$and`, a nested field path, or a dotted key — is rejected. Because the
 *    allowlist is indexed fields only, no predicate can degrade into an unindexed scan DoS.
 *  - Operator allowlist: a filter value may ONLY be a bare scalar (equality),
 *    `{ $in: [<=20 scalars] }`, one or more of `{ $gt|$gte|$lt|$lte: scalar }`, or
 *    `{ $exists: bool }`. Every other `$`-operator — `$where`, `$function`, `$expr`,
 *    `$regex`, `$text`, `$or`, `$and`, `$nor`, `$not`, `$elemMatch`, `$jsonSchema`, … — is
 *    rejected, as is any nested object beyond one operator level, any function/RegExp value,
 *    and any `__proto__`/`constructor`/`prototype` key (prototype-pollution defense).
 *  - Resource bounds: `limit` is clamped to `[1, maxLimit]` (defaulted when absent) and
 *    `skip` to `[0, MAX_SKIP]`, so a caller can neither request an unbounded page nor a deep
 *    offset scan.
 *
 * The result keys are PascalCase (`Filter`/`Sort`/`Limit`/`Skip`) to match the neo3fura
 * handler arg structs. Every rejection throws `ValidationError` (src/utils/errors.ts); no
 * input — however malformed or adversarial — may escape as an uncaught crash.
 */

import { ValidationError } from '../utils/errors';
import { validateInteger } from '../utils/validation';
import { COLLECTION_CATALOG, type CollectionDescriptor } from './indexer-collections';

/** Comparison operators permitted as filter-value keys (scalar operand each). */
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set(['$gt', '$gte', '$lt', '$lte']);

/** The complete set of `$`-operators a filter value may use. Everything else is denied. */
const ALLOWED_OPERATORS: ReadonlySet<string> = new Set([...COMPARISON_OPERATORS, '$in', '$exists']);

/** Keys that are never allowed anywhere in a filter/sort (prototype-pollution vectors). */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Max elements permitted in a `$in` list (bounds fan-out / payload size). */
const MAX_IN_ITEMS = 20;

/** Max distinct sort keys (a sort over many fields is neither useful nor cheap). */
const MAX_SORT_KEYS = 5;

/** Max length of any scalar string operand (bounds request payload size). */
const MAX_SCALAR_STRING_LENGTH = 256;

/** Deepest offset the guard will pass upstream; a deeper skip is clamped down (DoS bound). */
const MAX_SKIP = 10_000;

/** Directions accepted for a sort value, normalized to Mongo's 1 / -1. */
const SORT_DIRECTIONS: ReadonlyMap<string | number, 1 | -1> = new Map<string | number, 1 | -1>([
  [1, 1],
  [-1, -1],
  ['1', 1],
  ['-1', -1],
  ['asc', 1],
  ['ascending', 1],
  ['desc', -1],
  ['descending', -1],
]);

/** The sanitized request `find_indexer` will dispatch to a neo3fura `Get*` handler. */
export interface FindRequest {
  /** Mongo-shaped filter, rebuilt from vetted fields + allowlisted operators only. */
  Filter: Record<string, unknown>;
  /** Sort spec keyed by vetted field → 1 | -1. Empty when no sort was requested. */
  Sort: Record<string, 1 | -1>;
  /** Result window size, clamped to [1, collection.maxLimit]. */
  Limit: number;
  /** Result offset, clamped to [0, MAX_SKIP]. */
  Skip: number;
}

/**
 * Assert that a caller-supplied collection key is a vetted catalog entry. The catalog key
 * set IS the allowlist: internal Mongo collection names, made-up names, and non-strings are
 * all absent and therefore rejected here, before any request is built.
 *
 * @param collection The LLM-facing collection key (e.g. `transactions`).
 * @returns The frozen `CollectionDescriptor`.
 * @throws {ValidationError} for a missing, non-string, or non-allowlisted collection — with a
 *   message that enumerates the permitted collections.
 */
export function assertAllowedCollection(collection: string): CollectionDescriptor {
  if (!collection || typeof collection !== 'string') {
    throw new ValidationError(
      `Indexer find collection must be a non-empty string. Permitted collections: ${allowedCollectionList()}.`,
    );
  }
  const descriptor = COLLECTION_CATALOG.get(collection);
  if (!descriptor) {
    throw new ValidationError(
      `Indexer find collection "${collection}" is not allowed. Permitted collections: ${allowedCollectionList()}.`,
    );
  }
  return descriptor;
}

/**
 * Validate and sanitize a constrained `find` request into the exact `{ Filter, Sort, Limit,
 * Skip }` object neo3fura expects. The returned object is freshly built — none of the
 * caller's objects/arrays are reused — so nothing unvetted (extra keys, hidden operators,
 * polluted prototypes) can ride through.
 *
 * @param collection LLM-facing collection key; must be a catalog entry.
 * @param filter     Optional Mongo-shaped filter (plain object). `undefined`/`null` → `{}`.
 * @param sort       Optional sort spec (field → direction). `undefined`/`null` → `{}`.
 * @param limit      Optional page size; clamped to `[1, maxLimit]`, defaulted when absent.
 * @param skip       Optional offset; clamped to `[0, MAX_SKIP]`, defaulted to 0 when absent.
 * @throws {ValidationError} for an unknown collection, a disallowed field/operator, a
 *   malformed value, or a non-object filter/sort.
 */
export function validateFind(
  collection: string,
  filter?: unknown,
  sort?: unknown,
  limit?: unknown,
  skip?: unknown,
): FindRequest {
  const desc = assertAllowedCollection(collection);
  return {
    Filter: buildFilter(desc, filter),
    Sort: buildSort(desc, sort),
    Limit: clampLimit(desc, limit),
    Skip: clampSkip(skip),
  };
}

/** Enumerate the permitted collection keys for error messages. */
function allowedCollectionList(): string {
  return [...COLLECTION_CATALOG.keys()].join(', ');
}

/**
 * Rebuild the filter object from the caller's input: only allowlisted fields, each mapped to
 * a re-validated scalar/operator value. Reject a non-object filter, any unlisted or dangerous
 * key, and any top-level `$`-operator (logical operators like `$or` are not supported).
 */
function buildFilter(desc: CollectionDescriptor, filter: unknown): Record<string, unknown> {
  if (filter === undefined || filter === null) {
    return {};
  }
  if (!isPlainObject(filter)) {
    throw new ValidationError('Indexer find filter must be an object');
  }

  const allowed = new Set(desc.filterFields);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(filter)) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new ValidationError(`Filter key "${key}" is not allowed`);
    }
    if (key.startsWith('$')) {
      throw new ValidationError(
        `Filter operator "${key}" is not allowed at the field level. Filter by one of: ${fieldList(desc.filterFields)}.`,
      );
    }
    if (!allowed.has(key)) {
      throw new ValidationError(
        `Field "${key}" is not filterable on collection "${collectionKeyOf(desc)}". Allowed fields: ${fieldList(desc.filterFields)}.`,
      );
    }
    out[key] = validateFilterValue(key, (filter as Record<string, unknown>)[key]);
  }
  return out;
}

/**
 * Validate a single filter value. A bare scalar means equality; a plain object is treated as
 * an operator expression and must contain ONLY allowlisted operators. Arrays (outside `$in`),
 * functions, RegExps, and `null` are rejected.
 */
function validateFilterValue(field: string, value: unknown): unknown {
  if (isScalar(value)) {
    return checkScalar(field, value);
  }
  if (value === null || value === undefined) {
    throw new ValidationError(`Filter value for "${field}" must not be null`);
  }
  if (Array.isArray(value)) {
    throw new ValidationError(
      `Filter value for "${field}" must not be a bare array; use { "$in": [...] } for a set`,
    );
  }
  if (typeof value === 'function' || value instanceof RegExp) {
    throw new ValidationError(`Filter value for "${field}" must not be a function or regular expression`);
  }
  if (isPlainObject(value)) {
    return validateOperatorObject(field, value);
  }
  throw new ValidationError(`Filter value for "${field}" has an unsupported type`);
}

/**
 * Validate an operator expression `{ $op: operand, ... }`. Every key must be an allowlisted
 * `$`-operator; a non-operator key (e.g. a nested field path) or a disallowed operator
 * ($where/$regex/$expr/$or/…) is rejected. Each operand is re-validated per operator, which
 * rejects any second level of nesting (an operand that is itself an object).
 */
function validateOperatorObject(field: string, obj: object): Record<string, unknown> {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    throw new ValidationError(`Filter value for "${field}" must not be an empty object`);
  }
  const source = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const op of keys) {
    if (DANGEROUS_KEYS.has(op)) {
      throw new ValidationError(`Operator "${op}" is not allowed on field "${field}"`);
    }
    if (!op.startsWith('$') || !ALLOWED_OPERATORS.has(op)) {
      throw new ValidationError(
        `Operator "${op}" is not allowed on field "${field}". Allowed operators: ${[...ALLOWED_OPERATORS].join(', ')}.`,
      );
    }
    out[op] = validateOperatorOperand(field, op, source[op]);
  }
  return out;
}

/** Validate the operand of a single allowlisted operator (rejects a second nesting level). */
function validateOperatorOperand(field: string, op: string, operand: unknown): unknown {
  if (op === '$exists') {
    if (typeof operand !== 'boolean') {
      throw new ValidationError(`Operator "$exists" on field "${field}" requires a boolean`);
    }
    return operand;
  }
  if (op === '$in') {
    if (!Array.isArray(operand)) {
      throw new ValidationError(`Operator "$in" on field "${field}" requires an array`);
    }
    if (operand.length < 1 || operand.length > MAX_IN_ITEMS) {
      throw new ValidationError(
        `Operator "$in" on field "${field}" must list 1..${MAX_IN_ITEMS} values`,
      );
    }
    return operand.map((element) => {
      if (!isScalar(element)) {
        throw new ValidationError(
          `Operator "$in" on field "${field}" accepts scalars only (no nested objects/arrays)`,
        );
      }
      return checkScalar(field, element);
    });
  }
  // Comparison operator: operand must be a comparison scalar (string or finite number).
  if (COMPARISON_OPERATORS.has(op)) {
    if (typeof operand === 'number') {
      if (!Number.isFinite(operand)) {
        throw new ValidationError(`Operator "${op}" on field "${field}" requires a finite number`);
      }
      return operand;
    }
    if (typeof operand === 'string') {
      return checkScalar(field, operand);
    }
    throw new ValidationError(
      `Operator "${op}" on field "${field}" requires a string or number operand`,
    );
  }
  // Unreachable: ALLOWED_OPERATORS gates the caller before we get here.
  throw new ValidationError(`Operator "${op}" on field "${field}" is not supported`);
}

/**
 * Rebuild the sort object: only allowlisted sort fields, each mapped to a normalized 1 / -1.
 * Reject a non-object sort, too many keys, dangerous/`$`-prefixed keys, unlisted fields, and
 * any direction that is not a recognized asc/desc token.
 */
function buildSort(desc: CollectionDescriptor, sort: unknown): Record<string, 1 | -1> {
  if (sort === undefined || sort === null) {
    return {};
  }
  if (!isPlainObject(sort)) {
    throw new ValidationError('Indexer find sort must be an object');
  }

  const keys = Object.keys(sort);
  if (keys.length > MAX_SORT_KEYS) {
    throw new ValidationError(`Indexer find sort may reference at most ${MAX_SORT_KEYS} fields`);
  }

  const allowed = new Set(desc.sortFields);
  const source = sort as Record<string, unknown>;
  const out: Record<string, 1 | -1> = {};
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key) || key.startsWith('$')) {
      throw new ValidationError(`Sort key "${key}" is not allowed`);
    }
    if (!allowed.has(key)) {
      throw new ValidationError(
        `Field "${key}" is not sortable on collection "${collectionKeyOf(desc)}". Allowed sort fields: ${fieldList(desc.sortFields)}.`,
      );
    }
    out[key] = normalizeDirection(key, source[key]);
  }
  return out;
}

/** Map a caller sort direction to Mongo's 1 / -1, rejecting anything unrecognized. */
function normalizeDirection(field: string, value: unknown): 1 | -1 {
  if (typeof value === 'number' || typeof value === 'string') {
    const dir = SORT_DIRECTIONS.get(value);
    if (dir !== undefined) {
      return dir;
    }
  }
  throw new ValidationError(
    `Sort direction for "${field}" must be one of 1, -1, "asc", or "desc"`,
  );
}

/** Clamp `limit` into `[1, maxLimit]`, defaulting to the collection default when absent. */
function clampLimit(desc: CollectionDescriptor, limit: unknown): number {
  if (limit === undefined || limit === null) {
    return desc.defaultLimit;
  }
  const value = validateInteger(limit as number | string);
  return Math.min(Math.max(value, 1), desc.maxLimit);
}

/** Clamp `skip` into `[0, MAX_SKIP]`, defaulting to 0 when absent. */
function clampSkip(skip: unknown): number {
  if (skip === undefined || skip === null) {
    return 0;
  }
  const value = validateInteger(skip as number | string);
  return Math.min(Math.max(value, 0), MAX_SKIP);
}

/** A scalar is a string, a finite number, or a boolean (never null/undefined/object). */
function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
  );
}

/** Bound a string scalar's length; pass numbers/booleans through unchanged. */
function checkScalar(field: string, value: string | number | boolean): string | number | boolean {
  if (typeof value === 'string' && value.length > MAX_SCALAR_STRING_LENGTH) {
    throw new ValidationError(
      `Filter value for "${field}" exceeds ${MAX_SCALAR_STRING_LENGTH} characters`,
    );
  }
  return value;
}

/**
 * A plain (data) object: `typeof === 'object'`, non-null, not an array. Callers guard
 * functions/RegExps separately; a class instance would fail operator-key validation anyway.
 */
function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render a field allowlist for an error message. */
function fieldList(fields: readonly string[]): string {
  return fields.length > 0 ? fields.join(', ') : '(none)';
}

/** Resolve the LLM-facing key for a descriptor (for error text); falls back to the method. */
function collectionKeyOf(desc: CollectionDescriptor): string {
  for (const [key, value] of COLLECTION_CATALOG) {
    if (value === desc) {
      return key;
    }
  }
  return desc.rpcMethod;
}
