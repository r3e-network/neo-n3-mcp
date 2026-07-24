# Indexer Query Tools (Phase 1)

Safe, arbitrary, read-only analytical queries against the neo3fura indexer for the
Neo chat assistant. Phase 1 ships one generic tool, `query_indexer`, plus six
curated thin wrappers. Every one is **injection-proof by construction** and
**mainnet-only**.

- **Status:** Phase 1 — shipped, ON by default.
- **Network:** Neo N3 **mainnet only**. These tools take no `network`/`testnet`
  parameter (see [Mainnet only](#mainnet-only)).
- **Trust model:** the assistant is LLM-driven from untrusted natural language.
  These tools must answer arbitrary on-chain questions but can never be turned
  into a DoS or injection vector against neo3fura/Mongo.
- **Phase 2** (`query_indexer_find` + a neo3fura scrub backstop) is **deferred and
  gated off** — see [Phase 2 (deferred)](#phase-2-deferred).

---

## Why this is injection-proof

The load-bearing safety fact, verified in the neo3fura source: **no read handler
in Phase 1's catalog passes a client-authored object into a Mongo predicate.** The
Mongo filter is always a server-built `bson.M` of typed equalities; the client
`Filter` argument is projection-only (an in-memory field selector), never a query
predicate.

Phase 1 exploits this to get broad coverage with **zero client-authored Mongo**:

- The caller picks a **vetted method name** from a fixed catalog and supplies
  **typed scalar params** only.
- The MCP guard (TypeScript, pre-network) rejects any method not in the catalog
  and builds the upstream params object **field-by-field** from the catalog
  spec — caller keys are never spread through to the upstream request.
- There is no free-form filter, sort, pipeline, or regex on this path. Nothing the
  caller sends can become a Mongo operator.

The generic guard mirrors the existing EVM read guard
(`assertReadOnlyEvmMethod`, `src/contracts/evm-rpc-client.ts`): reject with a
`ValidationError` whose message names the allowed set, so the LLM can
self-correct.

---

## Tools

### `query_indexer` (generic)

One tool that exposes the whole vetted catalog. The caller names a method and
passes typed params.

**Input**

| field    | type            | notes |
|----------|-----------------|-------|
| `method` | string (required) | Must be one of the catalog keys (see [Method catalog](#method-catalog)). Rejected before any network call if unknown. |
| `params` | object (optional) | camelCase keys defined per method. Unknown keys are rejected (T18). Scalar values only. |

There is **no** `network` field — the call always targets mainnet.

**Behavior**

1. `assertAllowedMethod(method)` — look the method up in the catalog or throw a
   `ValidationError` listing valid methods (T1/T2).
2. `buildMethodParams(desc, params)` — for each declared param: enforce
   `required`, validate by type (`validateAddress` / `validateScriptHash` /
   `validateHash` / `validateInteger` / `sanitizeString` / `validateBoolean`,
   enum membership, tokenId shape, min/max), and write the normalized value under
   the method's exact PascalCase `rpcKey`. Reject any caller key that is not a
   declared param (T18). Clamp `limit` / `skip` to the method's pagination bounds
   (T13/T14).
3. Call the indexer over JSON-RPC on mainnet and return the `result`.

**Example**

```jsonc
// tool call
{ "method": "get_address_summary", "params": { "address": "N…" } }

// upstream JSON-RPC (POST {base}/mainnet)
{ "jsonrpc": "2.0", "id": 1,
  "method": "GetAddressByAddress",
  "params": { "Address": "N…" } }
```

An unknown method (`{"method":"bogus"}`) or a bad param
(`{"address":"not-an-address"}`) is rejected **before** any upstream object is
built — no network call is made.

### Curated tools (6)

Thin, explicitly-typed wrappers over `query_indexer` for the highest-value chat
shapes. They exist purely for ergonomics — the LLM gets a named tool with a
typed schema instead of composing a generic call. Each delegates to a single
vetted catalog method and inherits all of its guards, clamps, and the mainnet
target.

| Tool | Backing catalog method | Upstream RPC method | Purpose |
|------|------------------------|---------------------|---------|
| `n3_list_blocks` | `list_blocks` | `GetBlockInfoList` | Recent blocks, paginated. |
| `n3_list_transactions` | `list_transactions` | `GetTransactionList` | Recent transactions, paginated (higher `maxLimit`, see caps). |
| `n3_get_transaction` | `get_transaction` | `GetRawTransactionByTransactionHash` | One transaction by hash. |
| `n3_get_block` | block-retrieval method | `GetBlockByBlockHash` / `GetBlockByBlockHeight` | One block by hash or height. |
| `n3_list_nep17_transfers_by_contract` | `list_nep17_transfers_by_contract` | `GetNep17TransferByContractHash` | NEP-17 transfers for a token contract, paginated. |
| `n3_list_assets` | `list_assets` | `GetAssetInfos` | Token/asset list, optional `standard` filter, paginated. |

The **existing 7 `n3_*` and 8 `x_*` analytical tools are unchanged** — the new
names are additive. (Existing `n3_*`: `n3_application_log`, `n3_asset_holders`,
`n3_assets_held_by_address`, `n3_contract_by_name`, `n3_get_address`,
`n3_list_transactions_by_address`, `n3_list_transfers_by_address`.)

---

## Method catalog

The catalog is the security policy — the guard is a pure function of it. The
authoritative source of truth is **`src/indexer/indexer-catalog.ts`** (owned and
finalized by the catalog package); the live `query_indexer` tool description
enumerates the exact method keys advertised at runtime. Casing is load-bearing:
each `rpcMethod` and each param `rpcKey` is the exact PascalCase name the upstream
Go `net/rpc` codec expects, verified against the neo3fura handler source.

**Invariants**

- **Read-only.** No write or admin method appears in the catalog. Write/admin
  methods (e.g. `InsertVerifiedContract`, `SetPopularTokenWhitelist`,
  `TokenUriRename`) are separately blocked server-side by neo3fura's admin gate
  and are never model-facing.
- **Verified casing.** Any method whose exact arg-struct casing could not be
  confirmed against neo3fura source is dropped rather than guessed.

Methods are grouped into these **categories** (used in the tool description so the
LLM can navigate the surface):

| Category | Covers | Representative methods |
|----------|--------|------------------------|
| `address` | account summaries, per-address history, holdings, counts | `GetAddressByAddress`, `GetRawTransactionByAddress`, `GetNep17TransferByAddress`, `GetAssetsHeldByAddress` |
| `block` | blocks and headers by hash/height, lists, counts | `GetBlockByBlockHash`, `GetBlockByBlockHeight`, `GetBlockInfoList` |
| `transaction` | transactions by hash/block, application logs, execution/VM state, counts | `GetRawTransactionByTransactionHash`, `GetTransactionList`, `GetApplicationLogByTransactionHash` |
| `transfer` | NEP-17/NEP-11 transfers by contract or token, NFT properties | `GetNep17TransferByContractHash`, `GetNep11TransferByContractHashTokenId` |
| `asset` | asset/token info, name search, holders | `GetAssetInfos`, `GetAssetInfoByContractHash`, `GetAssetHoldersListByContractHash` |
| `contract` | contract info, lists, name search, notifications, calls, verified contracts | `GetContractList`, `GetContractListByName`, `GetVerifiedContracts` |
| `governance` | candidates, committee, votes, voters | `GetCandidate`, `GetCommittee`, `GetTotalVotes` |
| `state` | state roots, net-fee range, mempool | `GetStateRoot`, `GetNetFeeRange`, `GetRawMemPool` |
| `market` | reserved for market/NFT-market reads | *(deferred follow-up)* |

**Param types.** Each param is one of: `address`, `scriptHash`, `hash`,
`blockHeight`, `name`, `tokenId`, `enum`, `integer`, `boolean`. The guard
validates each param by type before building the upstream object.

**Name/substring search (T5 note).** Where name search exists
(`GetAssetInfosByName`, `GetContractListByName`), the regex is **server-built** in
neo3fura and bounded by the 8s query time limit — the caller never supplies a
regex on this path.

**Deliberately excluded** (do not add without a fresh review): external-fetch
methods such as any NeoFS image proxy (SSRF + large-blob risk), native node-RPC
passthrough already covered by the core neo-service tools, write/admin methods,
and `GetSourceCodeByContractHash` and the NFT-market/NNS group (deferred
follow-ups). See the build contract §2 EXCLUDE for the full list and rationale.

---

## Numeric caps (Phase 1)

Every limit below is enforced in the MCP guard **before** the network call; the
neo3fura backend re-clamps independently as defense in depth. These correspond to
the threat-model rows noted in parentheses.

| Cap | Value | Enforced where | §1 row |
|-----|-------|----------------|--------|
| Default page size (`limit`) | 20 | MCP guard | T13 |
| Max page size (`limit`) | 100 (200 for `list_transactions` / `n3_list_transactions`) | MCP clamp; neo3fura re-clamps at `MaxLimit=2000` | T13 |
| Max `skip` | 10,000 | MCP clamp; neo3fura re-clamps at `MaxSkip=100,000` | T14 |
| Per-call timeout | 8,000 ms | MCP `AbortController` (`DEFAULT_INDEXER_RPC_TIMEOUT_MS`); neo3fura `SetMaxTime(8s)` on every read primitive | T15 |
| Max response body | 4 MiB | `readBoundedJson` inside `callIndexerRpc` (`MAX_INDEXER_RPC_RESPONSE_BYTES`) | T16 |
| Session request rate | 60 requests/min (default; `MAX_REQUESTS_PER_MINUTE`) | process-wide rate-limiter, charged once per tool call | T17 |

Notes:

- Oversized pagination is **clamped, not rejected** (T13/T14) — a request for
  `limit: 5_000_000` returns the max page rather than an error, so the LLM still
  gets a useful answer.
- The timeout (T15) and body cap (T16) apply to **all** indexer calls, including
  the six curated wrappers and the unchanged existing `n3_*` indexer tools.

---

## Threat model → control (no-client-Mongo path)

The controls that make the generic `query_indexer` path safe. "MCP" = the
TypeScript guard, pre-network; "BE" = neo3fura, defense-in-depth. (Full 20-row
table including the Phase 2 client-authored-find rows lives in the build contract
§1.)

| # | Attack (LLM-constructed) | Control | Where |
|---|--------------------------|---------|-------|
| T1 | Call a write/admin method (`InsertVerifiedContract`, `SetPopularTokenWhitelist`, `TokenUriRename`) | Method allowlist: `METHOD_CATALOG.has(method)` rejects non-members before any network call. Admin methods are never in the catalog and are separately blocked by neo3fura's admin gate. | MCP + BE |
| T2 | Call an unvetted or made-up method (`DropDatabase`, `GetNeoFsImage`) | Same allowlist. neo3fura's `config.yml methods.realized` gate is a second layer; an unknown method would proxy to node RPC, never to Mongo. | MCP + BE |
| T13 | Oversized pagination (`limit: 5_000_000`) | Hard `limit` clamp (default 20, max 100 / 200). neo3fura re-clamps at `MaxLimit=2000`. | MCP + BE |
| T14 | Deep-skip DoS (Mongo walks and discards every skipped doc) | `skip` clamp at 10,000, stricter than the backend's `MaxSkip=100,000`. | MCP + BE |
| T16 | Huge result body → memory/bandwidth DoS | `readBoundedJson` 4 MiB cap applied inside `callIndexerRpc`. | MCP |
| T17 | Query-flood DoS from one session | Per-session/client rate-limit bucket (default 60/min), charged once per tool call. | MCP |
| T18 | Unknown/extra param keys smuggling raw objects upstream | Strict per-method param whitelist: the handler builds the upstream params object field-by-field from the catalog spec; caller keys are never spread through. | MCP |

Rows T3–T12, T19, and T20 concern the Phase 2 client-authored-find path and do
not apply to Phase 1. T15 (per-call 8s timeout) also applies here and is listed in
[Numeric caps](#numeric-caps-phase-1).

---

## Configuration

Phase 1 reuses the existing `n3index` config block — no new environment variable
is required to ship it.

| Env var | Default | Effect |
|---------|---------|--------|
| `N3INDEX_ENABLED` | `true` | Master switch for the indexer analytical surface (existing indexer tools plus the Phase 1 query tools). |
| `N3INDEX_API_BASE_URL` | `https://api.n3index.dev` | Base URL of the neo3fura JSON-RPC gateway. Must be HTTP/HTTPS with no embedded credentials; the request is POSTed to `{base}/mainnet`. |

`N3INDEX_FIND_ENABLED` is a **Phase 2** flag (default `false`) that gates the
deferred `query_indexer_find` tool. It is **not** wired in Phase 1 — see below.

---

## Mainnet only

The Phase 1 query tools query **mainnet only** and expose **no** network or
testnet parameter:

- Their schemas contain no `network` field.
- Internally they call `resolveIndexerNetwork` with no network input, which
  defaults to `NeoNetwork.MAINNET`.

There is no supported way to point these tools at testnet. (The underlying
transport can address testnet for other callers, but the Phase 1 tools never pass
a network, so they always resolve to mainnet.)

---

## Phase 2 (deferred)

The following are **not built in Phase 1** and are **gated off**. They are
documented here only so reviewers know the boundary:

- **`query_indexer_find`** — a constrained, client-authored filter/sort tool over
  indexed fields. Deferred.
- **`validateFind` guard** and **`COLLECTION_CATALOG`**
  (`src/indexer/indexer-collections.ts`) — the collection registry and the
  find-path guard (index-anchor requirement, operator allowlist, `$in`/`$or`
  bounds, ESR checks). Deferred.
- **`config.n3index.findEnabled` / `N3INDEX_FIND_ENABLED`** — default `false`.
  Gates *execution* of the find path; the tool (when it exists) would be
  advertised regardless, but calls fail closed while disabled.
- **neo3fura backstop** — a new `FindDocuments` handler plus
  `scrubFilter`/`scrubSort` that independently reject JS/expr/text/regex operators
  and enforce the collection allowlist. `N3INDEX_FIND_ENABLED` must not be flipped
  on until this backstop ships. Deferred.

Until Phase 2 lands, the only way to query the indexer through the assistant is
the vetted-method path documented above, which carries no client-authored Mongo.
