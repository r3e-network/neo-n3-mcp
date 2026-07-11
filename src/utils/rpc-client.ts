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
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetch(rpcUrl, {
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

export function createRpcClient(rpcUrl: string, timeoutMs: number): NeonRpcClient {
  const client = new neonJs.rpc.RPCClient(rpcUrl);

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
          return executeQuery(rpcUrl, query, effectiveTimeout);
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
