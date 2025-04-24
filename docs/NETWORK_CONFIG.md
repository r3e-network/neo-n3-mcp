# Network Configuration

The Neo N3 MCP Server supports multiple network configurations, allowing you to specify which Neo N3 networks (mainnet, testnet, or both) should be enabled.

## Network Modes

The server supports three network modes:

- **mainnet_only**: Only the Neo N3 mainnet is enabled
- **testnet_only**: Only the Neo N3 testnet is enabled
- **both**: Both mainnet and testnet are enabled (default)

## Configuration Options

You can configure the network mode in several ways:

### 1. Environment Variables

```bash
# Set the network mode (mainnet_only, testnet_only, or both)
export NEO_NETWORK_MODE=both

# Set the RPC URLs for each network
export NEO_MAINNET_RPC_URL=https://mainnet1.neo.coz.io:443
export NEO_TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
```

### 2. Configuration File

Create a `.neo-n3-mcp.json` file in your project root:

```json
{
  "networkMode": "both",
  "mainnetRpcUrl": "https://mainnet1.neo.coz.io:443",
  "testnetRpcUrl": "https://testnet1.neo.coz.io:443"
}
```

### 3. MCP Configuration

In your MCP configuration file (e.g., `glama.json`):

```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["r3e-network"],
  "config": {
    "networkMode": "both",
    "mainnetRpcUrl": "https://mainnet1.neo.coz.io:443",
    "testnetRpcUrl": "https://testnet1.neo.coz.io:443"
  }
}
```

## MCP Tools for Network Configuration

The server provides MCP tools to get and set the network mode at runtime:

### Get Network Mode

```javascript
const result = await callTool('get_network_mode', {});
console.log(result);
// Output:
// {
//   mode: 'both',
//   availableNetworks: ['mainnet', 'testnet'],
//   defaultNetwork: 'mainnet'
// }
```

### Set Network Mode

```javascript
const result = await callTool('set_network_mode', {
  mode: 'testnet_only'
});
console.log(result);
// Output:
// {
//   mode: 'testnet_only',
//   availableNetworks: ['testnet'],
//   defaultNetwork: 'testnet',
//   message: 'Network mode updated successfully'
// }
```

## Specifying Network in Tool Calls

When calling MCP tools, you can specify which network to use:

```javascript
// Get blockchain info from mainnet
const mainnetInfo = await callTool('get_blockchain_info', {
  network: 'mainnet'
});

// Get blockchain info from testnet
const testnetInfo = await callTool('get_blockchain_info', {
  network: 'testnet'
});
```

If no network is specified, the server will use the default network based on the current mode:
- For `mainnet_only` and `both` modes, the default is `mainnet`
- For `testnet_only` mode, the default is `testnet`

## Error Handling

If you try to use a network that is not enabled in the current mode, you will receive an error:

```javascript
// If mode is set to 'mainnet_only'
try {
  const result = await callTool('get_blockchain_info', {
    network: 'testnet'
  });
} catch (error) {
  console.error(error);
  // Error: Network testnet is not enabled in the current mode (mainnet_only)
}
```
