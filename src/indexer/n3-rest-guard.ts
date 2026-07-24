/**
 * n3-rest-guard — the pure, adversarial guard for the curated Neo N3 analytical tools.
 * It is a pure function of `N3_REST_CATALOG` (n3-rest-catalog.ts): no I/O, no network, no
 * imports from the tool handler. It is the n3index REST analogue of
 * `blockscout-query-guard.ts`.
 *
 * Two exported functions:
 *  - `assertAllowedN3Endpoint(endpoint)` — the endpoint allowlist gate. Rejects any endpoint
 *    key that is not a vetted, read-only catalog entry BEFORE any URL is built or network
 *    call made, with an error that enumerates the permitted endpoints so the LLM can
 *    self-correct.
 *  - `buildN3EndpointRequest(desc, input)` — assembles `{ path, params }` for
 *    `fetchN3Index` field-by-field from the descriptor. The concrete path is built by
 *    substituting ONLY a validated typed segment (n3Address / scriptHash / txid / blockRef)
 *    into the fixed template placeholder — a raw/model-authored string NEVER reaches the
 *    path. Query params are emitted ONLY from the per-endpoint allowlist, each re-validated;
 *    any unknown input key is rejected (caller keys are never spread through).
 *
 * SSRF / path traversal is defeated structurally: the template is a trusted constant, and
 * the single interpolated segment is a base58 N3 address, a 0x+hex reference, or a decimal
 * (slash-free, traversal-free). A belt-and-suspenders regex re-checks the segment shape
 * before substitution, and the assembled path is checked for any residual `{` placeholder.
 *
 * Every rejection throws `ValidationError` (src/utils/errors.ts). No input — however
 * malformed or adversarial — may escape as an uncaught crash.
 */

import { ValidationError } from '../utils/errors';
import {
  sanitizeString,
  validateAddress,
  validateHash,
  validateInteger,
  validateScriptHash,
} from '../utils/validation';
import {
  N3_REST_CATALOG,
  type EndpointDescriptor,
  type N3PathParamType,
  type QueryParamSpec,
} from './n3-rest-catalog';

/**
 * Input keys tolerated on the params object but NOT forwarded. `network` is resolved
 * independently by the handler (these tools are mainnet-only); `endpoint`/`params` may
 * appear if the whole tool input is passed through. None becomes a path or query value, so
 * they are silently ignored rather than rejected as unknown.
 */
const IGNORED_INPUT_KEYS: ReadonlySet<string> = new Set(['network', 'endpoint', 'params']);

/** Max length for a free-text query value after sanitization. Response is capped anyway. */
const MAX_QUERY_STRING_LENGTH = 256;

/** Pagination caps enforced on the numeric query params (matches the upstream REST caps). */
const LIMIT_CAP = 100;
const OFFSET_CAP = 10000;

/**
 * Shape a validated path segment MUST match after type validation: a 0x-hex reference
 * (script hash / tx hash / block hash), a decimal block index, or a 34-char base58 N3
 * address. This is redundant with the typed validators (defense in depth) — it guarantees
 * no `/`, `.`, `%`, or whitespace can ever enter a path.
 */
const SAFE_PATH_SEGMENT = /^(0x[0-9a-fA-F]+|[0-9]+|[A-Za-z0-9]{34})$/;

/** The request `fetchN3Index(network, path, params)` will be dispatched with. */
export interface EndpointRequest {
  /** Concrete path under the network segment (e.g. 'accounts/Nxyz...'), placeholder substituted. */
  path: string;
  /** Query params, keyed by the allowlisted query key; values validated. */
  params: Record<string, unknown>;
}

/**
 * Assert that a caller-supplied endpoint key is a vetted, read-only catalog entry.
 * The catalog key set IS the allowlist: write routes, made-up routes, and raw path strings
 * are all absent and therefore rejected here, before any URL is resolved.
 *
 * @param endpoint The LLM-facing endpoint key (e.g. `get_address_summary`).
 * @returns The frozen `EndpointDescriptor`.
 * @throws {ValidationError} for a missing, non-string, or non-allowlisted endpoint — with a
 *   message enumerating the permitted endpoints.
 */
export function assertAllowedN3Endpoint(endpoint: string): EndpointDescriptor {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new ValidationError(
      `Neo N3 query endpoint must be a non-empty string. Permitted endpoints: ${allowedEndpointList()}.`,
    );
  }
  const descriptor = N3_REST_CATALOG.get(endpoint);
  if (!descriptor) {
    throw new ValidationError(
      `Neo N3 query endpoint "${endpoint}" is not allowed. Permitted endpoints: ${allowedEndpointList()}.`,
    );
  }
  return descriptor;
}

/**
 * Build the `{ path, params }` request for a vetted endpoint from caller input.
 *
 * The concrete path comes from substituting the ONE validated typed segment into the
 * descriptor's fixed template; query params are emitted ONLY for the declared allowlist,
 * each re-validated (integer + clamp / sanitized string). Any input key that is neither the
 * declared path param, a declared query key, nor a tolerated key is rejected.
 *
 * @param desc  The descriptor returned by {@link assertAllowedN3Endpoint}.
 * @param input The caller-supplied params object (may be `undefined`/`null`).
 * @returns The path + validated query params for `fetchN3Index`.
 * @throws {ValidationError} for a non-object input, an unknown key, a missing required path
 *   or query param, or any value that fails its type validation.
 */
