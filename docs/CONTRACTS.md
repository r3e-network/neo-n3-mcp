# Neo N3 Famous Contracts

This document provides comprehensive documentation for the famous Neo N3 contracts implemented in the Neo N3 MCP server.

## Overview

The Neo N3 MCP server supports integration with several well-known Neo N3 DApps and their smart contracts, enabling users to interact with these contracts through MCP tools. The supported contracts include:

- **NeoFS**: Decentralized storage system on Neo N3 blockchain
- **NeoBurger**: Neo N3 staking service for simplified GAS generation
- **Flamingo**: Neo N3 DeFi platform with AMM, staking, and yield farming
- **NeoCompound**: Automatic yield farming protocol on Neo N3
- **GrandShare**: Profit sharing protocol on Neo N3
- **GhostMarket**: Cross-chain NFT marketplace with Neo N3 support

## Contract Availability and Network Support

Each contract has different availability across Neo N3 networks:

| Contract | Mainnet | Testnet | Description |
|----------|---------|---------|-------------|
| NeoFS | ✅ | ✅ | Decentralized storage system |
| NeoBurger | ✅ | ❌ | Neo staking service |
| Flamingo | ✅ | ❌ | DeFi platform with AMM and staking |
| NeoCompound | ✅ | ❌ | Automatic yield farming protocol |
| GrandShare | ✅ | ❌ | Profit sharing protocol |
| GhostMarket | ✅ | ❌ | NFT marketplace |

> **Note**: Contracts marked as unavailable on testnet will throw an error if you attempt to use them on that network. Always check contract availability before interacting with them.

## Architecture

The contract integration is built around two main components:

1. **Contract Definitions**: Located in `src/contracts/contracts.ts`, these definitions provide metadata about each contract, including script hashes for mainnet and testnet, as well as available operations and their parameters.

2. **Contract Service**: Located in `src/contracts/contract-service.ts`, this service provides methods to interact with the contracts, handling the low-level communication with the Neo N3 blockchain.

## API Reference

### Contract Service

The `ContractService` class provides methods for interacting with the supported contracts.

#### Constructor

```typescript
constructor(rpcUrl: string, network: NeoNetwork = NeoNetwork.MAINNET)
```

Creates a new `ContractService` instance.

- `rpcUrl`: URL of the Neo N3 RPC node
- `network`: Network type (mainnet or testnet)

#### Core Methods

##### getContract

```typescript
getContract(contractName: string): ContractDefinition
```

Gets a contract definition by name.

- `contractName`: Name of the contract
- Returns: Contract definition

##### getContractScriptHash

```typescript
getContractScriptHash(contractName: string): string
```

Gets a contract's script hash for the current network.

- `contractName`: Name of the contract
- Returns: Script hash for the current network

##### queryContract

```typescript
async queryContract(contractName: string, operation: string, args: any[] = []): Promise<any>
```

Queries a contract's read-only method.

- `contractName`: Name of the contract
- `operation`: Operation name
- `args`: Arguments for the operation
- Returns: Operation result

##### invokeContract

```typescript
async invokeContract(
  fromAccount: any,
  contractName: string,
  operation: string,
  args: any[] = [],
  additionalScriptAttributes: any[] = []
): Promise<string>
```

Invokes a contract's method that requires signing.

- `fromAccount`: Account to sign the transaction
- `contractName`: Name of the contract
- `operation`: Operation name
- `args`: Arguments for the operation
- `additionalScriptAttributes`: Additional script attributes
- Returns: Transaction hash

##### listSupportedContracts

```typescript
listSupportedContracts(): Array<{ name: string, description: string }>
```

Lists all supported famous contracts.

- Returns: Array of contract names and descriptions

##### getContractOperations

```typescript
getContractOperations(contractName: string): any
```

Gets details about a contract's operations.

- `contractName`: Name of the contract
- Returns: Contract operations details

##### isContractAvailable

```typescript
isContractAvailable(contractName: string): boolean
```

Checks if a contract is available on the current network.

- `contractName`: Name of the contract
- Returns: True if the contract is available

### Contract-Specific Methods

#### NeoFS Methods

##### createNeoFSContainer

```typescript
async createNeoFSContainer(fromAccount: any, ownerId: string, rules: any[]): Promise<string>
```

Creates a NeoFS container.

- `fromAccount`: Account to sign the transaction
- `ownerId`: Owner ID of the container
- `rules`: Container rules
- Returns: Transaction hash

##### getNeoFSContainers

```typescript
async getNeoFSContainers(ownerId: string): Promise<any>
```

Gets NeoFS containers owned by an address.

- `ownerId`: Owner ID to query containers for
- Returns: Operation result

#### NeoBurger Methods

##### depositNeoToNeoBurger

```typescript
async depositNeoToNeoBurger(fromAccount: any): Promise<string>
```

Deposits NEO to receive bNEO tokens.

- `fromAccount`: Account to sign the transaction
- Returns: Transaction hash

