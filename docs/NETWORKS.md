# Neo MCP Networks

`@r3e/neo-mcp` covers two chains, Neo N3 and Neo X, each with a mainnet and a testnet. Chain and network are independent parameters: `chain` is `"n3"` or `"neox"` and is required on every tool both chains implement; `network` is `"mainnet"` or `"testnet"` and defaults to the server's configured mode. Callers never write a chain-qualified network name such as `neox-mainnet`; the tool registry applies that rewrite internally.

## Supported Networks

### Neo N3 mainnet
- Network name: `mainnet`
- Default RPC: `https://mainnet1.neo.coz.io:443`
- Explorer: `https://explorer.onegate.space/`

### Neo N3 testnet
- Network name: `testnet`
- Default RPC: `https://testnet1.neo.coz.io:443`
- Explorer: `https://testnet.explorer.onegate.space/`

### Neo X mainnet
- Network name: `mainnet` with `chain: "neox"`
- EVM chain ID: `47763`
- Default RPC: `https://mainnet-1.rpc.banelabs.org`, `https://mainnet-2.rpc.banelabs.org`
- Explorer API: `https://xexplorer.neo.org`

### Neo X testnet
- Network name: `testnet` with `chain: "neox"`
- EVM chain ID: `12227332`
- Default RPC: `https://testnet-1.rpc.banelabs.org`, `https://neoxt4seed1.ngd.network`
- Explorer API: `https://xt4scan.ngd.network`

Explorer-backed analytics tools are mainnet only on both chains. Neo X explorer responses are cursor-paginated, so `limit` and `skip` apply to the Neo N3 explorer tools only.

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

Neo X variables, all optional, each falling back to the defaults listed above:

```bash
NEOX_MAINNET_RPC_URLS=https://mainnet-1.rpc.banelabs.org,https://mainnet-2.rpc.banelabs.org
NEOX_TESTNET_RPC_URLS=https://testnet-1.rpc.banelabs.org,https://neoxt4seed1.ngd.network
NEOX_MAINNET_EXPLORER_API_BASE_URL=https://xexplorer.neo.org
NEOX_TESTNET_EXPLORER_API_BASE_URL=https://xt4scan.ngd.network
NEOX_MAINNET_CHAIN_ID=47763
NEOX_TESTNET_CHAIN_ID=12227332
NEOX_TESTNET_ENABLED=true
NEOX_GRAPHQL_ENABLED=false
```

`NEOX_GRAPHQL_ENABLED` gates the `query_explorer_graphql` tool and is off by default.

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

`NEO_NETWORK` selects the Neo N3 node mode. When it is `both`, both Neo N3 services are initialized and read-only tool calls without an explicit `network` parameter default to mainnet. The optional signing tools on a local stdio server never use that default: `transfer_assets`, `claim_gas`, `deploy_contract`, and `invoke_contract_write` require an explicit `network` plus acceptance of the exact intent fingerprint through the MCP 2026-07-28 `input_required` flow.

Neo X testnet availability is controlled separately by `NEOX_TESTNET_ENABLED`.

## Per-Request Chain and Network Selection

Tools that exist on both chains accept an optional `chain` argument alongside `network`:

```json
{
  "name": "get_chain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

```json
{
  "name": "get_chain_info",
  "arguments": {
    "chain": "neox",
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
