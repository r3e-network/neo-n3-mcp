/**
 * X_ENDPOINT_CATALOG — the vetted, read-only Blockscout v2 REST endpoint registry for
 * the generic Neo X `x_query` tool.
 *
 * Neo X's indexer IS Blockscout (REST v2 at `${base}/api/v2/<path>`), so this file is the
 * Blockscout analogue of `src/indexer/indexer-catalog.ts` (the neo3fura method registry):
 * it IS the security policy for `x_query`. The guard (`blockscout-query-guard.ts`) is a
 * pure function of this map. An endpoint is reachable ONLY if it appears here, and the
 * guard builds the concrete request path + query params from the descriptor field-by-field
 * — never from a raw, model-authored string.
 *
 * Threat model (Blockscout, lighter than N3's Mongo but real):
 *  - SSRF / path traversal: the model NEVER supplies a path. The catalog holds fixed path
 *    TEMPLATES (e.g. "addresses/{address}"); the guard substitutes ONLY a validated typed
 *    segment (evmAddress / evmHash / blockRef) into the `{...}` placeholder. Every such
 *    segment is `0x`+hex or a decimal string — slash-free and traversal-free by
 *    construction. `fetchBlockscout` additionally blocks redirects and caps the body at
 *    4 MiB.
 *  - Query params: only the per-endpoint `queryParams` allowlist is honoured; each value is
 *    re-validated (enum membership, or `sanitizeString` for free-text `q`). Unknown query
 *    keys are rejected. `fetchBlockscout` URL-encodes params, so the residual risk is only
 *    upstream cost, bounded by the response cap + timeout.
 *  - Read-only: every route below is a GET reader. No write endpoints are present.
 *
 * `x_query` is MAINNET-ONLY: the tool exposes no network field; the handler resolves to
 * `neox-mainnet` (see `resolveNeoxNetworkParam` in `src/handlers/tool-handler.ts`).
 *
 * Endpoints verified against the frontend's Blockscout usage
 * (Neo-Explorer-UI/src/services/neox/*) and the standard Blockscout v2 REST surface.
 */

/** How the guard validates a `{...}` path segment before substituting it into a template. */
export type EvmPathParamType =
  | 'evmAddress' // validateEvmAddress -> 0x + 40 lowercase hex
  | 'evmHash' // validateEvmHash -> 0x + 64 lowercase hex
  | 'blockRef'; // validateEvmBlockRef -> decimal block number OR 0x + 64 hex block hash

/** How the guard validates a query-string value. */
export type QueryParamType =
  | 'enum' // must equal one of QueryParamSpec.values
  | 'string'; // sanitizeString, 1..N chars, non-empty

export interface PathParamSpec {
  /** Input key AND `{key}` placeholder in the template (e.g. 'address', 'hash', 'blockRef'). */
  key: string;
  type: EvmPathParamType;
}

export interface QueryParamSpec {
  type: QueryParamType;
  /** Permitted values for `type: 'enum'`. */
  values?: readonly string[];
  /** When true the guard rejects a call that omits this query param. Defaults to false. */
  required?: boolean;
}

/** Coarse grouping surfaced in the tool description / error text (LLM guidance). */
export type EndpointCategory =
  | 'list'
  | 'address'
  | 'token'
  | 'transaction'
  | 'block'
  | 'contract';

export interface EndpointDescriptor {
  /** Fixed path under /api/v2 with at most one `{key}` placeholder. Never model-authored. */
  pathTemplate: string;
  /** The single typed path segment, if the template has a `{...}` placeholder. */
  pathParam?: PathParamSpec;
  /** Allowlisted query keys; the guard emits ONLY these, each re-validated. */
  queryParams?: Record<string, QueryParamSpec>;
  category: EndpointCategory;
  /** One-line description surfaced in the tool description and error text. */
  summary: string;
}

/** Token-standard filter values shared by the token-transfer / token-list endpoints. */
const ERC_TOKEN_TYPES = ['ERC-20', 'ERC-721', 'ERC-1155'] as const;

interface CatalogEntry {
  pathTemplate: string;
  pathParam?: PathParamSpec;
  queryParams?: Record<string, QueryParamSpec>;
  category: EndpointCategory;
  summary: string;
}

