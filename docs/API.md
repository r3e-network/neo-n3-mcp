# Neo MCP API Reference

This document describes the MCP tool surface and HTTP routes exposed by `@r3e/neo-mcp` 4.x.

## Chain and Network Parameters

Neo N3 and Neo X share one tool surface. Tools that exist on both chains take a `chain` parameter:

| Parameter | Values | Meaning |
| --- | --- | --- |
| `chain` | `n3`, `neox` | Target chain. Required on every tool both chains implement; there is no silent default. Single-chain tools accept it optionally and reject the chain they do not serve. |
| `network` | `mainnet`, `testnet` | Node network. Explorer-backed tools are mainnet only. |

The registry rewrites `network` per route, so callers never spell out chain-qualified network names such as `neox-mainnet`. Neo X explorer data comes from Blockscout, whose list endpoints are cursor-paginated, so `limit` and `skip` apply to Neo N3 explorer tools only.

## MCP Surface

The default server exposes 33 read-only tools:

- Server: `get_network_mode`, `get_wallet` (no `chain` parameter)
- Chain, both chains: `get_chain_info`, `get_block_height`, `get_block`, `get_transaction`, `get_transaction_status`, `get_balance`
- Contracts, both chains: `call_contract`, `get_contract_info`, `simulate_call`
- Construct, both chains: `build_transfer`, `build_contract_call`
- Explorer, both chains: `explorer_get_address`, `analyze_address`, `explorer_list_address_transactions`, `explorer_list_address_transfers`, `explorer_list_token_holders`, `explorer_search`, `query_explorer`
- Neo N3 only: `get_application_log`, `wait_for_transaction`, `get_unclaimed_gas`, `get_nep17_transfers`, `get_nep11_balances`, `get_nep11_transfers`, `get_contract_status`, `list_famous_contracts`, `estimate_transfer_fees`, `estimate_invoke_fees`, `explorer_list_address_assets`, `query_explorer_find`
- Neo X only: `query_explorer_graphql`

`call_contract` is strictly read-only: `invokefunction` on Neo N3, `eth_call` on Neo X. Its schema has no signer, private-key, or confirmation fields.

On Neo N3, `get_block` accepts optional `includeStateRoot: true`. The response
then includes `stateRootValidation` with the exact StateService root, the local
root height, the StateValidator-validated height, and a `validated` boolean.
The server rejects mismatched heights or malformed root evidence. The option is
rejected on Neo X, and omitted calls retain the ordinary single block RPC. Neo
N3 block responses also include `timeIso`, deterministically derived from the
node's millisecond `time` value so clients do not need to reinterpret it.

`build_transfer` and `build_contract_call` return UNSIGNED proposals — a NeoLine dapi payload on Neo N3, an unsigned EVM transaction on Neo X. They never sign or broadcast, so key custody stays with the user's wallet.

The MCP HTTP transport is read-only by design and ignores `NEO_ENABLE_WRITES`. On a locally launched stdio server, `NEO_ENABLE_WRITES=true` adds four annotated Neo N3 tools:

- `transfer_assets`
- `invoke_contract_write`
- `claim_gas`
- `deploy_contract`

Each write tool requires:

- `idempotencyKey`: 8-128 letters, numbers, periods, underscores, colons, or hyphens
- `network`: explicitly `mainnet` or `testnet`
- operation-specific public inputs
- an MCP 2026-07-28 client that supports `input_required` multi-round trips
- user acceptance with the exact returned 64-hex intent fingerprint

Write tools are marked destructive and idempotent. They never accept WIFs, private keys, passwords, or `confirm` fields. The signer is loaded from `NEO_SIGNER_WIF_FILE`.
The server signs the expiring `requestState` with
`NEO_MCP_REQUEST_STATE_KEY` and verifies it when the approved
`inputResponse` re-enters the same tool.

### Write Examples

```json
{
  "name": "transfer_assets",
  "arguments": {
    "idempotencyKey": "transfer-2026-07-11-001",
    "network": "testnet",
    "toAddress": "Nb...",
    "asset": "GAS",
    "amount": "1"
  }
}
```

