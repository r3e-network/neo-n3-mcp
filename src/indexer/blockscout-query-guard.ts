/**
 * blockscout-query-guard — the pure, adversarial guard for the generic Neo X `x_query`
 * tool. It is a pure function of `X_ENDPOINT_CATALOG` (blockscout-catalog.ts): no I/O, no
 * network, no imports from the tool handler. It is the Blockscout analogue of
 * `indexer-query-guard.ts`.
 *
 * Two exported functions:
 *  - `assertAllowedEndpoint(endpoint)` — the endpoint allowlist gate. Rejects any endpoint
 *    key that is not a vetted, read-only catalog entry BEFORE any URL is built or network
 *    call made, with an error that enumerates the permitted endpoints so the LLM can
 *    self-correct.
 *  - `buildEndpointRequest(desc, input)` — assembles `{ path, params }` for
 *    `fetchBlockscout` field-by-field from the descriptor. The concrete path is built by
 *    substituting ONLY a validated typed segment (evmAddress / evmHash / blockRef) into the
 *    fixed template placeholder — a raw/model-authored string NEVER reaches the path.
 *    Query params are emitted ONLY from the per-endpoint allowlist, each re-validated; any
 *    unknown input key is rejected (caller keys are never spread through).
 *
 * SSRF / path traversal is defeated structurally: the template is a trusted constant, and
 * the single interpolated segment is `0x`+hex or a decimal string (slash-free,
 * traversal-free). A belt-and-suspenders regex re-checks the segment shape before
 * substitution, and the assembled path is checked for any residual `{` placeholder.
 *
 * Every rejection throws `ValidationError` (src/utils/errors.ts). No input — however
 * malformed or adversarial — may escape as an uncaught crash.
 */

import { ValidationError } from '../utils/errors';
import {
  sanitizeString,
  validateEvmAddress,
  validateEvmBlockRef,
  validateEvmHash,
} from '../utils/validation';
import {
  X_ENDPOINT_CATALOG,
  type EndpointDescriptor,
  type EvmPathParamType,
  type QueryParamSpec,
} from './blockscout-catalog';

/**
 * Input keys tolerated on the params object but NOT forwarded. `network` is resolved
 * independently by the handler (`x_query` is mainnet-only); `endpoint`/`params` may appear
 * if the whole tool input is passed through. None becomes a path or query value, so they
 * are silently ignored rather than rejected as unknown.
 */
const IGNORED_INPUT_KEYS: ReadonlySet<string> = new Set(['network', 'endpoint', 'params']);

/** Max length for a free-text query value (`q`) after sanitization. Response is capped anyway. */
const MAX_QUERY_STRING_LENGTH = 256;

/**
 * Shape a validated path segment MUST match after type validation: a 0x-hex reference
 * (address/hash) or a decimal block number. This is redundant with the typed validators
 * (defense in depth) — it guarantees no `/`, `.`, `%`, or whitespace can ever enter a path.
 */
const SAFE_PATH_SEGMENT = /^(0x[0-9a-f]+|[0-9]+)$/;

/** The request `fetchBlockscout(network, path, params)` will be dispatched with. */
export interface EndpointRequest {
  /** Concrete path under /api/v2 (e.g. 'addresses/0xabc...'), placeholder substituted. */
  path: string;
  /** Query params, keyed by the allowlisted query key; values validated. */
  params: Record<string, unknown>;
}

/**
 * Assert that a caller-supplied endpoint key is a vetted, read-only catalog entry.
 * The catalog key set IS the allowlist: write routes, made-up routes, and raw path strings
 * are all absent and therefore rejected here, before any URL is resolved.
 *
 * @param endpoint The LLM-facing endpoint key (e.g. `get_address`).
 * @returns The frozen `EndpointDescriptor`.
 * @throws {ValidationError} for a missing, non-string, or non-allowlisted endpoint — with a
 *   message enumerating the permitted endpoints.
 */
export function assertAllowedEndpoint(endpoint: string): EndpointDescriptor {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new ValidationError(
      `Neo X query endpoint must be a non-empty string. Permitted endpoints: ${allowedEndpointList()}.`,
    );
  }
  const descriptor = X_ENDPOINT_CATALOG.get(endpoint);
  if (!descriptor) {
    throw new ValidationError(
      `Neo X query endpoint "${endpoint}" is not allowed. Permitted endpoints: ${allowedEndpointList()}.`,
    );
  }
  return descriptor;
}

/**
 * Build the `{ path, params }` request for a vetted endpoint from caller input.
 *
 * The concrete path comes from substituting the ONE validated typed segment into the
 * descriptor's fixed template; query params are emitted ONLY for the declared allowlist,
 * each re-validated (enum membership / sanitized string). Any input key that is neither the
 * declared path param, a declared query key, nor a tolerated key is rejected.
 *
 * @param desc  The descriptor returned by {@link assertAllowedEndpoint}.
 * @param input The caller-supplied params object (may be `undefined`/`null`).
 * @returns The path + validated query params for `fetchBlockscout`.
 * @throws {ValidationError} for a non-object input, an unknown key, a missing required path
 *   or query param, or any value that fails its type validation.
 */
export function buildEndpointRequest(desc: EndpointDescriptor, input: unknown): EndpointRequest {
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
        `Unknown parameter "${key}" for Neo X endpoint "${desc.pathTemplate}". Allowed parameters: ${allowed}.`,
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
  return [...X_ENDPOINT_CATALOG.keys()].join(', ');
}

/** Narrow arbitrary input to a plain params object; treat null/undefined as empty. */
function asPlainObject(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Neo X query params must be an object');
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
      `Missing required path parameter "${key}" for Neo X endpoint "${desc.pathTemplate}".`,
    );
  }

  const segment = validatePathSegment(key, type, raw);
  if (!SAFE_PATH_SEGMENT.test(segment)) {
    // Unreachable given the typed validators normalize to 0x-hex / decimal, but this is the
    // last line of SSRF defense: a segment carrying '/', '.', '%', etc. can never pass.
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
    throw new ValidationError(`Neo X endpoint path is not fully resolved: ${path}`);
  }
}

/** Validate and normalize a single path segment by its declared type. */
function validatePathSegment(key: string, type: EvmPathParamType, value: unknown): string {
  switch (type) {
    case 'evmAddress':
      return validateEvmAddress(value as string);
    case 'evmHash':
      return validateEvmHash(value as string);
    case 'blockRef':
      return validateEvmBlockRef(value as string | number);
    default: {
      // Exhaustiveness guard: a new EvmPathParamType must be handled above.
      const unhandled: never = type;
      throw new ValidationError(
        `Unsupported Neo X path parameter type "${String(unhandled)}" for "${key}"`,
      );
    }
  }
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
          `Missing required query parameter "${key}" for Neo X endpoint "${desc.pathTemplate}".`,
        );
      }
      continue;
    }
    params[key] = validateQueryValue(key, spec, raw);
  }
  return params;
}

/** Validate one query value against its declared type (enum membership / sanitized string). */
function validateQueryValue(key: string, spec: QueryParamSpec, value: unknown): string {
  if (spec.type === 'enum') {
    const values = spec.values ?? [];
    if (typeof value !== 'string' || !values.includes(value)) {
      throw new ValidationError(
        `Query parameter "${key}" must be one of: ${values.join(', ') || '(none)'}`,
      );
    }
    return value;
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
