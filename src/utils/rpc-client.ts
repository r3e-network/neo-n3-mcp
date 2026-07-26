import * as neonJs from '@cityofzion/neon-js';
import { readBoundedJson } from './bounded-json';
import { RpcDeadlineError } from './rpc-deadline';
import type { NeonRpcClient } from '../types/neon';

interface RpcQuery<T> {
  method: string;
  export(): unknown;
}

interface RpcCallConfig {
  timeout?: number;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

const MAX_RPC_RESPONSE_BYTES = 16 * 1024 * 1024;

type FetchLike = typeof fetch;

/**
 * Methods that submit data to the chain and must never be retried against a
 * second endpoint. A submission that fails without a definitive answer has an
 * UNKNOWN outcome: the first node may still have relayed it. Re-sending it
 * elsewhere would turn "unknown" into a genuine double-submit risk, so callers
 * get the transport error and decide for themselves (see
 * SubmissionOutcomeUnknownError, which tells them to query the txid first).
 */
const NON_FAILOVER_METHODS: ReadonlySet<string> = new Set([
  'sendrawtransaction',
  'submitblock',
]);

/**
 * Ceiling on a single failover attempt, so one black-holed node cannot spend the
 * caller's whole budget before a healthy node is asked.
 *
 * Sized from measured mainnet seed latency (2026-07): healthy seeds answered
 * getblockcount in 0.76s-5.12s, while one seed silently swallowed a request for a
 * full 15s. 8s clears the slowest healthy observation with margin and still
 * leaves room for a second attempt inside a 15s budget.
 *
 * Only applied when a fallback exists — the final endpoint gets whatever budget
 * remains, and a single-endpoint client gets its configured timeout verbatim.
 */
const MAX_ATTEMPT_TIMEOUT_MS = 8_000;

/**
 * Normalize one-or-many endpoints into an ordered, de-duplicated list, dropping
 * blanks. Returns an empty array rather than throwing so callers can raise their
 * own domain-specific error; createRpcClient below does exactly that.
 */
export function toRpcUrlList(rpcUrls: string | readonly string[]): string[] {
  const list = (Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls as string])
    .map((url) => String(url ?? '').trim())
    .filter(Boolean);
  return [...new Set(list)];
}

/**
 * Normalize one-or-many endpoints into an ordered, de-duplicated list.
 * @throws {Error} when no usable endpoint is supplied — better to fail at
 *   construction than at the first read.
 */
function normalizeRpcUrls(rpcUrls: string | readonly string[]): string[] {
  const unique = toRpcUrlList(rpcUrls);
  if (unique.length === 0) {
    throw new Error('createRpcClient requires at least one RPC URL');
  }
  return unique;
}

export function isUnsupportedRpcMethodError(error: unknown): boolean {
  const rpcError = error as { code?: unknown; message?: unknown } | null;
  if (rpcError?.code === -32601 || rpcError?.code === '-32601') {
    return true;
  }

  const message = error instanceof Error
    ? error.message
    : typeof rpcError?.message === 'string' ? rpcError.message : String(error);
  return /(?:method (?:not found|not supported)|unsupported (?:rpc )?method|unknown method)/i.test(message);
}

export function isDefinitiveRpcRejection(error: unknown): boolean {
  const rpcError = error as { name?: unknown; code?: unknown } | null;
  return rpcError?.name === 'RpcError'
    && (typeof rpcError.code === 'number' || typeof rpcError.code === 'string');
}

async function executeQuery<T>(
  rpcUrl: string,
  query: RpcQuery<T>,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query.export()),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`Neo RPC returned HTTP ${response.status} for ${query.method}`);
    }

    const payload = await readBoundedJson<JsonRpcResponse<T>>(
      response,
      MAX_RPC_RESPONSE_BYTES,
      'Neo RPC',
    );
    if (payload.error) {
      const error = new Error(payload.error.message) as Error & { code?: number };
      error.name = 'RpcError';
      error.code = payload.error.code;
      throw error;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
      throw new Error(`Neo RPC returned a malformed response for ${query.method}`);
    }

    return payload.result as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RpcDeadlineError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Try each endpoint in order until one answers.
 *
 * Failover is for *transport* faults only — an unreachable host, an HTTP 5xx
 * (including the Cloudflare 520 a fronted-but-dead seed returns), a timeout, a
 * malformed body. A JSON-RPC error envelope is the chain answering: every node
 * would answer the same way, so it is returned to the caller immediately.
 *
 * `timeoutMs` is the budget for the whole call, not for each hop. Each attempt is
 * capped at MAX_ATTEMPT_TIMEOUT_MS while a fallback remains, so a stalled node
 * costs one ceiling instead of the caller's entire deadline; the last endpoint
 * gets whatever budget is left. Endpoints that fail fast — refused connections,
 * 5xx, malformed bodies — barely touch the budget, so the common case still
 * sweeps the whole list. Only genuine black holes exhaust it early, and the error
 * then reports how far the sweep actually got.
 *
 * Granting every endpoint the full budget instead (the previous policy) made the
 * configured timeout meaningless: five seeds turned a 15s timeout into a 75s
 * call, and one stalled seed made a single read take 20.6s.
 */