```json
{
  "name": "invoke_contract_write",
  "arguments": {
    "idempotencyKey": "contract-write-2026-07-11-001",
    "network": "testnet",
    "scriptHash": "0x0123456789abcdef0123456789abcdef01234567",
    "operation": "transfer",
    "args": ["Na...", "Nb...", "1", null]
  }
}
```

`deploy_contract` requires a complete serialized NEF artifact:

```json
{
  "name": "deploy_contract",
  "arguments": {
    "idempotencyKey": "deployment-2026-07-11-001",
    "network": "testnet",
    "nef": { "encoding": "base64", "data": "TkVGMw..." },
    "manifest": { "name": "ExampleContract" }
  }
}
```

## HTTP Transport

The REST HTTP server is Neo N3 only and takes no `chain` parameter. Neo X is reachable through the MCP tool surface. The HTTP server requires one configured network. `NEO_NETWORK=both` is rejected by this entrypoint.

`HTTP_API_KEY` authenticates ordinary protected routes. When writes are enabled, `HTTP_WRITE_APPROVAL_API_KEY` is also required and must differ from `HTTP_API_KEY`.

Public probes:

- `GET /live`: process liveness, no RPC call
- `GET /health`: Neo RPC readiness

Protected read routes include:

- `GET /metrics`
- `GET /api/blockchain/info`
- `GET /api/blockchain/height`
- `GET /api/blocks/:hashOrHeight`
- `GET /api/transactions/:txid`
- `GET /api/transactions/:txid/application-log`
- `GET /api/transactions/:txid/wait`
- `GET /api/accounts/:address/balance`
- `GET /api/accounts/:address/unclaimed-gas`
- `GET /api/accounts/:address/nep17-transfers`
- `GET /api/accounts/:address/nep11-balances`
- `GET /api/accounts/:address/nep11-transfers`
- `GET /api/network/mode`
- `GET /api/contracts/:reference`
- `GET /api/contracts/:reference/status`
- `POST /api/contracts/invoke` for read-only invocation
- `POST /api/contracts/:reference/invoke` for read-only invocation by name or hash
- `POST /api/transfers/estimate-fees`
- `POST /api/contracts/invoke/estimate-fees`

### HTTP Write Protocol

Initial requests use `HTTP_API_KEY`, require `Idempotency-Key`, and return `202` with `state: "awaiting_approval"`:

- `POST /api/transfers`
- `POST /api/accounts/claim-gas`
- `POST /api/contracts/invoke/write`
- `POST /api/contracts/deploy`

Example:

```http
POST /api/transfers
Authorization: Bearer <HTTP_API_KEY>
Idempotency-Key: transfer-2026-07-11-001
Content-Type: application/json

{
  "network": "testnet",
  "toAddress": "Nb...",
  "asset": "GAS",
  "amount": "1"
}
```

The response includes `intentId`, `fingerprint`, `signerAddress`, network, and sanitized payload. Reusing the same key with different inputs is rejected.

Approve with the independent principal and exact fingerprint:

```http
POST /api/write-intents/<intentId>/approve
Authorization: Bearer <HTTP_WRITE_APPROVAL_API_KEY>
Content-Type: application/json

{ "fingerprint": "<64 lowercase hex characters>" }
```

Inspect status with the ordinary API principal:

```http
GET /api/write-intents/<intentId>
Authorization: Bearer <HTTP_API_KEY>
```

Prepared raw transaction bytes, txid, validity height, and optional deployment metadata are persisted before relay. On an unknown submission outcome, retry only the same operation with the same idempotency key. The server reconciles by txid and may replay only the stored byte-identical transaction.

## Wallet Administration

MCP never exposes wallet creation or import. HTTP wallet administration is disabled unless `NEO_ENABLE_WALLET_ADMIN=true`. Responses are sanitized and never return encrypted or plaintext key material. Production signing should use the separate owner-only signer file, not HTTP wallet administration.
