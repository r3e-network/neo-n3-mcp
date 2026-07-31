/**
 * N3_REST_CATALOG — the vetted, read-only n3index REST endpoint registry for the
 * curated Neo N3 analytical tools.
 *
 * The DEPLOYED n3index indexer (api.n3index.dev) is a REST API at
 * `${base}/${network}/<path>` returning `{ data, meta }` envelopes — NOT a
 * neo3fura JSON-RPC gateway. So this file is the N3 REST analogue of
 * `src/indexer/blockscout-catalog.ts` (the Neo X `x_query` registry): it IS the
 * security policy. The guard (`n3-rest-guard.ts`) is a pure function of this map.
 * An endpoint is reachable ONLY if it appears here, and the guard builds the
 * concrete request path + query params from the descriptor field-by-field —
 * never from a raw, model-authored string.
 *
 * Threat model (mirrors Blockscout's):
 *  - SSRF / path traversal: the model NEVER supplies a path. The catalog holds
 *    fixed path TEMPLATES (e.g. "accounts/{address}"); the guard substitutes ONLY
 *    a validated typed segment (n3Address / scriptHash / txid / blockRef) into the
 *    `{...}` placeholder. Every such segment is a base58 N3 address, a 0x+hex
 *    reference, or a decimal — slash-free and traversal-free by construction.
 *    `fetchN3Index` additionally blocks redirects and caps the body at 4 MiB.
 *  - Query params: only the per-endpoint `queryParams` allowlist is honoured; each
 *    value is re-validated (integer + clamp for pagination, `sanitizeString` for
 *    free-text). Unknown query keys are rejected. `fetchN3Index` URL-encodes
 *    params, so the residual risk is only upstream cost, bounded by the response
 *    cap + timeout.
 *  - Read-only: every route below is a GET reader. No write endpoints are present.
 *
 * The caller-facing registry pins an explicit mainnet/testnet selection before
 * dispatch. Internal calls that omit network retain mainnet as the safe default.
 *
 * Endpoints verified live against https://api.n3index.dev (all 200 with real
 * data). Pagination params: limit (default 20, cap 100), offset (default
 * 0, cap 10000).
 */

/** How the guard validates a `{...}` path segment before substituting it into a template. */
export type N3PathParamType =
  | 'n3Address' // validateAddress -> 34-char base58 Neo N3 address
  | 'scriptHash' // validateScriptHash -> 0x + 40 hex contract/token script hash
  | 'txid' // validateHash -> 0x + 64 hex transaction hash
  | 'blockRef'; // decimal block index OR 0x + 64 hex block hash

/** How the guard validates a query-string value. */
export type QueryParamType =
  | 'int' // validateInteger, then clamped to the per-key cap (limit<=100, offset<=10000)
  | 'string' // sanitizeString, 1..N chars, non-empty
  | 'txids'; // one to twelve canonical transaction hashes, emitted as a comma-separated set

export interface PathParamSpec {
  /** Input key AND `{key}` placeholder in the template (e.g. 'address', 'hash', 'txid', 'blockRef'). */
  key: string;
  type: N3PathParamType;
}

export interface QueryParamSpec {
  type: QueryParamType;
  /** Permitted values (unused for the current N3 catalog; kept for shape parity). */
  values?: readonly string[];
  /** When true the guard rejects a call that omits this query param. Defaults to false. */
  required?: boolean;
}

/** Coarse grouping surfaced in the tool description / error text (LLM guidance). */
export type EndpointCategory =
  | 'summary'
  | 'block'
  | 'transaction'
  | 'address'
  | 'token'
  | 'contract'
  | 'governance'
  | 'analytics'
  | 'search';

export interface EndpointDescriptor {
  /** Fixed path under the network segment with at most one `{key}` placeholder. Never model-authored. */
  pathTemplate: string;
  /** The single typed path segment, if the template has a `{...}` placeholder. */
  pathParam?: PathParamSpec;
  /** Allowlisted query keys; the guard emits ONLY these, each re-validated. */
  queryParams?: Record<string, QueryParamSpec>;
  category: EndpointCategory;
  /** One-line description surfaced in the tool description and error text. */
  summary: string;
}

