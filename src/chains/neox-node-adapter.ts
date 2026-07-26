/**
 * Neo X live node read path.
 *
 * Neo N3 tools read from a Neo RPC node; until now Neo X had no equivalent, only
 * the Blockscout indexer and `x_simulate_call`. This adapter is the Neo X half of
 * the unified `chain` axis: it takes the orthogonal network name
 * ('mainnet' | 'testnet'), resolves it to the EVM network id, and dispatches a
 * JSON-RPC read through the existing EVM client.
 *
 * The adapter maintains its own allowlist, a strict subset of the EVM client's
 * `EVM_READ_ONLY_METHODS`. Two layers of allowlisting is deliberate: the client
 * allowlist protects every EVM caller (including fee estimation and proposal
 * building), while this narrower set is what the *tool surface* may reach. A
 * method has to be added in both places to become callable from a tool, and
 * neither list contains a signing or broadcasting method.
 */

import {
  EVM_READ_ONLY_METHODS,
  NeoxEvmNetwork,
  callEvmRpc,
  type FetchLike,
} from '../contracts/evm-rpc-client';
import { ValidationError } from '../utils/errors';
import { resolveNeoxNetwork } from './chain-id';

/**
 * JSON-RPC methods the unified Neo X node tools may call. Every entry is a pure
 * read: block/transaction/receipt lookups, account balance and code, an
 * `eth_call` simulation, and chain metadata.
 */
export const NEOX_NODE_READ_METHODS: ReadonlySet<string> = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getBlockTransactionCountByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionByBlockNumberAndIndex',
  'eth_getTransactionByBlockHashAndIndex',
  'eth_getTransactionReceipt',
  'eth_getTransactionCount',
  'eth_getBalance',
  'eth_getCode',
  'eth_getLogs',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_syncing',
  'net_version',
]);

/**
 * Rejects anything outside the adapter allowlist before a URL is resolved or a
 * socket is opened, so a rejected method never produces network traffic.
 */
export function assertNeoxNodeReadMethod(method: string): void {
  if (!NEOX_NODE_READ_METHODS.has(method)) {
    throw new ValidationError(
      `Neo X node method not permitted: ${method}. ` +
        'The node tools expose read-only JSON-RPC methods only.',
    );
  }
  if (!EVM_READ_ONLY_METHODS.has(method)) {
    // Defensive: the adapter list is a subset of the client list, and
    // tests/chain-abstraction.test.ts pins that invariant. If the lists ever
    // drift, fail closed rather than forwarding the call.
    throw new ValidationError(`Neo X node method not read-only: ${method}`);
  }
}

/**
 * Performs a read-only Neo X JSON-RPC call.
 *
 * @param network Orthogonal network name ('mainnet' | 'testnet'). The explicit
 *   'neox-mainnet' / 'neox-testnet' ids are also accepted.
 * @param method JSON-RPC method; must be on {@link NEOX_NODE_READ_METHODS}.
 * @param params JSON-RPC params.
 * @param signal Optional abort signal propagated to the request.
 * @param fetchImpl Injectable fetch, used by tests.
 */
export async function neoxNodeCall<T>(
  network: string | undefined,
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
  fetchImpl?: FetchLike,
): Promise<T> {
  assertNeoxNodeReadMethod(method);
  const evmNetwork: NeoxEvmNetwork = resolveNeoxNetwork(network);
  return fetchImpl === undefined
    ? callEvmRpc<T>(evmNetwork, method, params, signal)
    : callEvmRpc<T>(evmNetwork, method, params, signal, fetchImpl);
}