export function buildN3EndpointRequest(desc: EndpointDescriptor, input: unknown): EndpointRequest {
  const source = asPlainObject(input);

  const allowedKeys = new Set<string>();
  if (desc.pathParam) {
    allowedKeys.add(desc.pathParam.key);
  }
  if (desc.queryParams) {
    for (const key of Object.keys(desc.queryParams)) {
      allowedKeys.add(key);
    }
  }

  // Strict per-endpoint whitelist: reject any key not declared (or explicitly tolerated).
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key) && !IGNORED_INPUT_KEYS.has(key)) {
      const allowed = [...allowedKeys].join(', ') || '(none)';
      throw new ValidationError(
        `Unknown parameter "${key}" for Neo N3 endpoint "${desc.pathTemplate}". Allowed parameters: ${allowed}.`,
      );
    }
  }

  return {
    path: buildPath(desc, source),
    params: buildQueryParams(desc, source),
  };
}

/** Enumerate the permitted endpoint keys for error messages. */
function allowedEndpointList(): string {
  return [...N3_REST_CATALOG.keys()].join(', ');
}

/** Narrow arbitrary input to a plain params object; treat null/undefined as empty. */
function asPlainObject(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Neo N3 query params must be an object');
  }
  return input as Record<string, unknown>;
}

/**
 * Build the concrete path by substituting the validated typed segment into the template.
 * For an endpoint with no path param the template is returned verbatim. The model's value
 * is NEVER placed into the path unvalidated: it passes the type validator AND the
 * {@link SAFE_PATH_SEGMENT} shape check first.
 */
function buildPath(desc: EndpointDescriptor, source: Record<string, unknown>): string {
  if (!desc.pathParam) {
    assertFullySubstituted(desc.pathTemplate);
    return desc.pathTemplate;
  }

  const { key, type } = desc.pathParam;
  const raw = source[key];
  if (raw === undefined || raw === null) {
    throw new ValidationError(
      `Missing required path parameter "${key}" for Neo N3 endpoint "${desc.pathTemplate}".`,
    );
  }

  const segment = validatePathSegment(key, type, raw);
  if (!SAFE_PATH_SEGMENT.test(segment)) {
    // Unreachable given the typed validators normalize to base58 / 0x-hex / decimal, but this
    // is the last line of SSRF defense: a segment carrying '/', '.', '%', etc. can never pass.
    throw new ValidationError(`Path parameter "${key}" produced an unsafe path segment`);
  }

  const placeholder = `{${key}}`;
  if (!desc.pathTemplate.includes(placeholder)) {
    throw new ValidationError(
      `Endpoint template "${desc.pathTemplate}" has no placeholder for path parameter "${key}"`,
    );
  }

  const path = desc.pathTemplate.split(placeholder).join(segment);
  assertFullySubstituted(path);
  return path;
}

/** Guard against any unsubstituted `{...}` placeholder ever reaching the network. */
function assertFullySubstituted(path: string): void {
  if (path.includes('{') || path.includes('}')) {
    throw new ValidationError(`Neo N3 endpoint path is not fully resolved: ${path}`);
  }
}

/** Validate and normalize a single path segment by its declared type. */
function validatePathSegment(key: string, type: N3PathParamType, value: unknown): string {
  switch (type) {
    case 'n3Address':
      return validateAddress(value as string);
    case 'scriptHash':
      return validateScriptHash(value as string);
    case 'txid':
      return validateHash(value as string);
    case 'blockRef':
      return validateN3BlockRef(value);
    default: {
      // Exhaustiveness guard: a new N3PathParamType must be handled above.
      const unhandled: never = type;
      throw new ValidationError(
        `Unsupported Neo N3 path parameter type "${String(unhandled)}" for "${key}"`,
      );
    }
  }
}

/**
 * Validate a Neo N3 block reference: either a non-negative integer block index or a
 * 0x + 64 hex block hash. Returns the canonical decimal string (indexes) or normalized
 * 0x hash — both slash-free and traversal-free.
 */
function validateN3BlockRef(value: unknown): string {
  if (typeof value === 'number') {
    return String(validateInteger(value));
  }
  if (!value || typeof value !== 'string') {
    throw new ValidationError('Block reference must be a non-empty string or number');
  }
  const trimmed = value.trim();
  if (/^[0-9]+$/.test(trimmed)) {
    return String(validateInteger(trimmed));
  }
  return validateHash(trimmed);
}

/** Build the query-params object from the endpoint's allowlist, validating each value. */
function buildQueryParams(
  desc: EndpointDescriptor,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (!desc.queryParams) {
    return params;
  }
  for (const [key, spec] of Object.entries(desc.queryParams)) {
    const raw = source[key];
    if (raw === undefined || raw === null) {
      if (spec.required) {
        throw new ValidationError(
          `Missing required query parameter "${key}" for Neo N3 endpoint "${desc.pathTemplate}".`,
        );
      }
      continue;
    }
    params[key] = validateQueryValue(key, spec, raw);
  }
  return params;
}

/** Validate one query value against its declared type (clamped integer / sanitized string). */
function validateQueryValue(key: string, spec: QueryParamSpec, value: unknown): number | string {
  if (spec.type === 'int') {
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw new ValidationError(`Query parameter "${key}" must be a non-negative integer`);
    }
    const parsed = validateInteger(value);
    return clampInteger(key, parsed);
  }
  // spec.type === 'string'
  if (typeof value !== 'string') {
    throw new ValidationError(`Query parameter "${key}" must be a string`);
  }
  const sanitized = sanitizeString(value);
  if (sanitized.length < 1 || sanitized.length > MAX_QUERY_STRING_LENGTH) {
    throw new ValidationError(
      `Query parameter "${key}" must be 1..${MAX_QUERY_STRING_LENGTH} characters after sanitization`,
    );
  }
  return sanitized;
}

/** Clamp a validated non-negative integer to the per-key pagination cap. */
function clampInteger(key: string, value: number): number {
  if (key === 'limit') {
    return Math.min(value, LIMIT_CAP);
  }
  if (key === 'offset') {
    return Math.min(value, OFFSET_CAP);
  }
  return value;
}
