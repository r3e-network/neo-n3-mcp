/**
 * METHOD_CATALOG — the vetted, read-only indexer method registry (Phase 1).
 *
 * This map IS the security policy for the generic `query_indexer` tool: the guard
 * (`src/indexer/indexer-query-guard.ts`, Package A) is a pure function of it. A method
 * is callable ONLY if it appears here, and a caller may only supply the exact param
 * keys declared on its descriptor. Because the guard builds the upstream params object
 * field-by-field from `params` — never spreading caller keys — no client-authored Mongo
 * object can ever reach neo3fura through this path (injection-proof by construction).
 *
 * Invariants enforced by `tests/indexer-catalog.test.ts`:
 *  - every `rpcMethod` is unique and PascalCase;
 *  - every `params.*.rpcKey` is PascalCase;
 *  - the catalog is non-empty and deeply frozen;
 *  - only read-only `Get*` handlers appear (no write/admin methods, no `ori.*`
 *    node passthroughs, no `GetNeoFsImage`).
 *
 * Every `rpcMethod` and every `rpcKey` below was verified against the neo3fura source
 * (`neo3fura_http/biz/api/src.<Method>.go` arg structs) — casing is load-bearing.
 *
 * Deviations from the build contract §2a (both source-verified corrections):
 *  - `get_state_root` → `GetStateRoot` takes `BlockHeight uintval.T`, NOT `Index`;
 *    the param maps to rpcKey `BlockHeight` (type `blockHeight`).
 *  - `get_nep11_properties` → `GetNep11PropertiesByContractHashTokenId` takes
 *    `TokenIds []strval.T` (an ARRAY), which a scalar `tokenId` ParamSpec cannot
 *    faithfully represent, so the method is dropped from the first cut.
 */

/** Validation strategy applied to a param value by the guard before it reaches upstream. */
export type ParamType =
  | 'address' // validateAddress(base58) OR 0x scripthash -> normalized upstream form
  | 'scriptHash' // validateScriptHash -> 0x-prefixed
  | 'hash' // validateHash (64-hex tx/block hash) -> 0x-prefixed
  | 'blockHeight' // validateInteger, >= 0
  | 'name' // sanitizeString, 1..64 chars, non-empty
  | 'tokenId' // string, 1..128 chars, [A-Za-z0-9+/=] (base64/hex token id)
  | 'enum' // must equal one of ParamSpec.values
  | 'integer' // validateInteger, optional min/max
  | 'boolean'; // validateBoolean

export interface ParamSpec {
  /** How the guard validates and normalizes the caller-supplied value. */
  type: ParamType;
  /** Exact PascalCase upstream key (e.g. 'Address'); casing is load-bearing. */
  rpcKey: string;
  /** When true the guard rejects a call that omits this param. Defaults to false. */
  required?: boolean;
  /** Permitted values for `type: 'enum'`. */
  values?: readonly string[];
  /** Inclusive bounds for `type: 'integer'`. */
  min?: number;
  max?: number;
}

export type MethodCategory =
  | 'address'
  | 'block'
  | 'transaction'
  | 'transfer'
  | 'asset'
  | 'contract'
  | 'governance'
  | 'state'
  | 'market';

export interface Pagination {
  defaultLimit: number;
  maxLimit: number;
  maxSkip: number;
}

export interface MethodDescriptor {
  /** Exact PascalCase neo3fura RPC method (verified in biz/api source). */
  rpcMethod: string;
  category: MethodCategory;
  /** One-line description surfaced in the tool description and error text (LLM guidance). */
  summary: string;
  /** camelCase tool key -> spec. The upstream params object is built ONLY from these keys. */
  params: Record<string, ParamSpec>;
  /** Present iff the method exposes `limit`/`skip`; the guard clamps against these bounds. */
  pagination?: Pagination;
}

/** Default pagination for every paginated entry unless a method overrides it. */
export const DEFAULT_PAGINATION: Pagination = Object.freeze({
  defaultLimit: 20,
  maxLimit: 100,
  maxSkip: 10_000,
});

const REQ = { required: true } as const;

/** limit/skip param pair shared by every paginated method. */
const PAGE_PARAMS: Record<string, ParamSpec> = {
  limit: { type: 'integer', rpcKey: 'Limit', min: 1 },
  skip: { type: 'integer', rpcKey: 'Skip', min: 0 },
};

