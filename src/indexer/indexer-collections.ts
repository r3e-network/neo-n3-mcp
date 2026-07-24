/**
 * COLLECTION_CATALOG — the vetted collection registry backing the Phase 2, gated
 * `find_indexer` tool (the truly-arbitrary constrained-filter layer over neo3fura).
 *
 * Phase 1 (`indexer-catalog.ts`) exposes fixed methods with a closed, typed param set: a
 * caller can never author a Mongo object. Phase 2 goes one controlled step further — it lets
 * a caller author a SMALL Mongo-shaped filter — and this map is its security policy. The
 * guard (`indexer-find-guard.ts`) is a pure function of it: a collection is queryable ONLY
 * if it appears here, a field is filterable/sortable ONLY if it is listed here, and the
 * per-collection page bounds below cap the result window. Everything about this layer is
 * deliberately narrow because an author-supplied filter is a bigger attack surface than a
 * typed param.
 *
 * Design rules applied when choosing entries (safety > coverage):
 *  - Each `rpcMethod` is a READ-ONLY neo3fura `Get*` handler whose arg struct carries a
 *    generic `Filter map[string]interface{}` AND requires no other key param (so an arbitrary
 *    filter is the whole query, not a sidecar to a fixed lookup). Verified in
 *    `neo3fura_http/biz/api/src.<Method>.go`:
 *      GetTransactionList{Limit,Skip,Filter,Cursor}, GetAddressList{Limit,Skip,Filter},
 *      GetBlockInfoList{Filter,Limit,Skip}, GetContractList{Filter,Limit,Skip},
 *      GetAssetInfos{Filter,...,Limit,Skip}.
 *  - Every `filterFields` entry is a field neo3fura itself uses as a direct Mongo QUERY key
 *    on that collection (strong evidence it is indexed → an equality/range/`$in` predicate
 *    over it cannot become an unindexed collection-scan DoS). Fields that only appear in a
 *    projection/`$lookup` (not a query) were EXCLUDED when indexing was unverified, per the
 *    "when unsure, exclude" rule. Concretely, verified query keys:
 *      Transaction: hash (GetContractByContractHash), sender (GetRawTransactionByAddress),
 *        blockhash (GetRawTransactionByBlockHash), blockIndex (GetRawTransactionByBlockHeight);
 *        sortable blocktime (GetTransactionList $sort).
 *      Block: hash (GetBlockByBlockHash), index (GetBlockByBlockHeight).
 *      Address: address (GetAddressByAddress); sortable firstusetime (GetAddressList $sort).
 *      Contract: hash (GetContractByContractHash); sortable id (GetContractList $sort).
 *      Asset: hash (GetAssetInfoByContractHash). `type`, `symbol`, `tokenname` were left out:
 *        they are regex/low-cardinality query keys with unverified indexes.
 *  - Casing is load-bearing and copied verbatim from the Go source: `blockIndex` (capital I)
 *    and `blockhash` (lowercase) on Transaction are NOT typos.
 *
 * The guard never trusts this file to be well-formed at runtime: the map and every nested
 * array are deeply frozen so no code path can widen the policy after load.
 */

export interface CollectionDescriptor {
  /** Exact PascalCase neo3fura RPC method (read-only, accepts a client Filter map). */
  rpcMethod: string;
  /** Fields a caller may filter on. Each is a verified, conservatively-indexed Mongo key. */
  filterFields: readonly string[];
  /** Fields a caller may sort on. Subset of indexed fields; may be empty (sort optional). */
  sortFields: readonly string[];
  /** Page size used when the caller omits `limit`. */
  defaultLimit: number;
  /** Hard upper bound the guard clamps `limit` to (caps the result window). */
  maxLimit: number;
  /** One-line description surfaced in the tool description / error text (LLM guidance). */
  summary: string;
}

/** Conservative page bounds shared by every collection unless one overrides them. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface CatalogEntry {
  rpcMethod: string;
  filterFields: readonly string[];
  sortFields: readonly string[];
  defaultLimit: number;
  maxLimit: number;
  summary: string;
}

/**
 * Source-of-truth entries, keyed by the stable, LLM-facing collection key (lowercase, e.g.
 * 'transactions'). The upstream Mongo collection name (e.g. "Transaction") is intentionally
 * NOT the key, so a caller cannot pass an internal collection name to reach an unlisted one.
 */
const ENTRIES: Record<string, CatalogEntry> = {
  transactions: {
    rpcMethod: 'GetTransactionList',
    filterFields: ['hash', 'sender', 'blockhash', 'blockIndex'],
    sortFields: ['blockIndex', 'blocktime'],
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    summary:
      'On-chain transactions. Filter by hash, sender, blockhash, or blockIndex; sort by blockIndex or blocktime.',
  },
  addresses: {
    rpcMethod: 'GetAddressList',
    filterFields: ['address'],
    sortFields: ['firstusetime'],
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    summary: 'Known accounts. Filter by address; sort by firstusetime.',
  },
  blocks: {
    rpcMethod: 'GetBlockInfoList',
    filterFields: ['hash', 'index'],
    sortFields: ['index'],
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    summary: 'Blocks. Filter by hash or index (height); sort by index.',
  },
  contracts: {
    rpcMethod: 'GetContractList',
    filterFields: ['hash'],
    sortFields: ['id'],
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    summary: 'Deployed contracts. Filter by hash; sort by id.',
  },
  assets: {
    rpcMethod: 'GetAssetInfos',
    filterFields: ['hash'],
    sortFields: [],
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
    summary: 'Token/asset registry. Filter by hash (contract script hash).',
  },
};

/** Recursively freeze a descriptor and its field arrays so the policy is immutable at runtime. */
function freezeDescriptor(entry: CatalogEntry): CollectionDescriptor {
  Object.freeze(entry.filterFields);
  Object.freeze(entry.sortFields);
  return Object.freeze(entry);
}

/**
 * The immutable collection registry. Keyed by the stable, LLM-facing collection key
 * (e.g. 'transactions'); the value carries the verified upstream method and the
 * indexed field allowlists. Deeply frozen so no runtime code can widen the policy.
 */
export const COLLECTION_CATALOG: ReadonlyMap<string, CollectionDescriptor> = Object.freeze(
  new Map<string, CollectionDescriptor>(
    Object.entries(ENTRIES).map(([key, entry]) => [key, freezeDescriptor(entry)]),
  ),
);
