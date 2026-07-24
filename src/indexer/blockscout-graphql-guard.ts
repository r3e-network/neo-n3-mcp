/**
 * blockscout-graphql-guard — the pure, adversarial guard for the Phase 2 (gated-off)
 * `x_graphql` tool, which posts an arbitrary GraphQL document to the Neo X Blockscout
 * GraphQL endpoint (`${base}/api/v1/graphql`).
 *
 * This is the TRULY-arbitrary Neo X layer: unlike `x_query` (whose every request is
 * assembled field-by-field from the vetted `X_ENDPOINT_CATALOG`), here the model authors
 * the whole query string. That is powerful and RISKY, so — like `indexer-query-guard.ts`
 * and `blockscout-query-guard.ts` — this file is a pure function of its input: no I/O, no
 * network, no imports from the tool handler. It enforces a conservative *envelope* that a
 * safe read query must fit inside, and rejects everything else with a typed
 * `ValidationError` so no input, however adversarial, escapes as an uncaught crash.
 *
 * IMPORTANT — this is a HEURISTIC bound, NOT a GraphQL parser. We deliberately add no new
 * dependency (no `graphql` package): instead we strip string literals + comments and then
 * apply lexical bounds (operation kind, introspection, directives, brace-nesting depth,
 * field/complexity count, length). Because a hand-rolled heuristic can never be as precise
 * as a real parser, the `x_graphql` tool it backs stays GATED OFF by default; the guard is
 * the second line of defense behind that flag, and it is intentionally biased toward
 * over-rejection (a false reject is a self-correcting error message to the LLM; a false
 * accept could be an unbounded upstream query).
 *
 * Threat model:
 *  - Writes (mutation) and long-lived streams (subscription): rejected — only anonymous or
 *    `query` operations are allowed (read-only invariant).
 *  - Schema mining via introspection (`__schema`, `__type`, any reserved `__`-prefixed
 *    field except the harmless `__typename`): rejected.
 *  - Server-side directives (`@skip`, `@include`, `@defer`, custom `@…`): rejected.
 *  - DoS via deep nesting or huge selection sets: brace-depth and field-count caps.
 *  - DoS via a giant document: hard length cap (applied first, so every subsequent scan
 *    runs on bounded input).
 *  - Injection / prototype pollution / non-JSON values in `variables`: the variables map
 *    must be a plain, bounded, function-free JSON object.
 *
 * The fixed GraphQL URL is a constant in `blockscout-graphql-client.ts`; the model never
 * supplies a path, so there is no SSRF/path-traversal surface here (that is `x_query`'s
 * concern). This guard bounds only the *document* and its *variables*.
 */

import { ValidationError } from '../utils/errors';

/** Hard cap on the raw query length. Applied first so every later scan is bounded. */
export const MAX_GRAPHQL_QUERY_LENGTH = 4000;

/** Max brace-nesting depth of the (string/comment-stripped) document. */
export const MAX_GRAPHQL_DEPTH = 8;

/** Max number of name tokens (a conservative selection-complexity proxy). */
export const MAX_GRAPHQL_FIELDS = 120;

/** Max serialized size of the `variables` map. */
export const MAX_GRAPHQL_VARIABLES_BYTES = 8 * 1024;

/** Max nesting depth allowed inside the `variables` map (also caps cyclic input). */
export const MAX_GRAPHQL_VARIABLES_DEPTH = 8;

/** A GraphQL Name token: a leading [_A-Za-z] followed by any [_0-9A-Za-z]. */
const NAME_TOKEN = /[_A-Za-z][_0-9A-Za-z]*/g;

/** The one reserved (`__`-prefixed) field that is queryable and harmless. */
const ALLOWED_META_FIELD = '__typename';

/** Operation keywords that are NOT allowed (writes / long-lived streams). */
const FORBIDDEN_OPERATIONS: ReadonlySet<string> = new Set(['mutation', 'subscription']);

/** The validated document + variables returned to the caller when the envelope passes. */
export interface ValidatedGraphqlQuery {
  query: string;
  variables?: Record<string, unknown>;
}

