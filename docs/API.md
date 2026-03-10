# Neo N3 MCP API Reference

This document describes the MCP tool surface exposed by `@r3e/neo-n3-mcp`.

For HTTP deployment and REST endpoints, see `docs/DEPLOYMENT.md`.

## Request Format

Use your MCP client to call a tool by name with a JSON `arguments` object:

```json
{
  "name": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
```

## Response Format

Most tools return a text payload containing JSON. MCP clients typically expose that payload in `content[0].text`.

Success payloads contain tool-specific JSON. Error payloads surface an error message and may set the MCP `isError` flag.

## Available Tools

### Network
- `get_network_mode`
- `set_network_mode`

### Blockchain
- `get_blockchain_info`
- `get_block_count`
- `get_block`
- `get_transaction`
- `get_application_log`
- `wait_for_transaction`
- `get_balance`
- `get_unclaimed_gas`
- `get_nep17_transfers`
- `get_nep11_balances`
- `get_nep11_transfers`

### Wallets
- `create_wallet`
- `import_wallet`
- `get_wallet`

### Assets and Fees
- `transfer_assets`
- `estimate_transfer_fees`
- `estimate_invoke_fees`
- `claim_gas`

### Contracts
- `list_famous_contracts`
- `get_contract_info`
- `get_contract_status`
- `invoke_contract`
- `deploy_contract`

### NeoFS
- `neofs_create_container`
- `neofs_get_containers`

## HTTP Endpoint Highlights

- `GET /api/blocks/:hashOrHeight`
- `GET /api/transactions/:txid/application-log`
- `GET /api/transactions/:txid/wait?timeoutMs=30000&pollIntervalMs=1000&includeApplicationLog=true`
- `GET /api/accounts/:address/unclaimed-gas`
- `GET /api/accounts/:address/nep17-transfers?fromTimestampMs=0&toTimestampMs=1710000000000`
- `GET /api/accounts/:address/nep11-balances`
- `GET /api/accounts/:address/nep11-transfers?fromTimestampMs=0&toTimestampMs=1710000000000`
- `POST /api/transfers` with `fromWIF`, `toAddress`, `asset`, `amount`, and `confirm: true`
- `POST /api/transfers/estimate-fees`
- `GET /api/contracts/:reference`
- `GET /api/contracts/:reference/status`
- `POST /api/contracts/invoke/estimate-fees`
- `POST /api/accounts/claim-gas` with `fromWIF` and `confirm: true`
- `POST /api/contracts/deploy` with `fromWIF`, `script`, `manifest`, and `confirm: true`

## Core Tool Reference

### `create_wallet`

Creates a new Neo N3 wallet and returns a NEP-2 encrypted key.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `password` | string | Yes | Password used to encrypt the generated WIF |

#### Example Request

```json
{
  "name": "create_wallet",
  "arguments": {
    "password": "secure-password-123"
  }
}
```

#### Example Response

```json
{
  "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
  "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c",
  "encryptedPrivateKey": "6PYK...",
  "encryptedWIF": "6PYK..."
}
```

Notes:
- `encryptedPrivateKey` is the preferred field name.
- `encryptedWIF` is kept as a compatibility alias.
- Raw WIF is never returned.

### `get_wallet`

Returns sanitized metadata for a locally stored wallet by `address`. The encrypted key is never returned.

### `import_wallet`

Imports a private key or WIF. This tool can be used in two modes:
- **Stateless import**: provide only `key` or `privateKeyOrWIF` to derive `address` and `publicKey`.
- **Encrypted import**: also provide `password` to receive a NEP-2 encrypted key.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | No | Private key or WIF |
| `privateKeyOrWIF` | string | No | Backward-compatible alias for `key` |
| `password` | string | No | Password used to encrypt the imported WIF |

At least one of `key` or `privateKeyOrWIF` must be supplied.

#### Example Request

```json
{
  "name": "import_wallet",
  "arguments": {
    "privateKeyOrWIF": "Kx...",
    "password": "secure-password-123"
  }
}
```

#### Example Response With Password

```json
{
  "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
  "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c",
  "encryptedPrivateKey": "6PYK...",
  "encryptedWIF": "6PYK..."
}
```

#### Example Response Without Password

```json
{
  "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
  "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c"
}
```

### `transfer_assets`

Builds and broadcasts a NEP-17 transfer when `confirm` is explicitly set to `true`.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromWIF` | string | Yes | Sender WIF |
| `toAddress` | string | Yes | Recipient Neo address |
| `asset` | string | Yes | Asset symbol (`NEO`, `GAS`) or script hash |
| `amount` | string | Yes | Transfer amount |
| `network` | string | No | `mainnet` or `testnet` |
| `confirm` | boolean | Yes | Must be `true` to execute the transfer |

### `get_contract_info`

Returns metadata for a contract reference, including deployment status, resolved `scriptHash`, and discovered operations when available.

If the reference is a plain name and not found in the local famous-contract registry, the server falls back to `https://api.n3index.dev` for name-to-hash discovery, then confirms the contract on-chain via the configured Neo RPC endpoint.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contract` | string | No | Generic contract reference: known name, script hash, or Neo address |
| `contractName` | string | No | Backward-compatible alias for a known contract name |
| `nameOrHash` | string | No | Backward-compatible alias for a contract name or script hash |
| `network` | string | No | `mainnet` or `testnet` |

