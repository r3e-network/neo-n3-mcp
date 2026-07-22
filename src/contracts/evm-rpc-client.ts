// Neo X (EVM sidechain) JSON-RPC 2.0 transport — READ ONLY.
//
// This client POSTs a JSON-RPC 2.0 envelope to the configured Neo X node for a
// network ("neox-mainnet" | "neox-testnet"). It exists solely to *simulate* and
// *estimate* transactions (eth_call, eth_estimateGas, eth_gasPrice, ...) so that
// the construct tools can attach a preview to an UNSIGNED proposal. It mirrors
// indexer-rpc-client.ts for base-url validation, bounded JSON, and timeout.
//
// HARD SECURITY BOUNDARY: only a strict allowlist of read-only methods may be
// invoked. Any broadcasting / signing method (eth_sendRawTransaction,
// eth_sendTransaction, eth_signTransaction, ...) is rejected with a typed error
// BEFORE any network call is made. This client never signs and never broadcasts.

import { readBoundedJson } from '../utils/bounded-json';
import { NetworkError, ValidationError } from '../utils/errors';
import { config } from '../config';

type FetchLike = typeof fetch;

export type NeoxEvmNetwork = 'neox-mainnet' | 'neox-testnet';

const DEFAULT_EVM_RPC_TIMEOUT_MS = 12000;
const MAX_EVM_RPC_RESPONSE_BYTES = 4 * 1024 * 1024;

/**
 * The only JSON-RPC methods this client is ever permitted to call. Every entry
 * is a read-only query that cannot change chain state. This set is the security
 * boundary for the non-custodial write layer.
 */
export const EVM_READ_ONLY_METHODS: ReadonlySet<string> = new Set([
  'eth_chainId',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_call',
  'eth_getTransactionCount',
  'eth_getBalance',
  'eth_blockNumber',
  'net_version',
]);

/**
 * Methods that would sign or broadcast a transaction. Explicitly enumerated so
 * a mistaken call produces an unmistakable, typed rejection rather than an
 * opaque "not allowed" message.
 */
export const EVM_FORBIDDEN_METHODS: ReadonlySet<string> = new Set([
  'eth_sendRawTransaction',
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'personal_sendTransaction',
]);

interface JsonRpcErrorBody {
  code?: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: unknown;
  result?: T;
  error?: JsonRpcErrorBody;
}

let rpcRequestId = 0;

function nextRpcId(): number {
  rpcRequestId = (rpcRequestId + 1) % Number.MAX_SAFE_INTEGER;
  return rpcRequestId;
}

/**
 * Normalize a caller-supplied Neo X EVM network id.
 * @throws {ValidationError} on an unrecognized network id.
 */
export function resolveNeoxEvmNetwork(network: string): NeoxEvmNetwork {
  const normalized = String(network || '').trim().toLowerCase();
  if (normalized === 'neox-mainnet' || normalized === 'mainnet') {
    return 'neox-mainnet';
  }
  if (normalized === 'neox-testnet' || normalized === 'testnet') {
    return 'neox-testnet';
  }
  throw new ValidationError(
    `Invalid Neo X network: ${network}. Must be one of: neox-mainnet, neox-testnet`
  );
}

/** Resolve the EIP-155 chain id for a Neo X network. */
export function neoxChainId(network: NeoxEvmNetwork): number {
  return network === 'neox-testnet' ? config.neox.testnetChainId : config.neox.mainnetChainId;
}

function resolveRpcUrl(network: NeoxEvmNetwork): string {
  if (network === 'neox-testnet' && !config.neox.testnetEnabled) {
    throw new ValidationError(
      'Neo X testnet access is disabled (set NEOX_TESTNET_ENABLED=true to enable).'
    );
  }
  const candidates = network === 'neox-testnet'
    ? config.neox.testnetRpcUrls
    : config.neox.mainnetRpcUrls;
  const rawBase = Array.isArray(candidates) ? candidates[0] : undefined;
  const base = String(rawBase || '').replace(/\/+$/, '');
  if (!base) {
    throw new ValidationError(`No Neo X RPC URL configured for ${network}`);
  }
  const parsed = new URL(base);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ValidationError('Neo X RPC URL must be an HTTP/HTTPS URL without embedded credentials');
  }
  return base;
}

/**
 * Assert that a JSON-RPC method is in the read-only allowlist.
 * @throws {ValidationError} for forbidden (broadcast/sign) or any non-allowlisted method.
 */
export function assertReadOnlyEvmMethod(method: string): string {
  if (!method || typeof method !== 'string') {
    throw new ValidationError('EVM RPC method must be a non-empty string');
  }
  if (EVM_FORBIDDEN_METHODS.has(method)) {
    throw new ValidationError(
      `EVM RPC method "${method}" is forbidden: this server never signs or broadcasts transactions. `
      + 'Construct tools return an unsigned proposal for the user to sign in their own wallet.'
    );
  }
  if (!EVM_READ_ONLY_METHODS.has(method)) {
    throw new ValidationError(
      `EVM RPC method "${method}" is not allowed. Permitted read-only methods: `
      + `${[...EVM_READ_ONLY_METHODS].join(', ')}.`
    );
  }
  return method;
}

/**
 * Invoke a read-only Neo X EVM JSON-RPC method.
 *
 * @param network  Neo X network ("neox-mainnet" | "neox-testnet").
 * @param method   A method from EVM_READ_ONLY_METHODS. Broadcast/sign methods throw.
 * @param params   JSON-RPC params array.
 * @param signal   Optional caller abort signal (in addition to the internal timeout).
 * @param fetchImpl Injectable fetch (defaults to the global fetch; used by tests).
 * @returns The JSON-RPC `result` payload.
 * @throws {ValidationError} for a forbidden/non-allowlisted method, unknown network, or bad URL.
 * @throws {NetworkError} on non-200 status, JSON-RPC error envelope, or timeout.
 */
export async function callEvmRpc<T = unknown>(
  network: NeoxEvmNetwork,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  // Enforce the allowlist BEFORE resolving a URL or touching the network.
  assertReadOnlyEvmMethod(method);
  if (!Array.isArray(params)) {
    throw new ValidationError('EVM RPC params must be an array');
  }
  const url = resolveRpcUrl(network);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const abortFromParent = () => controller?.abort();
  if (signal?.aborted) {
    controller?.abort();
  } else {
    signal?.addEventListener('abort', abortFromParent, { once: true });
  }
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), DEFAULT_EVM_RPC_TIMEOUT_MS)
    : null;
  timeoutId?.unref?.();

  const body = JSON.stringify({ jsonrpc: '2.0', id: nextRpcId(), method, params });

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      throw new NetworkError(`Neo X RPC ${method} failed (${response.status})`);
    }

    const envelope = await readBoundedJson<JsonRpcEnvelope<T>>(
      response,
      MAX_EVM_RPC_RESPONSE_BYTES,
      'Neo X RPC',
    );

    if (envelope && envelope.error) {
      const { code, message } = envelope.error;
      throw new NetworkError(
        `Neo X RPC ${method} error: ${message ?? 'unknown error'}`
        + `${code !== undefined ? ` (code ${code})` : ''}`,
      );
    }

    return envelope?.result as T;
  } catch (error) {
    if (error instanceof NetworkError || error instanceof ValidationError) {
      throw error;
    }
    if (controller?.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new NetworkError(`Neo X RPC ${method} timed out after ${DEFAULT_EVM_RPC_TIMEOUT_MS}ms`);
    }
    throw new NetworkError(error instanceof Error ? error.message : `Neo X RPC ${method} failed`);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', abortFromParent);
  }
}