/**
 * Validate an arbitrary GraphQL document against the safe read-only envelope.
 *
 * On success the ORIGINAL `query` and `variables` are returned unchanged (the guard never
 * rewrites the document — it only accepts or rejects). On any violation a `ValidationError`
 * is thrown whose message names the reason so the LLM can self-correct.
 *
 * @param query     The GraphQL document text (must be a non-empty string).
 * @param variables Optional GraphQL variables — must be a plain, bounded JSON object.
 * @returns `{ query, variables }` unchanged when every bound passes.
 * @throws {ValidationError} for a non-string/empty/oversize document, a forbidden operation
 *   kind, introspection, a directive, excessive nesting/complexity, or invalid variables.
 */
export function validateGraphqlQuery(
  query: string,
  variables?: object,
): ValidatedGraphqlQuery {
  // 1. Shape: a non-empty string. (Typed `string`, but callers may pass untyped input.)
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new ValidationError('GraphQL query must be a non-empty string.');
  }

  // 2. Length — checked BEFORE any scan so all later work runs on bounded input.
  if (query.length > MAX_GRAPHQL_QUERY_LENGTH) {
    throw new ValidationError(
      `GraphQL query is too large (${query.length} chars, limit ${MAX_GRAPHQL_QUERY_LENGTH}).`,
    );
  }

  // Strip string literals + comments so structural scans ignore braces/keywords/`@` that
  // live inside inert text (a `{` in a string value must not inflate nesting depth, and a
  // `mutation` in a comment is not an operation).
  const structural = stripStringsAndComments(query);

  // 3. Operation kind: reject mutation / subscription; allow anonymous or `query`.
  assertNoForbiddenOperation(structural);

  // 4. Directives: reject any `@…` directive (and the `directive` schema keyword).
  assertNoDirectives(structural);

  // 5. Introspection + complexity: single pass over the name tokens.
  assertNoIntrospectionAndBoundFields(structural);

  // 6. Nesting depth: bound the brace nesting of the structural document.
  assertBoundedDepth(structural);

  // 7. Variables: a plain, bounded, function-free JSON object (or absent).
  const validatedVariables = validateVariables(variables);

  // Return the ORIGINAL document unchanged; only attach variables when they were provided.
  return validatedVariables === undefined
    ? { query }
    : { query, variables: validatedVariables };
}

/**
 * Remove GraphQL string literals (`"…"`, block strings `"""…"""`) and line comments
 * (`#…`) from `src`, replacing each with a single space. Total and defensive: an
 * unterminated literal/comment simply consumes to end-of-input. The result preserves every
 * structural `{`, `}`, `@`, and name token while dropping anything that lived inside inert
 * text, so the downstream lexical scans cannot be fooled by payloads hidden in strings or
 * comments.
 */
function stripStringsAndComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // Block string: """ … """
    if (ch === '"' && src[i + 1] === '"' && src[i + 2] === '"') {
      i += 3;
      while (i < n && !(src[i] === '"' && src[i + 1] === '"' && src[i + 2] === '"')) {
        i += 1;
      }
      i += 3;
      out += ' ';
      continue;
    }

    // Regular string: " … " with backslash escapes.
    if (ch === '"') {
      i += 1;
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') {
          i += 1; // skip the escaped character
        }
        i += 1;
      }
      i += 1;
      out += ' ';
      continue;
    }

    // Line comment: # … end-of-line
    if (ch === '#') {
      while (i < n && src[i] !== '\n') {
        i += 1;
      }
      out += ' ';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Reject a `mutation` / `subscription` operation. Uses exact-token matching (not substring)
 * so a field whose name merely *contains* the keyword — e.g. `subscriptionPlans` — is not
 * over-rejected, while an actual `mutation { … }` / `subscription { … }` operation is.
 */
function assertNoForbiddenOperation(structural: string): void {
  for (const match of structural.matchAll(NAME_TOKEN)) {
    if (FORBIDDEN_OPERATIONS.has(match[0])) {
      throw new ValidationError(
        `GraphQL "${match[0]}" operations are not allowed; only read-only "query" (or anonymous) operations may run.`,
      );
    }
  }
}

/**
 * Reject any directive usage. A `@` can only be a directive marker in the structural
 * (string/comment-stripped) document, so its mere presence is disallowed; the `directive`
 * schema keyword is likewise rejected as an exact token.
 */
function assertNoDirectives(structural: string): void {
  if (structural.includes('@')) {
    throw new ValidationError('GraphQL directives (@…) are not allowed.');
  }
  for (const match of structural.matchAll(NAME_TOKEN)) {
    if (match[0] === 'directive') {
      throw new ValidationError('GraphQL directive definitions are not allowed.');
    }
  }
}

/**
 * In a single pass over the name tokens: reject introspection/reserved fields (any
 * `__`-prefixed field except `__typename`, which covers `__schema` and `__type`), and
 * enforce the field-count complexity cap. Counting every name token is a conservative
 * superset of "selection fields" — it can only *over*-count, biasing toward rejection.
 */
function assertNoIntrospectionAndBoundFields(structural: string): void {
  let fieldCount = 0;
  for (const match of structural.matchAll(NAME_TOKEN)) {
    const token = match[0];
    if (token.startsWith('__') && token !== ALLOWED_META_FIELD) {
      throw new ValidationError(
        `GraphQL introspection is not allowed (reserved field "${token}").`,
      );
    }
    fieldCount += 1;
    if (fieldCount > MAX_GRAPHQL_FIELDS) {
      throw new ValidationError(
        `GraphQL query is too complex (> ${MAX_GRAPHQL_FIELDS} selection tokens).`,
      );
    }
  }
}

/**
 * Reject a document whose brace nesting exceeds {@link MAX_GRAPHQL_DEPTH}. Operates on the
 * structural document so braces inside string values never count. Unbalanced closing braces
 * clamp at zero rather than going negative.
 */
function assertBoundedDepth(structural: string): void {
  let depth = 0;
  let maxDepth = 0;
  for (const ch of structural) {
    if (ch === '{') {
      depth += 1;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
      if (maxDepth > MAX_GRAPHQL_DEPTH) {
        throw new ValidationError(
          `GraphQL query nesting is too deep (> ${MAX_GRAPHQL_DEPTH} levels).`,
        );
      }
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
}

/**
 * Validate the optional `variables` map: it must be a plain (non-array, non-null) object
 * containing only JSON-representable values — no functions, symbols, or bigints — bounded
 * in nesting depth and serialized size. Absent variables (`undefined`/`null`) are allowed
 * and returned as `undefined`.
 */
function validateVariables(variables: unknown): Record<string, unknown> | undefined {
  if (variables === undefined || variables === null) {
    return undefined;
  }
  if (typeof variables !== 'object' || Array.isArray(variables)) {
    throw new ValidationError('GraphQL variables must be a plain JSON object.');
  }

  // Deep-walk first: rejects functions/symbols/bigints and bounds nesting depth. The depth
  // cap also makes a cyclic input terminate (as a rejection) instead of looping forever.
  assertJsonValue(variables, 0);

  let serialized: string;
  try {
    serialized = JSON.stringify(variables);
  } catch {
    throw new ValidationError('GraphQL variables must be JSON-serializable.');
  }
  if (typeof serialized !== 'string') {
    // JSON.stringify(undefined) etc. — a plain object should always serialize to a string.
    throw new ValidationError('GraphQL variables must be a plain JSON object.');
  }
  if (serialized.length > MAX_GRAPHQL_VARIABLES_BYTES) {
    throw new ValidationError(
      `GraphQL variables are too large (${serialized.length} bytes, limit ${MAX_GRAPHQL_VARIABLES_BYTES}).`,
    );
  }

  return variables as Record<string, unknown>;
}

/**
 * Recursively assert that `value` is a JSON-representable value within the depth cap.
 * Rejects functions, symbols, and bigints anywhere in the tree; recurses into plain objects
 * and arrays. Scalars (`string`/`number`/`boolean`/`null`) are leaves.
 */
function assertJsonValue(value: unknown, depth: number): void {
  if (depth > MAX_GRAPHQL_VARIABLES_DEPTH) {
    throw new ValidationError(
      `GraphQL variables nesting is too deep (> ${MAX_GRAPHQL_VARIABLES_DEPTH} levels).`,
    );
  }

  const kind = typeof value;
  if (kind === 'function' || kind === 'symbol' || kind === 'bigint') {
    throw new ValidationError(`GraphQL variables must not contain ${kind} values.`);
  }

  if (value === null || kind !== 'object') {
    return; // string | number | boolean | null leaf
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonValue(item, depth + 1);
    }
    return;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    assertJsonValue(nested, depth + 1);
  }
}