### `invoke_contract`

Invokes a contract by **script hash or generic contract reference**.

Use `get_contract_info` or `get_contract_status` first if you need to inspect a contract before invoking it.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contract` | string | No | Generic contract reference: known name, script hash, or Neo address |
| `scriptHash` | string | No | Target contract script hash |
| `operation` | string | Yes | Contract method name |
| `args` | array | No | Invocation arguments |
| `network` | string | No | `mainnet` or `testnet` |
| `fromWIF` | string | No | Required for write invocations |
| `confirm` | boolean | No | Must be `true` for write invocations |
| `signers` | array | No | Optional signer descriptors |

#### Read Example

```json
{
  "name": "invoke_contract",
  "arguments": {
    "network": "testnet",
    "contract": "NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M",
    "operation": "balanceOf",
    "args": [
      "NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr"
    ]
  }
}
```

#### Write Example

```json
{
  "name": "invoke_contract",
  "arguments": {
    "network": "testnet",
    "fromWIF": "Kx...",
    "contract": "NeoFS",
    "operation": "transfer",
    "args": [
      "NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr",
      "Nb2o2ey5...",
      "1",
      null
    ],
    "confirm": true
  }
}
```

### `estimate_transfer_fees`

Estimates system and network fees for a transfer without broadcasting it.

### `estimate_invoke_fees`

Estimates system and network fees for a contract invocation without broadcasting it. Accepts either `scriptHash` or the generic `contract` reference.

### `get_contract_status`

Checks whether a contract is deployed and returns its resolved address/hash, manifest name, and on-chain status.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contract` | string | No | Generic contract reference: known name, script hash, or Neo address |
| `contractName` | string | No | Backward-compatible alias for a known contract name |
| `nameOrHash` | string | No | Backward-compatible alias for a contract name or script hash |
| `network` | string | No | `mainnet` or `testnet` |

### `claim_gas`

Builds and broadcasts a NEO native `claimGas` transaction when `confirm` is `true`.

### `get_application_log`

Returns the application log for a confirmed transaction hash.

For NEP-17 `Transfer` notifications, the response now preserves the raw RPC notification and adds a `parsed` object with normalized fields:
- `asset` with `scriptHash`, `name`, optional `symbol`, and `logo`
- `from` / `to` with normalized `address`, `scriptHash`, `displayName`, plus direct `name` / `logo` fields when the party is recognized
- full `knownAccount` metadata is still included for supported built-in accounts/contracts
- `logo` and `knownAccount.logo` are embeddable SVG data URIs

### `wait_for_transaction`

Polls the configured RPC node until a transaction confirms or the timeout is reached.

If `includeApplicationLog` is `true`, the embedded `applicationLog` uses the same enriched notification format as `get_application_log`.

Key arguments:
- `txid` (required)
- `timeoutMs` (optional, default `30000`)
- `pollIntervalMs` (optional, default `1000`)
- `includeApplicationLog` (optional)

### `get_unclaimed_gas`

Returns the currently unclaimed GAS amount for a Neo N3 address.

### `get_nep17_transfers`

Returns NEP-17 transfer history for an `address`.

Parameters:
- `address` (required): Neo N3 address to inspect
- `fromTimestampMs` (optional): Start of the history window in Unix epoch milliseconds
- `toTimestampMs` (optional): End of the history window in Unix epoch milliseconds

Response notes:
- Preserves the raw RPC `sent` and `received` entries
- Adds `direction`, `timestampIso`, `asset`, `from`, `to`, and `counterparty` when they can be derived
- For known contracts/accounts, the additive party fields include `displayName`, `name`, `logo`, and `kind`
- This tool depends on node support for the Neo RPC `getnep17transfers` method; minimal nodes may not expose it

### `get_nep11_balances`

Returns NEP-11 balances for an `address`.

Parameters:
- `address` (required): Neo N3 address to inspect

Response notes:
- Preserves the raw RPC `balance` entries and token lists
- Adds `asset` metadata for each NEP-11 balance entry when the asset hash can be normalized
- Adds `tokenCount` when the node returns a `tokens` array
- This tool depends on node support for the Neo RPC `getnep11balances` method; minimal nodes may not expose it

### `get_nep11_transfers`

Returns NEP-11 transfer history for an `address`.

Parameters:
- `address` (required): Neo N3 address to inspect
- `fromTimestampMs` (optional): Start of the history window in Unix epoch milliseconds
- `toTimestampMs` (optional): End of the history window in Unix epoch milliseconds

Response notes:
- Preserves the raw RPC `sent` and `received` entries
- Adds `direction`, `timestampIso`, `asset`, `from`, `to`, and `counterparty` when they can be derived
- This tool depends on node support for the Neo RPC `getnep11transfers` method; minimal nodes may not expose it

### `deploy_contract`

Deploys a contract from a NEF script plus manifest. Requires:
- `fromWIF`
- `script` (base64 or hex)
- `manifest` (JSON object)
- `confirm: true`

## Error Handling

Validation failures are returned as MCP errors with a descriptive message, for example:

```json
{
  "error": "ValidationError: Invalid Neo N3 address format: invalid"
}
```
