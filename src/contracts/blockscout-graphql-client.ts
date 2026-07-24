// Neo X (EVM sidechain) Blockscout GraphQL transport.
//
// The Phase 2 (gated-off) `x_graphql` tool posts an arbitrary — but guard-vetted —
// GraphQL document to the Blockscout GraphQL endpoint at `${base}/api/v1/graphql`, where
// `base` is the per-network explorer host from config (xexplorer.neo.org for
// neox-mainnet). It mirrors the REST client `fetchBlockscout` (src/contracts/
// blockscout-client.ts): same base-URL resolution + hardening, `redirect: 'error'`, an
// internal timeout, and the same 4 MiB bounded-JSON read.
//
// Unlike REST, GraphQL returns HTTP 200 with an `{ errors: [...] }` body on failure, so a
// present, non-empty `errors` array is surfaced as a NetworkError rather than returned.
//
// Read-only: this client only POSTs a query document (writes are rejected upstream by
// `validateGraphqlQuery`); it never mutates chain state.

import { readBoundedJson } from '../utils/bounded-json';
import { NetworkError, ValidationError } from '../utils/errors';
import { config } from '../config';
import type { NeoxNetwork } from './blockscout-client';

type FetchLike = typeof fetch;

const DEFAULT_BLOCKSCOUT_GRAPHQL_TIMEOUT_MS = 12000;
const MAX_BLOCKSCOUT_GRAPHQL_RESPONSE_BYTES = 4 * 1024 * 1024;

/** How many characters of upstream GraphQL error text to surface in a NetworkError. */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/** The GraphQL `{ data, errors }` envelope returned by Blockscout. */
interface GraphqlEnvelope {
  data?: unknown;
  errors?: Array<{ message?: unknown }>;
}

/**
 * Resolve and harden the per-network explorer base URL.
 *
 * Mirrors the private `resolveBaseUrl` in `blockscout-client.ts` (that helper is not
 * exported): testnet access is gated behind config, and the base must be a credential-free
 * HTTP/HTTPS URL. The `x_graphql` tool is mainnet-only, so in practice `network` is
 * `neox-mainnet`; the testnet branch is kept only for parity with the REST client.
 *
 * @throws {ValidationError} when testnet is disabled or the base URL is malformed.
 */
function resolveBaseUrl(network: NeoxNetwork): string {
  if (network === 'neox-testnet' && !config.neox.testnetEnabled) {
    throw new ValidationError(
      'Neo X testnet explorer access is disabled (set NEOX_TESTNET_ENABLED=true to enable).',
    );
  }
  const rawBase =
    network === 'neox-testnet'
      ? config.neox.testnetExplorerApiBaseUrl
      : config.neox.mainnetExplorerApiBaseUrl;
  const base = String(rawBase || '').replace(/\/+$/, '');
  const parsed = new URL(base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ValidationError(
      'Neo X explorer base URL must be an HTTP/HTTPS URL without embedded credentials',
    );
  }
  return base;
}

/**
 * POST a GraphQL document to the Neo X Blockscout GraphQL endpoint.
 *
 * The URL is a fixed constant (`${base}/api/v1/graphql`) — the caller never supplies a
 * path, so there is no SSRF surface here; the `query`/`variables` must already have passed
 * `validateGraphqlQuery` (this client is transport-only, mirroring `fetchBlockscout`).
 *
 * @param network   Neo X network id ("neox-mainnet" | "neox-testnet").
 * @param query     A guard-vetted GraphQL document.
 * @param variables Optional guard-vetted GraphQL variables.
 * @param signal    Optional caller abort signal (in addition to the internal timeout).
 * @param fetchImpl Injectable fetch (defaults to the global fetch; used by tests).
 * @returns The parsed `{ data, ... }` GraphQL response body.
 * @throws {NetworkError} on a non-2xx response, a network error, a timeout, or a GraphQL
 *   response carrying a non-empty `errors` array.
 * @throws {ValidationError} on an unknown network or malformed base URL.
 */
export async function postBlockscoutGraphql<T = unknown>(
  network: NeoxNetwork,
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const base = resolveBaseUrl(network);
  const url = `${base}/api/v1/graphql`;

  const payload: { query: string; variables?: Record<string, unknown> } = { query };
  if (variables !== undefined) {
    payload.variables = variables;
  }
  const body = JSON.stringify(payload);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const abortFromParent = () => controller?.abort();
  if (signal?.aborted) {
    controller?.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_BLOCKSCOUT_GRAPHQL_TIMEOUT_MS)
    : null;
  timeoutId?.unref?.();

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      throw new NetworkError(`Neo X explorer GraphQL responded ${response.status}`);
    }

    const parsed = await readBoundedJson<GraphqlEnvelope>(
      response,
      MAX_BLOCKSCOUT_GRAPHQL_RESPONSE_BYTES,
      'Neo X explorer GraphQL',
    );

    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      throw new NetworkError(`Neo X explorer GraphQL error: ${formatGraphqlErrors(parsed.errors)}`);
    }

    return parsed as unknown as T;
  } catch (error) {
    if (error instanceof NetworkError || error instanceof ValidationError) {
      throw error;
    }
    if (controller?.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new NetworkError('Neo X explorer GraphQL request timed out');
    }
    throw new NetworkError(
      error instanceof Error ? error.message : 'Neo X explorer GraphQL request failed',
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', abortFromParent);
  }
}

/** Join upstream GraphQL error messages into a single bounded, safe string. */
function formatGraphqlErrors(errors: Array<{ message?: unknown }>): string {
  const joined = errors
    .map((entry) => (typeof entry?.message === 'string' ? entry.message : 'unknown error'))
    .join('; ');
  return joined.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${joined.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`
    : joined;
}