async function executeWithFailover<T>(
  rpcUrls: readonly string[],
  query: RpcQuery<T>,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<T> {
  const failoverAllowed = rpcUrls.length > 1
    && !NON_FAILOVER_METHODS.has(String(query.method || '').toLowerCase());
  const endpoints = failoverAllowed ? rpcUrls : rpcUrls.slice(0, 1);

  const startedAt = Date.now();
  let lastError: unknown;
  let attempted = 0;

  for (let index = 0; index < endpoints.length; index += 1) {
    const remaining = timeoutMs - (Date.now() - startedAt);
    // The first attempt always runs: a budget already spent before any request
    // went out must still surface a transport error, never a silent no-op.
    if (attempted > 0 && remaining <= 0) {
      break;
    }

    // A single-endpoint client gets its configured timeout verbatim; capping only
    // buys time for a fallback, and the last endpoint has none to buy it for.
    const isLastEndpoint = index === endpoints.length - 1;
    const budget = attempted === 0 ? timeoutMs : remaining;
    const attemptTimeoutMs = isLastEndpoint ? budget : Math.min(budget, MAX_ATTEMPT_TIMEOUT_MS);

    attempted += 1;
    try {
      return await executeQuery(endpoints[index], query, attemptTimeoutMs, fetchImpl);
    } catch (error) {
      // The chain gave a definitive answer, or the method does not exist here and
      // callers have their own fallbacks for that. Either way, do not re-ask.
      if (isDefinitiveRpcRejection(error) || isUnsupportedRpcMethodError(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  // Preserve the last error's identity (RpcDeadlineError in particular drives
  // "outcome unknown" handling upstream) and only widen its message, so an
  // operator can tell one dead node from every node being dead — and can tell
  // "every node is dead" from "we ran out of time before asking them all".
  if (endpoints.length > 1 && lastError instanceof Error) {
    const scope = attempted === endpoints.length
      ? `all ${endpoints.length} Neo RPC endpoints failed`
      : `${attempted} of ${endpoints.length} Neo RPC endpoints tried within the ${timeoutMs}ms budget`;
    lastError.message = `${lastError.message} (${scope})`;
  }
  throw lastError;
}

/**
 * Build a neon-js-compatible RPC client whose `execute` is served by the bounded,
 * timed, failing-over transport above.
 *
 * @param rpcUrls   One endpoint, or an ordered list tried in sequence.
 * @param timeoutMs Budget for the whole call, shared across failover attempts.
 * @param fetchImpl Injectable fetch (defaults to the global fetch; used by tests).
 * @throws {Error} when rpcUrls contains no usable URL.
 */
export function createRpcClient(
  rpcUrls: string | readonly string[],
  timeoutMs: number,
  fetchImpl: FetchLike = fetch,
): NeonRpcClient {
  const endpoints = normalizeRpcUrls(rpcUrls);
  const client = new neonJs.rpc.RPCClient(endpoints[0]);

  // Jest and downstream callers may replace RPCClient with a compatible test double.
  if (!(client instanceof neonJs.rpc.RPCClient)) {
    return client;
  }

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'execute') {
        return <T>(query: RpcQuery<T>, callConfig?: RpcCallConfig) => {
          const requestedTimeout = callConfig?.timeout;
          const effectiveTimeout = requestedTimeout === undefined
            ? timeoutMs
            : Math.min(timeoutMs, requestedTimeout);
          return executeWithFailover(endpoints, query, effectiveTimeout, fetchImpl);
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
