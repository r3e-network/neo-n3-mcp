# Neo N3 MCP Server Network Architecture

This document explains the network architecture of the Neo N3 MCP server and how it supports interaction with both mainnet and testnet networks.

## Overview

The Neo N3 MCP server provides seamless integration with multiple Neo N3 networks, allowing Claude to interact with both the mainnet and testnet from a single server instance. This dual-network support enables development, testing, and production use cases without requiring separate server deployments.

## Architecture

![Network Architecture](https://neo.org/images/architecture.png)

### Key Components

1. **Network-specific Service Instances**:
   - The server maintains separate `NeoService` instances for mainnet and testnet
   - Each service connects to its respective RPC endpoint
   - Service instances are managed in a Map collection indexed by network type

2. **Network Parameter**:
   - All API calls accept an optional `network` parameter
   - Valid values are `mainnet` (default) or `testnet`
   - If not specified, the server uses mainnet by default

3. **Configuration System**:
   - Environment variables for configuring network endpoints:
     - `NEO_MAINNET_RPC_URL`: URL for mainnet RPC node (default: `https://mainnet1.neo.coz.io:443`)
     - `NEO_TESTNET_RPC_URL`: URL for testnet RPC node (default: `https://testnet1.neo.coz.io:443`)
   - Command-line arguments for overriding defaults

4. **Network Validation**:
   - Input validation ensures network parameters are valid
   - Robust error handling for invalid network specifications

## Network-Specific Resource URLs

The server supports network-specific resource URLs for direct access to each network:

- `neo://mainnet/status` - Mainnet blockchain status
- `neo://testnet/status` - Testnet blockchain status
- `neo://mainnet/block/12345` - Block information on mainnet
- `neo://testnet/block/12345` - Block information on testnet
- `neo://mainnet/tx/0x1234...` - Transaction information on mainnet
- `neo://testnet/tx/0x1234...` - Transaction information on testnet

## Default Network Behavior

When no network is specified:

1. The server uses the mainnet by default
2. This behavior can be changed by setting the `NEO_NETWORK` environment variable
3. All API responses include the network used for the operation

## Network-Specific Assets

Asset hashes and contract addresses differ between mainnet and testnet. The server handles these differences transparently:

```typescript
// Example of network-specific asset mappings
const assetMappings = {
  mainnet: {
    NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
    GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf'
  },
  testnet: {
    NEO: '0x8c23f196d8a1bfd103a9dcb1f9ccf0c611377d3b',
    GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf'
  }
};
```

## RPC Endpoints

The server uses the following RPC endpoints by default:

### Mainnet
- URL: `https://mainnet1.neo.coz.io:443`
- Provider: City of Zion (CoZ)
- Protocol: HTTPS

### Testnet
- URL: `https://testnet1.neo.coz.io:443`
- Provider: City of Zion (CoZ)
- Protocol: HTTPS

You can override these defaults using the environment variables mentioned above or through the configuration file.

## Best Practices

1. **Development and Testing**:
   - Use testnet for development and testing to avoid using real assets
   - Always specify the network parameter explicitly in development code for clarity

2. **Production Use**:
   - For production applications, explicitly specify `network: 'mainnet'` for clarity
   - Consider using environment variables to switch networks between environments

3. **Network Security**:
   - Always use HTTPS endpoints for production use
   - Consider using private RPC nodes for high-volume applications

## Recommended Usage

### Development Workflow

During development and testing:
1. Use testnet for all operations to avoid using real assets
2. Specify `"network": "testnet"` in all API calls
3. Use testnet faucets to obtain test NEO and GAS

### Production Workflow

For production:
1. Use mainnet for real-world operations
2. Either specify `"network": "mainnet"` or omit the network parameter
3. Ensure proper security measures when dealing with mainnet assets

## Network Status Checking

To verify the status of each network:

```json
// For mainnet status
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "mainnet"
  }
}

// For testnet status
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

## Security Considerations

When working with multiple networks:

1. Always verify the network parameter in sensitive operations
2. Use separate wallets for testnet and mainnet
3. Apply additional confirmation checks for mainnet transactions
4. Consider implementing network-specific rate limiting 