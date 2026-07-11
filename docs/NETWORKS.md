# Neo N3 MCP Networks

`@r3e/neo-n3-mcp` supports Neo N3 mainnet and testnet.

## Supported Networks

### Mainnet
- Network name: `mainnet`
- Default RPC: `https://mainnet1.neo.coz.io:443`
- Explorer: `https://explorer.onegate.space/`

### Testnet
- Network name: `testnet`
- Default RPC: `https://testnet1.neo.coz.io:443`
- Explorer: `https://testnet.explorer.onegate.space/`

## Environment Variables

Preferred variables:

```bash
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443
NEO_NETWORK=both
```

Backward-compatible aliases are also accepted:
- `NEO_MAINNET_RPC_URL`
- `NEO_TESTNET_RPC_URL`
- `NEO_NETWORK_MODE`

## Network Mode

`NEO_NETWORK` accepts:
- `mainnet`
- `testnet`
- `both`

Examples:

```bash
NEO_NETWORK=mainnet
```

```bash
NEO_NETWORK=testnet
```

```bash
NEO_NETWORK=both
```

When `NEO_NETWORK=both`, both services are initialized and read-only tool calls without an explicit `network` parameter default to mainnet. State-changing MCP tools never use that default: `transfer_assets`, `claim_gas`, `deploy_contract`, and WIF-backed `invoke_contract` calls require an explicit `network` plus `confirm: true`.

## Per-Request Network Selection

Read-only blockchain and contract tools accept an optional `network` argument:

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

## RPC Transport and Fee Policy

RPC endpoints must use HTTPS unless the host is loopback (`localhost`, `127.0.0.0/8`, or `::1`). Remote plaintext HTTP is rejected by default. A controlled development environment can opt in explicitly:

```bash
NEO_ALLOW_INSECURE_RPC=true
```

This override does not add encryption; prefer HTTPS. Signed transactions are also limited by `NEO_MAX_TRANSACTION_FEE_GAS`, which defaults to `20`. The server rejects a transaction before signing or broadcast when its combined system and network fees exceed the configured GAS amount. Neo's native deployment fee is 10 GAS before network fee and invocation overhead, so lower caps disable contract deployment.

## RPC Recommendations

For production:
- choose stable, low-latency RPC endpoints
- monitor RPC health continuously
- keep a documented failover plan
- test fee estimation and contract reads against your selected endpoint before shipping
