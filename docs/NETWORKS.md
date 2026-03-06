# Neo N3 MCP Networks

`@r3e/neo-n3-mcp` supports Neo N3 mainnet and testnet.

## Supported Networks

### Mainnet
- Network name: `mainnet`
- Default RPC: `https://mainnet1.neo.coz.io:443`
- Explorer: `https://explorer.onegate.space/`

### Testnet
- Network name: `testnet`
- Default RPC: `http://seed1t5.neo.org:20332`
- Explorer: `https://testnet.explorer.onegate.space/`

## Environment Variables

Preferred variables:

```bash
NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC=http://seed1t5.neo.org:20332
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

When `NEO_NETWORK=both`, both services are initialized and tool calls without an explicit `network` parameter default to mainnet.

## Per-Request Network Selection

Most blockchain and contract tools accept an optional `network` argument:

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

## RPC Recommendations

For production:
- choose stable, low-latency RPC endpoints
- monitor RPC health continuously
- keep a documented failover plan
- test fee estimation and contract reads against your selected endpoint before shipping
