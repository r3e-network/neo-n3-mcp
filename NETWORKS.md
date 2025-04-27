# Neo N3 MCP Networks

This document provides information on the networks supported by the Neo N3 Model Context Protocol (MCP) implementation.

## Table of Contents

- [Supported Networks](#supported-networks)
- [Network Configuration](#network-configuration)
- [RPC Nodes](#rpc-nodes)
- [Network-Specific Features](#network-specific-features)
- [Network Mode](#network-mode)
- [Switching Networks](#switching-networks)
- [Network Status](#network-status)

## Supported Networks

The Neo N3 MCP supports the following networks:

### Mainnet

The Neo N3 mainnet is the primary production network for the Neo N3 blockchain. It is used for real-world applications and transactions.

- **Network Name**: mainnet
- **Default RPC URL**: https://mainnet1.neo.coz.io:443
- **Explorer URL**: https://explorer.onegate.space/

### Testnet

The Neo N3 testnet is a testing network for the Neo N3 blockchain. It is used for development and testing purposes.

- **Network Name**: testnet
- **Default RPC URL**: https://testnet1.neo.coz.io:443
- **Explorer URL**: https://testnet.explorer.onegate.space/

## Network Configuration

The Neo N3 MCP can be configured to use specific RPC nodes for each network.

### Environment Variables

You can configure the RPC nodes using environment variables:

- `MAINNET_RPC_URL`: The URL of the mainnet RPC node
- `TESTNET_RPC_URL`: The URL of the testnet RPC node
- `NETWORK_MODE`: The network mode (mainnet, testnet, both)

Example:
```bash
MAINNET_RPC_URL=https://mainnet1.neo.coz.io:443
TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
NETWORK_MODE=both
```

### Configuration File

You can also configure the RPC nodes using a configuration file:

```json
{
  "networks": {
    "mainnet": {
      "rpcUrl": "https://mainnet1.neo.coz.io:443"
    },
    "testnet": {
      "rpcUrl": "https://testnet1.neo.coz.io:443"
    }
  },
  "networkMode": "both"
}
```

## RPC Nodes

The Neo N3 MCP uses RPC nodes to interact with the Neo N3 blockchain. Here are some public RPC nodes that you can use:

### Mainnet RPC Nodes

- https://mainnet1.neo.coz.io:443
- https://mainnet2.neo.coz.io:443
- https://mainnet3.neo.coz.io:443
- https://mainnet4.neo.coz.io:443
- https://mainnet5.neo.coz.io:443

### Testnet RPC Nodes

- https://testnet1.neo.coz.io:443
- https://testnet2.neo.coz.io:443
- https://testnet3.neo.coz.io:443
- https://testnet4.neo.coz.io:443
- https://testnet5.neo.coz.io:443

## Network-Specific Features

Some features of the Neo N3 MCP may be specific to certain networks.

### Mainnet-Specific Features

- **Real Assets**: Transactions on the mainnet involve real assets with real value.
- **Production Contracts**: The mainnet has production-ready smart contracts.
- **Higher Security**: The mainnet has higher security requirements.

### Testnet-Specific Features

- **Test Assets**: Transactions on the testnet involve test assets with no real value.
- **Test Contracts**: The testnet has test smart contracts that may not be production-ready.
- **Faucets**: The testnet has faucets that provide free test assets.

## Network Mode

The Neo N3 MCP can operate in different network modes:

### Mainnet Only

In mainnet-only mode, the MCP only interacts with the mainnet.

To set mainnet-only mode:
```bash
NETWORK_MODE=mainnet
```

### Testnet Only

In testnet-only mode, the MCP only interacts with the testnet.

To set testnet-only mode:
```bash
NETWORK_MODE=testnet
```

### Both Networks

In both-networks mode, the MCP can interact with both the mainnet and the testnet.

To set both-networks mode:
```bash
NETWORK_MODE=both
```

## Switching Networks

When using the Neo N3 MCP, you can specify which network to use for each operation.

### Specifying the Network in Requests

You can specify the network in your MCP requests:

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "mainnet"
  }
}
```

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

### Default Network

If you don't specify a network in your request, the MCP will use the default network.

The default network is determined by the `NETWORK_MODE` environment variable:
- If `NETWORK_MODE` is `mainnet`, the default network is mainnet.
- If `NETWORK_MODE` is `testnet`, the default network is testnet.
- If `NETWORK_MODE` is `both`, the default network is mainnet.

## Network Status

You can check the status of the networks using the `get_blockchain_info` tool:

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "mainnet"
  }
}
```

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "testnet"
  }
}
```

The response will include information about the network, such as the current block height and the list of validators.