interface CatalogEntry {
  pathTemplate: string;
  pathParam?: PathParamSpec;
  queryParams?: Record<string, QueryParamSpec>;
  category: EndpointCategory;
  summary: string;
}

/** Path param helpers (one typed segment each). */
const ADDRESS_PARAM: PathParamSpec = { key: 'address', type: 'n3Address' };
const HASH_PARAM: PathParamSpec = { key: 'hash', type: 'scriptHash' };
const TXID_PARAM: PathParamSpec = { key: 'txid', type: 'txid' };
const BLOCK_PARAM: PathParamSpec = { key: 'blockRef', type: 'blockRef' };

/** Fresh pagination allowlist (a new object per endpoint so nothing is aliased/shared once frozen). */
function pagination(): Record<string, QueryParamSpec> {
  return { limit: { type: 'int' }, offset: { type: 'int' } };
}

/**
 * Source-of-truth entries. Kept as a plain record so the guard test can assert catalog
 * invariants (deep freeze, placeholder/pathParam consistency) before the frozen Map is
 * built. Keyed by the stable, LLM-facing endpoint key (e.g. 'get_address_summary').
 */
const ENTRIES: Record<string, CatalogEntry> = {
  // ── Chain-wide summary / lists (no path param) ────────────────────────────
  network_summary: {
    pathTemplate: 'summary',
    category: 'summary',
    summary: 'Chain-wide summary (height, totals, headline stats) for the network.',
  },
  list_blocks: {
    pathTemplate: 'blocks',
    category: 'block',
    summary: 'Recent Neo N3 blocks, newest first.',
    queryParams: pagination(),
  },
  list_transactions: {
    pathTemplate: 'transactions',
    category: 'transaction',
    summary: 'Recent Neo N3 transactions, newest first.',
    queryParams: pagination(),
  },
  list_tokens: {
    pathTemplate: 'tokens',
    category: 'token',
    summary: 'Token registry (NEP-17 / NEP-11), newest/most-active first.',
    queryParams: pagination(),
  },
  list_contracts: {
    pathTemplate: 'contracts',
    category: 'contract',
    summary: 'Deployed contract registry, newest first.',
    queryParams: pagination(),
  },
  list_candidate_voters: {
    pathTemplate: 'governance/voters',
    category: 'governance',
    // `candidate` is REQUIRED upstream: the indexer answers
    // GET /{network}/governance/voters with 400 {"error":"candidate public key is
    // required"} when it is absent (verified live). Declaring it required lets the
    // guard reject the call with actionable guidance instead of spending a round
    // trip on a guaranteed 400.
    summary:
      'Governance voters for one candidate, by that candidate\'s 33-byte compressed public key (66 hex chars).',
    queryParams: { ...pagination(), candidate: { type: 'string', required: true } },
  },
  list_validators: {
    pathTemplate: 'metadata/validators',
    category: 'governance',
    // Pairs with list_candidate_voters: this is where the candidate public keys
    // that endpoint requires come from.
    summary:
      'Consensus validators and governance candidates with their public keys and addresses. Use a public key from here as the `candidate` for list_candidate_voters.',
    queryParams: { limit: { type: 'int' } },
  },
  analytics_daily: {
    pathTemplate: 'analytics/daily',
    category: 'analytics',
    summary: 'Daily on-chain analytics series (transactions, addresses, transfers per day).',
    queryParams: pagination(),
  },
  search: {
    pathTemplate: 'search',
    category: 'search',
    summary: 'Global search across blocks, transactions, addresses, tokens, and contracts.',
    queryParams: { q: { type: 'string', required: true } },
  },
  network_status: {
    pathTemplate: 'status',
    category: 'summary',
    summary:
      'Indexer health: whether it is ready, the last indexed block vs the chain tip, and the lag between them.',
  },

  // ── Naming / metadata (answers "what is this thing called?") ──────────────
  list_nns_domains: {
    pathTemplate: 'nns/domains',
    category: 'address',
    summary: 'Registered NNS domain names and the addresses they resolve to.',
    queryParams: pagination(),
  },
  list_address_labels: {
    pathTemplate: 'metadata/addresses',
    category: 'address',
    summary:
      'Known-address labels (exchange, project, and service names). Optionally filter to specific addresses with a comma-separated `addresses` list.',
    queryParams: { limit: { type: 'int' }, addresses: { type: 'string' } },
  },
  list_contract_labels: {
    pathTemplate: 'metadata/contracts',
    category: 'contract',
    summary:
      'Known-contract labels (display name, symbol, logo, source). Optionally filter to specific script hashes with a comma-separated `hashes` list.',
    queryParams: { limit: { type: 'int' }, hashes: { type: 'string' } },
  },

  // ── By block {blockRef} ───────────────────────────────────────────────────
  get_block: {
    pathTemplate: 'blocks/{blockRef}',
    pathParam: BLOCK_PARAM,
    category: 'block',
    summary: 'A single block by height (index) or block hash.',
  },

  // ── By transaction {txid} ─────────────────────────────────────────────────
  get_transaction: {
    pathTemplate: 'transactions/{txid}',
    pathParam: TXID_PARAM,
    category: 'transaction',
    summary: 'A single transaction (signers, witnesses, system/network fees) by its hash.',
  },
  analyze_transaction: {
    pathTemplate: 'transactions/{txid}/analysis',
    pathParam: TXID_PARAM,
    category: 'transaction',
    summary:
      'Deterministic transaction analysis with stable evidence IDs, exact GAS fees, grouped '
      + 'fund flows, evidence-backed participant identities, conservative VM failure '
      + 'classification, code-based findings, and bounded events.',
  },
  investigate_transactions: {
    pathTemplate: 'investigations/transactions',
    category: 'transaction',
    summary:
      'Bounded multi-transaction investigation with a stable evidence-set ID, chronological '
      + 'timeline, observed asset-transfer relationships, exact amounts, and explicit sampling '
      + 'boundaries.',
    queryParams: { txids: { type: 'txids', required: true } },
  },

  // ── By account {address} ──────────────────────────────────────────────────
  get_address_summary: {
    pathTemplate: 'accounts/{address}',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Account summary (first/last seen, balances count, activity) for an address.',
  },
  analyze_address: {
    pathTemplate: 'accounts/{address}/intelligence',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary:
      'Evidence-backed account identity, bounded transfer relationships, co-signers, '
      + 'contract interactions, behavior signals, confidence, and sample boundaries.',
    queryParams: { sample: { type: 'int' }, limit: { type: 'int' } },
  },
  analyze_address_connection: {
    pathTemplate: 'accounts/{address}/connection',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary:
      'Bounded evidence connecting two accounts through direct transfers, co-signed '
      + 'transactions, or shared counterparties. A negative result is not exhaustive.',
    queryParams: {
      target: { type: 'string', required: true },
      sample: { type: 'int' },
      limit: { type: 'int' },
    },
  },
  list_address_balances: {
    pathTemplate: 'accounts/{address}/balances',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Current token balances held by an address.',
    queryParams: pagination(),
  },
  list_address_transactions: {
    pathTemplate: 'accounts/{address}/transactions',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Transactions involving an address, newest first.',
    queryParams: pagination(),
  },
  list_address_transfers: {
    pathTemplate: 'accounts/{address}/transfers',
    pathParam: ADDRESS_PARAM,
    category: 'address',
    summary: 'Token transfers involving an address, newest first.',
    queryParams: pagination(),
  },

  // ── By token {hash} ───────────────────────────────────────────────────────
  get_token: {
    pathTemplate: 'tokens/{hash}',
    pathParam: HASH_PARAM,
    category: 'token',
    summary: 'Token metadata (symbol, decimals, supply, holder count) by script hash.',
  },
  list_token_holders: {
    pathTemplate: 'tokens/{hash}/holders',
    pathParam: HASH_PARAM,
    category: 'token',
    summary: 'Holders (and balances) of a token contract by script hash.',
    queryParams: pagination(),
  },

  // ── By contract {hash} ────────────────────────────────────────────────────
  get_contract: {
    pathTemplate: 'contracts/{hash}',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary: 'Contract manifest / metadata by script hash.',
  },
  analyze_contract: {
    pathTemplate: 'contracts/{hash}/analysis',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary:
      'Deterministic contract analysis with stable evidence IDs for ABI methods, events, '
      + 'manifest permissions and trusts, NEF call tokens, update state, declared source '
      + 'metadata, and conservative code-based findings.',
  },
  analyze_contract_upgrades: {
    pathTemplate: 'contracts/{hash}/upgrades',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary:
      'Immutable contract-version artifacts, historical coverage, and deterministic ABI '
      + 'compatibility changes. Storage compatibility is reported as unknown, never inferred.',
  },
  get_contract_source_verification: {
    pathTemplate: 'contracts/{hash}/source-verification',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary:
      'Reproducible source records for immutable contract versions, including exact source '
      + 'bundle, compiler settings, manifest, NEF, binary, and script hashes. Historical '
      + 'verification never verifies a newer current version.',
  },
  inspect_contract_code: {
    pathTemplate: 'contracts/{hash}/opcodes',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary:
      'Paginated deterministic NeoVM disassembly with stable opcode evidence IDs, ABI method '
      + 'ownership, bounded operands, syscall names, and static control-flow targets.',
    queryParams: pagination(),
  },
  list_contract_calls: {
    pathTemplate: 'contracts/{hash}/calls',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary: 'Recent invocations of a contract by script hash, newest first.',
    queryParams: pagination(),
  },
  list_contract_notifications: {
    pathTemplate: 'contracts/{hash}/notifications',
    pathParam: HASH_PARAM,
    category: 'contract',
    summary: 'Recent notifications (events) emitted by a contract, newest first.',
    queryParams: pagination(),
  },
  list_contract_events: {
    pathTemplate: 'contracts/{hash}/events',
    pathParam: HASH_PARAM,
    category: 'contract',
    // Richer than list_contract_notifications: decoded events, and filterable.
    summary:
      'Decoded events emitted by a contract, filterable by event name, transaction hash, or block height.',
    queryParams: {
      ...pagination(),
      event_name: { type: 'string' },
      tx_hash: { type: 'string' },
      block_height: { type: 'int' },
    },
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
 * The immutable n3index REST endpoint registry. Keyed by the stable, LLM-facing endpoint key
 * (e.g. 'get_address_summary'); the value carries the fixed path template and its typed param
 * allowlist. Deeply frozen so no code path can mutate the security policy at runtime.
 */
export const N3_REST_CATALOG: ReadonlyMap<string, EndpointDescriptor> = Object.freeze(
  new Map<string, EndpointDescriptor>(
    Object.entries(ENTRIES).map(([key, entry]) => [key, freezeDescriptor(entry)]),
  ),
);

/**
 * Render every endpoint as `key(param, param)` for the generic query tool's description.
 *
 * The guard rejects any key outside an endpoint's allowlist, so a caller that guesses gets
 * an error instead of data. The curated `n3_list_*` tools accept `skip` and translate it to
 * the REST `offset` themselves, which makes `skip` the natural (wrong) guess here — so the
 * real keys are published up front rather than discovered through a failed call. Derived
 * from the catalog itself, so a new endpoint or param is documented the moment it is added.
 */
export function renderN3EndpointSignatures(): string {
  return [...N3_REST_CATALOG]
    .map(([key, descriptor]) => {
      const params = [
        ...(descriptor.pathParam ? [descriptor.pathParam.key] : []),
        ...Object.keys(descriptor.queryParams ?? {}),
      ];
      return `${key}(${params.join(', ')})`;
    })
    .join(', ');
}