##### withdrawNeoFromNeoBurger

```typescript
async withdrawNeoFromNeoBurger(fromAccount: any, amount: string | number): Promise<string>
```

Withdraws NEO by returning bNEO tokens.

- `fromAccount`: Account to sign the transaction
- `amount`: Amount of bNEO to exchange
- Returns: Transaction hash

##### getNeoBurgerBalance

```typescript
async getNeoBurgerBalance(address: string): Promise<any>
```

Gets bNEO balance of an account.

- `address`: Account to check balance for
- Returns: Operation result

##### claimNeoBurgerGas

```typescript
async claimNeoBurgerGas(fromAccount: any): Promise<string>
```

Claims accumulated GAS rewards.

- `fromAccount`: Account to sign the transaction
- Returns: Transaction hash

#### Flamingo Methods

##### stakeFlamingo

```typescript
async stakeFlamingo(fromAccount: any, amount: string | number): Promise<string>
```

Stakes FLM tokens.

- `fromAccount`: Account to sign the transaction
- `amount`: Amount to stake
- Returns: Transaction hash

##### unstakeFlamingo

```typescript
async unstakeFlamingo(fromAccount: any, amount: string | number): Promise<string>
```

Unstakes FLM tokens.

- `fromAccount`: Account to sign the transaction
- `amount`: Amount to unstake
- Returns: Transaction hash

##### getFlamingoBalance

```typescript
async getFlamingoBalance(address: string): Promise<any>
```

Gets FLM token balance.

- `address`: Account to check balance for
- Returns: Operation result

#### NeoCompound Methods

##### depositToNeoCompound

```typescript
async depositToNeoCompound(fromAccount: any, assetId: string, amount: string | number): Promise<string>
```

Deposits assets into NeoCompound.

- `fromAccount`: Account to sign the transaction
- `assetId`: Asset to deposit
- `amount`: Amount to deposit
- Returns: Transaction hash

##### withdrawFromNeoCompound

```typescript
async withdrawFromNeoCompound(fromAccount: any, assetId: string, amount: string | number): Promise<string>
```

Withdraws assets from NeoCompound.

- `fromAccount`: Account to sign the transaction
- `assetId`: Asset to withdraw
- `amount`: Amount to withdraw
- Returns: Transaction hash

##### getNeoCompoundBalance

```typescript
async getNeoCompoundBalance(address: string, assetId: string): Promise<any>
```

Gets balance of deposited assets.

- `address`: Account to check balance for
- `assetId`: Asset to check balance for
- Returns: Operation result

#### GrandShare Methods

##### depositToGrandShare

```typescript
async depositToGrandShare(fromAccount: any, poolId: number, amount: string | number): Promise<string>
```

Deposits assets into GrandShare pool.

- `fromAccount`: Account to sign the transaction
- `poolId`: ID of the pool to deposit into
- `amount`: Amount to deposit
- Returns: Transaction hash

##### withdrawFromGrandShare

```typescript
async withdrawFromGrandShare(fromAccount: any, poolId: number, amount: string | number): Promise<string>
```

Withdraws assets from GrandShare pool.

- `fromAccount`: Account to sign the transaction
- `poolId`: ID of the pool to withdraw from
- `amount`: Amount to withdraw
- Returns: Transaction hash

##### getGrandSharePoolDetails

```typescript
async getGrandSharePoolDetails(poolId: number): Promise<any>
```

Gets details about a pool.

- `poolId`: ID of the pool to query
- Returns: Operation result

#### GhostMarket Methods

##### createGhostMarketNFT

```typescript
async createGhostMarketNFT(fromAccount: any, tokenURI: string, properties: any[]): Promise<string>
```

Creates a new NFT.

- `fromAccount`: Account to sign the transaction
- `tokenURI`: URI for token metadata
- `properties`: NFT properties
- Returns: Transaction hash

##### listGhostMarketNFT

```typescript
async listGhostMarketNFT(fromAccount: any, tokenId: number, price: string | number, paymentToken: string): Promise<string>
```

Lists an NFT for sale.

- `fromAccount`: Account to sign the transaction
- `tokenId`: ID of the token to list
- `price`: Price of the token
- `paymentToken`: Token accepted as payment
- Returns: Transaction hash

##### buyGhostMarketNFT

```typescript
async buyGhostMarketNFT(fromAccount: any, tokenId: number): Promise<string>
```

Buys a listed NFT.

- `fromAccount`: Account to sign the transaction
- `tokenId`: ID of the token to buy
- Returns: Transaction hash

##### getGhostMarketTokenInfo

```typescript
async getGhostMarketTokenInfo(tokenId: number): Promise<any>
```

Gets information about an NFT.

- `tokenId`: ID of the token to query
- Returns: Operation result

## MCP Tools

The following MCP tools are available for interacting with the famous contracts:

### General Contract Tools