/** Path param helpers (one typed segment each). */
const ADDRESS_PARAM: PathParamSpec = { key: 'address', type: 'evmAddress' };
const HASH_PARAM: PathParamSpec = { key: 'hash', type: 'evmHash' };
const BLOCK_PARAM: PathParamSpec = { key: 'blockRef', type: 'blockRef' };

/**
 * Source-of-truth entries. Kept as a plain record so the guard test can assert catalog
 * invariants (deep freeze, placeholder/pathParam consistency) before the frozen Map is
 * built. Keyed by the stable, LLM-facing endpoint key (e.g. 'get_address').
 */
const ENTRIES: Record<string, CatalogEntry> = {
  // ── Chain-wide lists (no path param) ──────────────────────────────────────
  list_blocks: {
    pathTemplate: 'blocks',
    category: 'list',
    summary: 'Recent Neo X blocks, newest first.',
  },
  list_transactions: {
    pathTemplate: 'transactions',
    category: 'list',
    summary: 'Recent Neo X transactions, newest first (optionally filter pending/validated).',
    queryParams: { filter: { type: 'enum', values: ['pending', 'validated'] } },
  },
  list_token_transfers: {
    pathTemplate: 'token-transfers',
    category: 'list',
    summary: 'Recent token transfers across the chain, newest first.',
  },
  list_internal_transactions: {
    pathTemplate: 'internal-transactions',
    category: 'list',
    summary: 'Recent internal (contract-to-contract) transactions, newest first.',
  },
  list_withdrawals: {
    pathTemplate: 'withdrawals',
    category: 'list',
    summary: 'Recent beacon-chain style withdrawals, newest first.',
  },
  list_tokens: {
    pathTemplate: 'tokens',
    category: 'list',
    summary: 'Token registry, optionally filtered by name query and/or token standard.',
    queryParams: {
      q: { type: 'string' },
      type: { type: 'enum', values: ERC_TOKEN_TYPES },
    },
  },
  list_smart_contracts: {
    pathTemplate: 'smart-contracts',
    category: 'list',
    summary: 'Verified smart contracts, optionally filtered by a name/address query.',
    queryParams: { q: { type: 'string' } },
  },
  search: {
    pathTemplate: 'search',
    category: 'list',
    summary: 'Global search across addresses, tokens, blocks, and transactions.',
    queryParams: { q: { type: 'string', required: true } },
  },
  stats: {
    pathTemplate: 'stats',
    category: 'list',
    summary: 'Chain statistics (total blocks/txs, gas prices, market data).',
  },
  main_page_transactions: {
    pathTemplate: 'main-page/transactions',
    category: 'list',
    summary: 'The latest transactions as shown on the explorer home page.',
  },
  main_page_blocks: {
    pathTemplate: 'main-page/blocks',
    category: 'list',
    summary: 'The latest blocks as shown on the explorer home page.',
  },

  // ── By address {address} ──────────────────────────────────────────────────
  get_address: {
    pathTemplate: 'addresses/{address}',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Account/contract summary (balance, code flags, implementation) for an address.',
  },
  get_address_counters: {
    pathTemplate: 'addresses/{address}/counters',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Aggregate counters (tx count, transfers, gas usage) for an address.',
  },
  list_address_transactions: {
    pathTemplate: 'addresses/{address}/transactions',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Transactions involving an address, optionally filtered to sent (from) or received (to).',
    queryParams: { filter: { type: 'enum', values: ['to', 'from'] } },
  },
  list_address_token_transfers: {
    pathTemplate: 'addresses/{address}/token-transfers',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Token transfers involving an address, optionally filtered by token standard.',
    queryParams: { type: { type: 'enum', values: ERC_TOKEN_TYPES } },
  },
  list_address_internal_transactions: {
    pathTemplate: 'addresses/{address}/internal-transactions',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Internal transactions involving an address, newest first.',
  },
  list_address_logs: {
    pathTemplate: 'addresses/{address}/logs',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Event logs emitted by (or involving) an address, newest first.',
  },
  list_address_token_balances: {
    pathTemplate: 'addresses/{address}/token-balances',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Current token balances held by an address.',
  },
  list_address_withdrawals: {
    pathTemplate: 'addresses/{address}/withdrawals',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Withdrawals credited to an address, newest first.',
  },

  // ── By token {address} ────────────────────────────────────────────────────
  get_token: {
    pathTemplate: 'tokens/{address}',
    pathParam: ADDRESS_PARAM,
    category: 'token',
    summary: 'Token metadata (name, symbol, decimals, supply, holder count) by contract address.',
  },
  get_token_counters: {
    pathTemplate: 'tokens/{address}/counters',
    pathParam: ADDRESS_PARAM,
    category: 'token',
    summary: 'Aggregate counters (transfers, holders) for a token contract.',
  },
  list_token_holders: {
    pathTemplate: 'tokens/{address}/holders',
    pathParam: ADDRESS_PARAM,
    category: 'token',
    summary: 'Holders (and balances) of a token contract.',
  },
  list_token_transfers_of: {
    pathTemplate: 'tokens/{address}/transfers',
    pathParam: ADDRESS_PARAM,
    category: 'token',
    summary: 'Transfers of a specific token contract, newest first.',
  },
  list_token_instances: {
    pathTemplate: 'tokens/{address}/instances',
    pathParam: ADDRESS_PARAM,
    category: 'token',
    summary: 'Minted NFT instances (token ids) of an ERC-721/1155 contract.',
  },

  // ── By transaction {hash} ─────────────────────────────────────────────────
  get_transaction: {
    pathTemplate: 'transactions/{hash}',
    pathParam: HASH_PARAM,
    category: 'transaction',
    summary: 'A single transaction (status, value, gas, decoded input) by its hash.',
  },
  get_transaction_logs: {
    pathTemplate: 'transactions/{hash}/logs',
    pathParam: HASH_PARAM,
    category: 'transaction',
    summary: 'Event logs emitted by a transaction.',
  },
  get_transaction_internal_transactions: {
    pathTemplate: 'transactions/{hash}/internal-transactions',
    pathParam: HASH_PARAM,
    category: 'transaction',
    summary: 'Internal transactions (traces) of a transaction.',
  },
  get_transaction_token_transfers: {
    pathTemplate: 'transactions/{hash}/token-transfers',
    pathParam: HASH_PARAM,
    category: 'transaction',
    summary: 'Token transfers that occurred within a transaction.',
  },
  get_transaction_state_changes: {
    pathTemplate: 'transactions/{hash}/state-changes',
    pathParam: HASH_PARAM,
    category: 'transaction',
    summary: 'Balance/state changes caused by a transaction.',
  },

  // ── By block {blockRef} ───────────────────────────────────────────────────
  get_block: {
    pathTemplate: 'blocks/{blockRef}',
    pathParam: BLOCK_PARAM,
    category: 'block',
    summary: 'A single block by height (number) or block hash.',
  },
  list_block_transactions: {
    pathTemplate: 'blocks/{blockRef}/transactions',
    pathParam: BLOCK_PARAM,
    category: 'block',
    summary: 'Transactions contained in a block (by height or hash).',
  },
  list_block_withdrawals: {
    pathTemplate: 'blocks/{blockRef}/withdrawals',
    pathParam: BLOCK_PARAM,
    category: 'block',
    summary: 'Withdrawals included in a block (by height or hash).',
  },

  // ── Smart contract {address} ──────────────────────────────────────────────
  get_smart_contract: {
    pathTemplate: 'smart-contracts/{address}',
    pathParam: ADDRESS_PARAM,
    category: 'contract',
    summary: 'Verified source, ABI, and compiler settings for a smart contract.',
  },
};

/** Recursively freeze a descriptor and its nested param specs. */
function freezeDescriptor(entry: CatalogEntry): EndpointDescriptor {
  if (entry.pathParam) {
    Object.freeze(entry.pathParam);
  }
  if (entry.queryParams) {
    for (const spec of Object.values(entry.queryParams)) {
      if (spec.values) {
        Object.freeze(spec.values);
      }
      Object.freeze(spec);
    }
    Object.freeze(entry.queryParams);
  }
  return Object.freeze(entry);
}

/**
 * The immutable Blockscout endpoint registry. Keyed by the stable, LLM-facing endpoint key
 * (e.g. 'get_address'); the value carries the fixed path template and its typed param
 * allowlist. Deeply frozen so no code path can mutate the security policy at runtime.
 */
export const X_ENDPOINT_CATALOG: ReadonlyMap<string, EndpointDescriptor> = Object.freeze(
  new Map<string, EndpointDescriptor>(
    Object.entries(ENTRIES).map(([key, entry]) => [key, freezeDescriptor(entry)]),
  ),
);
