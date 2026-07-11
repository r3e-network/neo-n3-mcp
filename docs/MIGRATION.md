# Migrating to 3.0.0

Version 3 removes secret-bearing transaction and wallet operations from the model-facing API.

## Breaking Changes

- Writes are disabled unless `NEO_ENABLE_WRITES=true`.
- `invoke_contract` is now strictly read-only.
- Write invocations use the new `invoke_contract_write` tool or `/api/contracts/invoke/write` route.
- MCP no longer exposes `create_wallet` or `import_wallet`.
- MCP and HTTP write requests no longer accept `fromWIF`, `wif`, private keys, passwords, or `confirm`.
- The signer comes from an owner-only `NEO_SIGNER_WIF_FILE`.
- Every write requires an explicit network, durable idempotency, and independent approval.
- HTTP write approval requires a separate `HTTP_WRITE_APPROVAL_API_KEY`.

## Configuration

```bash
export NEO_ENABLE_WRITES=true
export NEO_SIGNER_WIF_FILE=/run/secrets/neo-signer-wif
export NEO_WRITE_STATE_DIR=/var/lib/neo-n3-mcp/write-operations
export HTTP_WRITE_APPROVAL_API_KEY="$(openssl rand -hex 32)"
```

The signer file must be a regular non-symlink file, owned by the server user, with mode `0600` or stricter. The state directory must be writable by exactly one live server process.

## Request Migration

The old API placed signing material and a confirmation flag directly in `invoke_contract`. That request shape is rejected in 3.x.

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
