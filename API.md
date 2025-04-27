# Neo N3 MCP API Reference

This document provides a detailed reference for all the tools available in the Neo N3 Model Context Protocol (MCP).

## Table of Contents

- [Request Format](#request-format)
- [Response Format](#response-format)
- [Blockchain Information](#blockchain-information)
  - [get_blockchain_info](#get_blockchain_info)
  - [get_block](#get_block)
  - [get_transaction](#get_transaction)
- [Account Management](#account-management)
  - [get_balance](#get_balance)
  - [create_wallet](#create_wallet)
  - [import_wallet](#import_wallet)
- [Asset Operations](#asset-operations)
  - [transfer_assets](#transfer_assets)
- [Contract Operations](#contract-operations)
  - [list_famous_contracts](#list_famous_contracts)
  - [get_contract_info](#get_contract_info)
  - [invoke_read_contract](#invoke_read_contract)
  - [invoke_write_contract](#invoke_write_contract)
- [Error Handling](#error-handling)

## Request Format

All requests to the Neo N3 MCP should be made as HTTP POST requests to the MCP endpoint (e.g., `http://localhost:5000/mcp`). The request body should be a JSON object with the following structure:

```json
{
  "name": "tool_name",
  "arguments": {
    "param1": "value1",
    "param2": "value2",
    ...
  }
}
```

Where:
- `name` is the name of the MCP tool to call
- `arguments` is an object containing the parameters for the tool

## Response Format

The response from the Neo N3 MCP will be a JSON object with one of the following structures:

### Success Response

```json
{
  "result": {
    // Tool-specific result data
  }
}
```

### Error Response

```json
{
  "error": {
    "message": "Error message",
    "code": "Error code"
  }
}
```

## Blockchain Information

### get_blockchain_info

Gets general information about the Neo N3 blockchain.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "get_blockchain_info",
  "arguments": {
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "height": 12345678,
    "validators": [
      {
        "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c",
        "votes": "123456789"
      },
      ...
    ],
    "network": "mainnet"
  }
}
```

### get_block

Gets information about a specific block by height or hash.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| hashOrHeight | string or number | Yes | The hash or height of the block to retrieve |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "get_block",
  "arguments": {
    "hashOrHeight": 12345678,
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "size": 1234,
    "version": 0,
    "previousblockhash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "merkleroot": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    "time": 1609459200,
    "index": 12345678,
    "nextconsensus": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "witnesses": [
      {
        "invocation": "0x1234567890abcdef1234567890abcdef",
        "verification": "0xabcdef1234567890abcdef1234567890"
      }
    ],
    "tx": [
      {
        "hash": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        "size": 456,
        "version": 0,
        "nonce": 12345,
        "sender": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
        "sysfee": "0.1",
        "netfee": "0.05",
        "validuntilblock": 12345700,
        "signers": [
          {
            "account": "0x1234567890abcdef1234567890abcdef12345678",
            "scopes": "CalledByEntry"
          }
        ],
        "attributes": [],
        "script": "0x1234567890abcdef1234567890abcdef",
        "witnesses": [
          {
            "invocation": "0x1234567890abcdef1234567890abcdef",
            "verification": "0xabcdef1234567890abcdef1234567890"
          }
        ]
      },
      ...
    ],
    "confirmations": 100
  }
}
```

### get_transaction

Gets information about a specific transaction by transaction ID.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| txid | string | Yes | The transaction ID to retrieve |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "get_transaction",
  "arguments": {
    "txid": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "hash": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "size": 456,
    "version": 0,
    "nonce": 12345,
    "sender": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "sysfee": "0.1",
    "netfee": "0.05",
    "validuntilblock": 12345700,
    "signers": [
      {
        "account": "0x1234567890abcdef1234567890abcdef12345678",
        "scopes": "CalledByEntry"
      }
    ],
    "attributes": [],
    "script": "0x1234567890abcdef1234567890abcdef",
    "witnesses": [
      {
        "invocation": "0x1234567890abcdef1234567890abcdef",
        "verification": "0xabcdef1234567890abcdef1234567890"
      }
    ],
    "blockhash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "confirmations": 100,
    "blocktime": 1609459200
  }
}
```

## Account Management

### get_balance

Gets the balance of a specific address.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| address | string | Yes | The address to check the balance for |
| asset | string | No | The asset to check the balance for (e.g., NEO, GAS). If not provided, returns all assets |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "get_balance",
  "arguments": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "balance": [
      {
        "asset": "NEO",
        "amount": "100",
        "symbol": "NEO",
        "decimals": 0
      },
      {
        "asset": "GAS",
        "amount": "50.123456789",
        "symbol": "GAS",
        "decimals": 8
      }
    ]
  }
}
```

### create_wallet

Creates a new Neo N3 wallet.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| password | string | Yes | The password to encrypt the wallet with |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "create_wallet",
  "arguments": {
    "password": "secure-password-123",
    "network": "testnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c",
    "encryptedPrivateKey": {},
    "WIF": "KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR"
  }
}
```

### import_wallet

Imports an existing Neo N3 wallet.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| key | string | Yes | The private key, WIF, or encrypted key to import |
| password | string | No | The password to decrypt the key (if encrypted) or to encrypt the wallet with (if not encrypted) |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "import_wallet",
  "arguments": {
    "key": "KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR",
    "password": "secure-password-123",
    "network": "testnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "address": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "publicKey": "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c"
  }
}
```

## Asset Operations

### transfer_assets

Transfers assets from one address to another.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromWIF | string | Yes | The WIF of the sending wallet |
| toAddress | string | Yes | The address to send assets to |
| asset | string | Yes | The asset to send (e.g., NEO, GAS) |
| amount | string | Yes | The amount to send |
| confirm | boolean | Yes | Whether to wait for the transaction to be confirmed |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "transfer_assets",
  "arguments": {
    "fromWIF": "KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR",
    "toAddress": "NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ",
    "asset": "GAS",
    "amount": "10.5",
    "confirm": true,
    "network": "testnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "txid": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "blockHeight": 12345678,
    "blockTime": 1609459200,
    "confirmations": 1,
    "status": "confirmed"
  }
}
```

## Contract Operations

### list_famous_contracts

Lists the famous contracts supported by the Neo N3 MCP.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "list_famous_contracts",
  "arguments": {
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "contracts": [
      {
        "name": "NeoFS",
        "description": "Decentralized storage system on Neo N3 blockchain",
        "available": true,
        "operationCount": 3,
        "network": "mainnet"
      },
      {
        "name": "NeoBurger",
        "description": "Neo N3 staking service",
        "available": true,
        "operationCount": 5,
        "network": "mainnet"
      },
      ...
    ]
  }
}
```

### get_contract_info

Gets information about a specific famous contract.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| contractName | string | Yes | The name of the famous contract to get information about |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "get_contract_info",
  "arguments": {
    "contractName": "NeoFS",
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "name": "NeoFS",
    "description": "Decentralized storage system on Neo N3 blockchain",
    "scriptHash": {
      "mainnet": "0x50ac1c37690cc2cfc594472833cf57505d5f46de",
      "testnet": "0xccca29443855a1c455d72a3318cf605debb9e384"
    },
    "operations": {
      "createContainer": {
        "name": "createContainer",
        "description": "Create a storage container",
        "args": [
          {
            "name": "ownerId",
            "type": "string",
            "description": "Owner ID of the container"
          },
          {
            "name": "rules",
            "type": "array",
            "description": "Container rules"
          }
        ]
      },
      "deleteContainer": {
        "name": "deleteContainer",
        "description": "Delete a storage container",
        "args": [
          {
            "name": "containerId",
            "type": "string",
            "description": "Container ID to delete"
          }
        ]
      },
      "getContainers": {
        "name": "getContainers",
        "description": "Get containers owned by an address",
        "args": [
          {
            "name": "ownerId",
            "type": "string",
            "description": "Owner ID to query containers for"
          }
        ]
      }
    }
  }
}
```

### invoke_read_contract

Invokes a read operation on a contract.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| contractName | string | Yes | The name of the famous contract to invoke |
| operation | string | Yes | The operation to invoke |
| args | array | No | The arguments for the operation |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "invoke_read_contract",
  "arguments": {
    "contractName": "NeoFS",
    "operation": "getContainers",
    "args": ["test-owner-id"],
    "network": "mainnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "state": "HALT",
    "gasConsumed": "0.123",
    "stack": [
      {
        "type": "Array",
        "value": [
          {
            "type": "ByteString",
            "value": "container1"
          },
          {
            "type": "ByteString",
            "value": "container2"
          }
        ]
      }
    ]
  }
}
```

### invoke_write_contract

Invokes a write operation on a contract.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromWIF | string | Yes | The WIF of the wallet to use for the invocation |
| contractName | string | Yes | The name of the famous contract to invoke |
| operation | string | Yes | The operation to invoke |
| args | array | No | The arguments for the operation |
| confirm | boolean | Yes | Whether to wait for the transaction to be confirmed |
| network | string | No | The network to use (mainnet or testnet). Default: mainnet |

#### Example Request

```json
{
  "name": "invoke_write_contract",
  "arguments": {
    "fromWIF": "KweTwNercgFfoUNGg3718riDQ12cizaw2Dgffp8SP6PbyJmuA9PR",
    "contractName": "NeoFS",
    "operation": "createContainer",
    "args": ["test-owner-id", []],
    "confirm": true,
    "network": "testnet"
  }
}
```

#### Example Response

```json
{
  "result": {
    "txid": "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    "blockHeight": 12345678,
    "blockTime": 1609459200,
    "confirmations": 1,
    "status": "confirmed"
  }
}
```

## Error Handling

The Neo N3 MCP returns errors in the following format:

```json
{
  "error": {
    "message": "Error message",
    "code": "Error code"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid parameters |
| -32603 | Internal error |
| -32700 | Parse error |

### Example Error Response

```json
{
  "error": {
    "message": "Invalid contract name: NeoFS1. Available contracts: NeoFS, NeoBurger, Flamingo, NeoCompound, GrandShare, GhostMarket",
    "code": -32602
  }
}
```
