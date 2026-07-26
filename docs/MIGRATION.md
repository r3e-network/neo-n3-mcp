# Migration Guide

## Migrating to 3.1.0

Version 3.1 renames the package to `@r3e/neo-mcp` and unifies the read surface across Neo N3 and Neo X behind a single `chain` discriminator.

### Package

```bash
npm uninstall @r3e/neo-n3-mcp
npm install @r3e/neo-mcp
```

The binary is `neo-mcp`. `npx -y @r3e/neo-mcp` replaces `npx -y @r3e/neo-n3-mcp`.

### Renamed Tools

| 3.0 name | 3.1 name |
| --- | --- |
| `get_blockchain_info` | `get_chain_info` |
| `get_block_count` | `get_block_height` |
| `invoke_contract` | `call_contract` |

### Required `chain` Argument

Every tool that both chains implement now takes a required `chain` argument, `"n3"` or `"neox"`. There is no silent default; omitting it is a validation error. Single-chain tools accept the chain they serve and reject the other one.

```json
{
  "name": "get_block_height",
  "arguments": { "chain": "n3", "network": "testnet" }
}
```

Neo N3 keeps `mainnet` and `testnet`. Neo X adds its own `mainnet` and `testnet`; Neo X explorer analytics are mainnet-only.

### Neo X Configuration

```bash
export NEOX_MAINNET_RPC_URLS=https://mainnet-1.rpc.banelabs.org
export NEOX_TESTNET_RPC_URLS=https://testnet-1.rpc.banelabs.org
export NEOX_MAINNET_EXPLORER_API_BASE_URL=https://xexplorer.neo.org
export NEOX_GRAPHQL_ENABLED=false
```

`query_explorer_graphql` is registered only when `NEOX_GRAPHQL_ENABLED=true`.

## Migrating to 3.0.0

Version 3 removes secret-bearing transaction and wallet operations from the model-facing API.

### Breaking Changes

- Writes are disabled unless `NEO_ENABLE_WRITES=true`.
- Read-only contract calls, named `invoke_contract` in 3.0 and `call_contract` since 3.1, no longer sign anything.
- Write invocations use the new `invoke_contract_write` tool or `/api/contracts/invoke/write` route.
- MCP no longer exposes `create_wallet` or `import_wallet`.
- MCP and HTTP write requests no longer accept `fromWIF`, `wif`, private keys, passwords, or `confirm`.
- The signer comes from an owner-only `NEO_SIGNER_WIF_FILE`.
- Every write requires an explicit network, durable idempotency, and independent approval.
- HTTP write approval requires a separate `HTTP_WRITE_APPROVAL_API_KEY`.

### Configuration

```bash
export NEO_ENABLE_WRITES=true
export NEO_SIGNER_WIF_FILE=/run/secrets/neo-signer-wif
export NEO_WRITE_STATE_DIR=/var/lib/neo-mcp/write-operations
export HTTP_WRITE_APPROVAL_API_KEY="$(openssl rand -hex 32)"
```

The signer file must be a regular non-symlink file, owned by the server user, with mode `0600` or stricter. The state directory must be writable by exactly one live server process.

### Request Migration

The 2.x API placed signing material and a confirmation flag directly in the contract-invocation tool. That request shape is rejected in 3.x.

New MCP write:

```json
{
  "name": "invoke_contract_write",
  "arguments": {
    "idempotencyKey": "contract-write-2026-07-11-001",
    "network": "testnet",
    "scriptHash": "0x...",
    "operation": "transfer",
    "args": []
  }
}
```

The MCP client must support form elicitation and the user must approve the exact fingerprint.

Old HTTP writes executed immediately. New HTTP writes return `202 awaiting_approval`; approve the returned `intentId` and exact `fingerprint` through `/api/write-intents/:intentId/approve` with the independent approval key.