- `list_famous_contracts`: Lists all supported famous Neo N3 contracts
- `get_contract_info`: Gets detailed information about a specific contract

### NeoFS Tools

- `neofs_create_container`: Creates a NeoFS container
- `neofs_get_containers`: Gets NeoFS containers owned by an address

### NeoBurger Tools

- `neoburger_deposit`: Deposits NEO to NeoBurger
- `neoburger_withdraw`: Withdraws NEO from NeoBurger
- `neoburger_get_balance`: Gets NeoBurger balance
- `neoburger_claim_gas`: Claims GAS rewards from NeoBurger

### Flamingo Tools

- `flamingo_stake`: Stakes FLM tokens
- `flamingo_unstake`: Unstakes FLM tokens
- `flamingo_get_balance`: Gets Flamingo token balance

### NeoCompound Tools

- `neocompound_deposit`: Deposits assets into NeoCompound
- `neocompound_withdraw`: Withdraws assets from NeoCompound
- `neocompound_get_balance`: Gets NeoCompound asset balance

### GrandShare Tools

- `grandshare_deposit`: Deposits assets into GrandShare pool
- `grandshare_withdraw`: Withdraws assets from GrandShare pool
- `grandshare_get_pool_details`: Gets details about a GrandShare pool

### GhostMarket Tools

- `ghostmarket_create_nft`: Creates a new NFT on GhostMarket
- `ghostmarket_list_nft`: Lists an NFT for sale on GhostMarket
- `ghostmarket_buy_nft`: Buys a listed NFT on GhostMarket
- `ghostmarket_get_token_info`: Gets information about an NFT on GhostMarket

## Usage Examples

### Listing Famous Contracts

```javascript
const result = await callTool('list_famous_contracts', {
  network: 'mainnet'
});

console.log(result.contracts);
```

### Getting Contract Information

```javascript
const result = await callTool('get_contract_info', {
  network: 'mainnet',
  contractName: 'neoburger'
});

console.log(result.contractInfo);
```

### Depositing NEO to NeoBurger

```javascript
const result = await callTool('neoburger_deposit', {
  network: 'mainnet',
  walletPath: '/path/to/wallet.json',
  walletPassword: 'password'
});

console.log(`Transaction hash: ${result.txid}`);
```

### Getting NFT Information from GhostMarket

```javascript
const result = await callTool('ghostmarket_get_token_info', {
  network: 'mainnet',
  tokenId: 123
});

console.log(result.tokenInfo);
```

## Design Decisions

### Mainnet and Testnet Support

All contracts support mainnet, but only some have testnet implementations. The `ContractService` handles this by providing the `isContractAvailable` method to check availability before attempting operations.

### Error Handling

The `ContractService` provides robust error handling, with specific error messages for various failure scenarios, including:

- RPC connection failures
- Contract execution failures
- Invalid parameters
- Network unavailability

### Contract Validation

Contract script hashes are validated to ensure they conform to the expected format, reducing the risk of errors in blockchain interactions.

### Parameter Validation

Input parameters for contract operations are validated to ensure they meet the required format and constraints, providing early error detection and improving security.

## Error Handling and Best Practices

### Error Types

The contract service uses specific error types to provide clear information about failures:

- **ContractError**: Thrown when a contract operation fails (e.g., execution error, invalid operation)
- **ValidationError**: Thrown when input validation fails (e.g., invalid address format, negative amount)
- **NetworkError**: Thrown when there are network-related issues (e.g., RPC connection failure)

### Best Practices

1. **Always Check Contract Availability**: Use `isContractAvailable` or `list_famous_contracts` to check if a contract is available on your target network before attempting to interact with it.

2. **Handle Rate Limits**: The service implements rate limiting to prevent abuse. Handle potential rate limit errors in your application.

3. **Validate Inputs Client-Side**: While the service performs server-side validation, implementing client-side validation can improve user experience by catching errors earlier.

4. **Monitor Transaction Status**: After invoking a write operation, monitor the transaction status to confirm it was successfully processed on the blockchain.

5. **Use Testnet First**: When developing new integrations, test on the testnet first before moving to mainnet.

### Example Error Handling

```javascript
try {
  const result = await callTool('neoburger_deposit', {
    walletPath: '/path/to/wallet.json',
    walletPassword: 'password',
    network: 'mainnet'
  });
  console.log('Deposit successful:', result);
} catch (error) {
  if (error.message.includes('Contract not available')) {
    console.error('NeoBurger contract is not available on this network');
  } else if (error.message.includes('Rate limit')) {
    console.error('Rate limit exceeded. Please try again later.');
  } else {
    console.error('Operation failed:', error.message);
  }
}
```

## Test Coverage

The contract implementation is covered by comprehensive tests:

- `contract-validation.test.ts`: Tests contract definitions and validation
- `contract-operations.test.ts`: Tests contract operations and error handling
- `contract-service.test.ts`: Tests the core contract service functionality

These tests ensure that all contract operations function correctly and handle edge cases properly.