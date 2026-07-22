// Neo X (EVM sidechain) Blockscout v2 REST transport.
//
// Mirrors Neo-Explorer-UI/src/services/neox/blockscoutClient.js: it targets the
// Blockscout v2 REST surface at `${base}/api/v2/${path}` where `base` is the
// per-network explorer host from config (xexplorer.neo.org for neox-mainnet).
// Outcomes are distinguished the same way the UI does:
//   - 404            -> resolve null (render an empty / not-found state)
//   - 5xx / network / timeout -> throw NetworkError (an outage, not emptiness)
//   - ok             -> the parsed JSON body
//
// Read-only: this client never mutates chain state.

import { readBoundedJson } from '../utils/bounded-json';
import { NetworkError, ValidationError } from '../utils/errors';
import { config } from '../config';

type FetchLike = typeof fetch;

export type NeoxNetwork = 'neox-mainnet' | 'neox-testnet';

const DEFAULT_BLOCKSCOUT_TIMEOUT_MS = 12000;
const MAX_BLOCKSCOUT_RESPONSE_BYTES = 4 * 1024 * 1024;

/**
 * Normalize a caller-supplied Neo X network id.
 * @throws {ValidationError} on an unrecognized network id.
 */
export function resolveNeoxNetwork(network: string): NeoxNetwork {
  const normalized = String(network || '').trim().toLowerCase();
  if (normalized === 'neox-mainnet' || normalized === 'mainnet') {
    return 'neox-mainnet';
  }
  if (normalized === 'neox-testnet' || normalized === 'testnet') {
    return 'neox-testnet';
  }
  throw new ValidationError(`Invalid Neo X network: ${network}. Must be one of: neox-mainnet, neox-testnet`);
}

function resolveBaseUrl(network: NeoxNetwork): string {
  if (network === 'neox-testnet' && !config.neox.testnetEnabled) {
    throw new ValidationError('Neo X testnet explorer access is disabled (set NEOX_TESTNET_ENABLED=true to enable).');
  }
  const rawBase = network === 'neox-testnet'
    ? config.neox.testnetExplorerApiBaseUrl
    : config.neox.mainnetExplorerApiBaseUrl;
  const base = String(rawBase || '').replace(/\/+$/, '');
  const parsed = new URL(base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ValidationError('Neo X explorer base URL must be an HTTP/HTTPS URL without embedded credentials');
  }
  return base;
}

function buildUrl(network: NeoxNetwork, path: string, params: Record<string, unknown>): string {
  const base = resolveBaseUrl(network);
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const url = new URL(`${base}/api/v2/${cleanPath}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Fetch a Blockscout v2 REST resource for a Neo X network.
 *
 * @param network   Neo X network id ("neox-mainnet" | "neox-testnet").
 * @param path      Path under /api/v2 (e.g. "addresses/0x..", "tokens/0x../holders").
 * @param params    Optional query params.
 * @param signal    Optional caller abort signal (in addition to the internal timeout).
 * @param fetchImpl Injectable fetch (defaults to the global fetch; used by tests).
 * @returns Parsed JSON body, or null on 404.
 * @throws {NetworkError} on 5xx, network error, or timeout.
 * @throws {ValidationError} on an unknown network or malformed base URL.
 */
export async function fetchBlockscout<T = unknown>(
  network: NeoxNetwork,
  path: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<T | null> {
  const url = buildUrl(network, path, params);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const abortFromParent = () => controller?.abort();
  if (signal?.aborted) {
    controller?.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_BLOCKSCOUT_TIMEOUT_MS)
    : null;
  timeoutId?.unref?.();

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (response.status === 404) {
      await response.body?.cancel?.().catch(() => undefined);
      return null;
    }
    if (!response.ok) {
      throw new NetworkError(`Neo X explorer responded ${response.status}`);
    }

    return await readBoundedJson<T>(response, MAX_BLOCKSCOUT_RESPONSE_BYTES, 'Neo X explorer');
  } catch (error) {
    if (error instanceof NetworkError || error instanceof ValidationError) {
      throw error;
    }
    if (controller?.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new NetworkError('Neo X explorer request timed out');
    }
    throw new NetworkError(error instanceof Error ? error.message : 'Neo X explorer request failed');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', abortFromParent);
  }
}