interface CatalogEntry {
  rpcMethod: string;
  category: MethodCategory;
  summary: string;
  params: Record<string, ParamSpec>;
  pagination?: Pagination;
}

/**
 * Source-of-truth entries. Kept as a plain array so the test can assert uniqueness
 * and casing before the frozen Map is built.
 */
const ENTRIES: Record<string, CatalogEntry> = {
  // ── Address / account ────────────────────────────────────────────────────
  get_address_summary: {
    rpcMethod: 'GetAddressByAddress',
    category: 'address',
    summary: 'Account summary (balances, counters, first/last seen) for a Neo N3 address.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ } },
  },
  list_address_transactions: {
    rpcMethod: 'GetRawTransactionByAddress',
    category: 'address',
    summary: 'Transactions involving an address, newest first.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_nep17_transfers_by_address: {
    rpcMethod: 'GetNep17TransferByAddress',
    category: 'transfer',
    summary: 'NEP-17 (fungible token) transfers for an address, optionally time-bounded.',
    params: {
      address: { type: 'address', rpcKey: 'Address', ...REQ },
      start: { type: 'integer', rpcKey: 'Start', min: 0 },
      end: { type: 'integer', rpcKey: 'End', min: 0 },
      ...PAGE_PARAMS,
    },
    pagination: DEFAULT_PAGINATION,
  },
  list_nep11_transfers_by_address: {
    rpcMethod: 'GetNep11TransferByAddress',
    category: 'transfer',
    summary: 'NEP-11 (NFT) transfers for an address, newest first.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_assets_held: {
    rpcMethod: 'GetAssetsHeldByAddress',
    category: 'address',
    summary: 'Assets (token balances) held by an address.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  address_transaction_count: {
    rpcMethod: 'GetTransactionCountByAddress',
    category: 'address',
    summary: 'Total number of transactions involving an address.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ } },
  },
  list_addresses: {
    rpcMethod: 'GetAddressList',
    category: 'address',
    summary: 'Global list of known addresses.',
    params: { ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  address_count: {
    rpcMethod: 'GetAddressCount',
    category: 'address',
    summary: 'Total number of known addresses on the chain.',
    params: {},
  },

  // ── Blocks ───────────────────────────────────────────────────────────────
  get_block_by_hash: {
    rpcMethod: 'GetBlockByBlockHash',
    category: 'block',
    summary: 'Full block by its block hash.',
    params: { blockHash: { type: 'hash', rpcKey: 'BlockHash', ...REQ } },
  },
  get_block_by_height: {
    rpcMethod: 'GetBlockByBlockHeight',
    category: 'block',
    summary: 'Full block by its height (index).',
    params: { blockHeight: { type: 'blockHeight', rpcKey: 'BlockHeight', ...REQ } },
  },
  get_block_header_by_hash: {
    rpcMethod: 'GetBlockHeaderByBlockHash',
    category: 'block',
    summary: 'Block header by its block hash.',
    params: { blockHash: { type: 'hash', rpcKey: 'BlockHash', ...REQ } },
  },
  get_block_header_by_height: {
    rpcMethod: 'GetBlockHeaderByBlockHeight',
    category: 'block',
    summary: 'Block header by its height (index).',
    params: { blockHeight: { type: 'blockHeight', rpcKey: 'BlockHeight', ...REQ } },
  },
  list_blocks: {
    rpcMethod: 'GetBlockInfoList',
    category: 'block',
    summary: 'Recent blocks (summary info), newest first.',
    params: { ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  block_count: {
    rpcMethod: 'GetBlockCount',
    category: 'block',
    summary: 'Current block height / total block count.',
    params: {},
  },
  best_block_hash: {
    rpcMethod: 'GetBestBlockHash',
    category: 'block',
    summary: 'Hash of the current best (tip) block.',
    params: {},
  },

  // ── Transactions ─────────────────────────────────────────────────────────
  get_transaction: {
    rpcMethod: 'GetRawTransactionByTransactionHash',
    category: 'transaction',
    summary: 'A single transaction by its hash.',
    params: { transactionHash: { type: 'hash', rpcKey: 'TransactionHash', ...REQ } },
  },
  list_transactions: {
    rpcMethod: 'GetTransactionList',
    category: 'transaction',
    summary: 'Recent transactions, newest first.',
    params: { ...PAGE_PARAMS },
    // The handler self-caps at 200, so a wider maxLimit is safe here.
    pagination: { defaultLimit: 20, maxLimit: 200, maxSkip: 10_000 },
  },
  list_transactions_by_block_hash: {
    rpcMethod: 'GetRawTransactionByBlockHash',
    category: 'transaction',
    summary: 'Transactions contained in a block, by block hash.',
    params: { blockHash: { type: 'hash', rpcKey: 'BlockHash', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_transactions_by_block_height: {
    rpcMethod: 'GetRawTransactionByBlockHeight',
    category: 'transaction',
    summary: 'Transactions contained in a block, by block height.',
    params: { blockHeight: { type: 'blockHeight', rpcKey: 'BlockHeight', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  transaction_count: {
    rpcMethod: 'GetTransactionCount',
    category: 'transaction',
    summary: 'Total number of transactions on the chain.',
    params: {},
  },
  get_application_log: {
    rpcMethod: 'GetApplicationLogByTransactionHash',
    category: 'transaction',
    summary: 'Application execution log (notifications, VM state) for a transaction.',
    params: { transactionHash: { type: 'hash', rpcKey: 'TransactionHash', ...REQ } },
  },
  get_application_log_by_block: {
    rpcMethod: 'GetApplicationLogByBlockHash',
    category: 'transaction',
    summary: 'Application execution logs for every transaction in a block.',
    params: { blockHash: { type: 'hash', rpcKey: 'BlockHash', ...REQ } },
  },
  get_execution: {
    rpcMethod: 'GetExecutionByTransactionHash',
    category: 'transaction',
    summary: 'VM execution result and stack for a transaction.',
    params: { transactionHash: { type: 'hash', rpcKey: 'TransactionHash', ...REQ } },
  },
  get_vmstate: {
    rpcMethod: 'GetVmStateByTransactionHash',
    category: 'transaction',
    summary: 'Final VM state (HALT/FAULT) for a transaction.',
    params: { transactionHash: { type: 'hash', rpcKey: 'TransactionHash', ...REQ } },
  },
  list_transfers_in_tx: {
    rpcMethod: 'GetNep17TransferByTransactionHash',
    category: 'transfer',
    summary: 'NEP-17 transfers that occurred within a single transaction.',
    params: { transactionHash: { type: 'hash', rpcKey: 'TransactionHash', ...REQ } },
  },
  get_mempool: {
    rpcMethod: 'GetRawMemPool',
    category: 'transaction',
    summary: 'Current raw mempool (pending, unconfirmed transactions).',
    params: {},
  },

  // ── Transfers by contract ─────────────────────────────────────────────────
  list_nep17_transfers_by_contract: {
    rpcMethod: 'GetNep17TransferByContractHash',
    category: 'transfer',
    summary: 'NEP-17 transfers for a specific token contract.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_nep11_transfers_by_contract_token: {
    rpcMethod: 'GetNep11TransferByContractHashTokenId',
    category: 'transfer',
    summary: 'NEP-11 transfers for a specific token id within an NFT contract.',
    params: {
      contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ },
      tokenId: { type: 'tokenId', rpcKey: 'TokenId', ...REQ },
      ...PAGE_PARAMS,
    },
    pagination: DEFAULT_PAGINATION,
  },

  // ── Assets ────────────────────────────────────────────────────────────────
  list_assets: {
    rpcMethod: 'GetAssetInfos',
    category: 'asset',
    summary: 'Token/asset registry, optionally filtered by standard (NEP17 or NEP11).',
    params: {
      standard: { type: 'enum', rpcKey: 'Standard', values: ['NEP17', 'NEP11'] },
      ...PAGE_PARAMS,
    },
    pagination: DEFAULT_PAGINATION,
  },
  get_asset_by_contract: {
    rpcMethod: 'GetAssetInfoByContractHash',
    category: 'asset',
    summary: 'Asset metadata (symbol, decimals, supply) for a token contract.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ } },
  },
  search_assets_by_name: {
    rpcMethod: 'GetAssetInfosByName',
    category: 'asset',
    summary: 'Search assets by name (server-built bounded regex).',
    params: { name: { type: 'name', rpcKey: 'Name', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_asset_holders: {
    rpcMethod: 'GetAssetHoldersListByContractHash',
    category: 'asset',
    summary: 'Holders (and balances) of a given token contract.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },

  // ── Contracts ─────────────────────────────────────────────────────────────
  get_contract: {
    rpcMethod: 'GetContractByContractHash',
    category: 'contract',
    summary: 'Deployed contract state (manifest, NEF, update counter) by contract hash.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ } },
  },
  list_contracts: {
    rpcMethod: 'GetContractList',
    category: 'contract',
    summary: 'Deployed contracts, newest first.',
    params: { ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  search_contracts_by_name: {
    rpcMethod: 'GetContractListByName',
    category: 'contract',
    summary: 'Search deployed contracts by name (server-built bounded regex).',
    params: { name: { type: 'name', rpcKey: 'Name', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  contract_count: {
    rpcMethod: 'GetContractCount',
    category: 'contract',
    summary: 'Total number of deployed contracts.',
    params: {},
  },
  list_contract_notifications: {
    rpcMethod: 'GetNotificationByContractHash',
    category: 'contract',
    summary: 'Runtime notifications (events) emitted by a contract.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_contract_calls: {
    rpcMethod: 'GetScCallByContractHash',
    category: 'contract',
    summary: 'Smart-contract calls made to a contract.',
    params: { contractHash: { type: 'scriptHash', rpcKey: 'ContractHash', ...REQ }, ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  list_verified_contracts: {
    rpcMethod: 'GetVerifiedContracts',
    category: 'contract',
    summary: 'Contracts with verified (published) source code.',
    params: { ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },

  // ── Governance ────────────────────────────────────────────────────────────
  list_candidates: {
    rpcMethod: 'GetCandidate',
    category: 'governance',
    summary: 'Consensus/validator candidates and their vote tallies.',
    params: { ...PAGE_PARAMS },
    pagination: DEFAULT_PAGINATION,
  },
  get_candidate_by_address: {
    rpcMethod: 'GetCandidateByAddress',
    category: 'governance',
    summary: 'Candidate details for a specific address.',
    params: { address: { type: 'address', rpcKey: 'Address', ...REQ } },
  },
  candidate_count: {
    rpcMethod: 'GetCandidateCount',
    category: 'governance',
    summary: 'Total number of registered candidates.',
    params: {},
  },
  get_committee: {
    rpcMethod: 'GetCommittee',
    category: 'governance',
    summary: 'Current committee members.',
    params: {},
  },
  total_votes: {
    rpcMethod: 'GetTotalVotes',
    category: 'governance',
    summary: 'Total votes cast across all candidates.',
    params: {},
  },
  list_voters_for_candidate: {
    rpcMethod: 'GetVotersByCandidateAddress',
    category: 'governance',
    summary: 'Addresses that voted for a given candidate.',
    params: {
      candidateAddress: { type: 'address', rpcKey: 'CandidateAddress', ...REQ },
      ...PAGE_PARAMS,
    },
    pagination: DEFAULT_PAGINATION,
  },

  // ── State / misc ──────────────────────────────────────────────────────────
  get_state_root: {
    rpcMethod: 'GetStateRoot',
    category: 'state',
    // Source field is `BlockHeight uintval.T` (NOT `Index`); corrected per source.
    summary: 'State root at a given block height (omit for genesis).',
    params: { blockHeight: { type: 'blockHeight', rpcKey: 'BlockHeight' } },
  },
  get_validated_state_root: {
    rpcMethod: 'GetValidatedStateRoot',
    category: 'state',
    summary: 'Latest validated state root.',
    params: {},
  },
  net_fee_range: {
    rpcMethod: 'GetNetFeeRange',
    category: 'state',
    summary: 'Network-fee range statistics across recent transactions.',
    params: {},
  },
};

/** Recursively freeze a descriptor and its nested param specs. */
function freezeDescriptor(entry: CatalogEntry): MethodDescriptor {
  for (const spec of Object.values(entry.params)) {
    if (spec.values) {
      Object.freeze(spec.values);
    }
    Object.freeze(spec);
  }
  Object.freeze(entry.params);
  if (entry.pagination) {
    Object.freeze(entry.pagination);
  }
  return Object.freeze(entry);
}

/**
 * The immutable method registry. Keyed by the stable, LLM-facing tool key
 * (e.g. 'get_address_summary'); the value carries the verified upstream RPC method
 * and its typed param whitelist.
 */
export const METHOD_CATALOG: ReadonlyMap<string, MethodDescriptor> = Object.freeze(
  new Map<string, MethodDescriptor>(
    Object.entries(ENTRIES).map(([key, entry]) => [key, freezeDescriptor(entry)]),
  ),
);
