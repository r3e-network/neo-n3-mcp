# Neo N3 MCP API Reference

This document describes the MCP tool surface and HTTP routes exposed by `@r3e/neo-n3-mcp` 3.x.

## MCP Surface

The default server exposes 19 read-only tools:

- Network: `get_network_mode`
- Blockchain: `get_blockchain_info`, `get_block_count`, `get_block`, `get_transaction`, `get_application_log`, `wait_for_transaction`
- Accounts: `get_balance`, `get_unclaimed_gas`, `get_nep17_transfers`, `get_nep11_balances`, `get_nep11_transfers`
- Wallet metadata: `get_wallet`
- Contracts: `invoke_contract`, `list_famous_contracts`, `get_contract_info`, `get_contract_status`
- Fees: `estimate_transfer_fees`, `estimate_invoke_fees`

`invoke_contract` is strictly read-only. Its schema has no signer, private-key, or confirmation fields.

When `NEO_ENABLE_WRITES=true`, four annotated tools are added:

- `transfer_assets`
- `invoke_contract_write`
- `claim_gas`
- `deploy_contract`

Each write tool requires:

- `idempotencyKey`: 8-128 letters, numbers, periods, underscores, colons, or hyphens
- `network`: explicitly `mainnet` or `testnet`
- operation-specific public inputs
- an MCP client that declares form elicitation support
- user acceptance with the exact returned 64-hex intent fingerprint

Write tools are marked destructive and idempotent. They never accept WIFs, private keys, passwords, or `confirm` fields. The signer is loaded from `NEO_SIGNER_WIF_FILE`.

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

The HTTP server requires one configured network. `NEO_NETWORK=both` is rejected by this entrypoint.

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
- `GET /api/contracts/:reference`
- `GET /api/contracts/:reference/status`
- `POST /api/contracts/invoke` for read-only invocation
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
