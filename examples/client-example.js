/**
 * Example client for the Neo N3 MCP server
 * 
 * This script demonstrates how to use the Neo N3 MCP server from a client perspective.
 * It shows how to call the various tools and access the resources provided by the server.
 * Examples include both mainnet and testnet network options.
 */

// Example of calling the get_blockchain_info tool (mainnet by default)
const getBlockchainInfoExample = {
  name: 'get_blockchain_info',
  arguments: {}
};

// Example of calling the get_blockchain_info tool with explicit testnet
const getTestnetBlockchainInfoExample = {
  name: 'get_blockchain_info',
  arguments: {
    network: 'testnet'
  }
};

// Example of calling the get_block tool (mainnet by default)
const getBlockExample = {
  name: 'get_block',
  arguments: {
    hashOrHeight: 12345
  }
};

// Example of calling the get_block tool on testnet
const getTestnetBlockExample = {
  name: 'get_block',
  arguments: {
    hashOrHeight: 12345,
    network: 'testnet'
  }
};

// Example of calling the get_transaction tool on mainnet
const getTransactionExample = {
  name: 'get_transaction',
  arguments: {
    txid: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    network: 'mainnet'
  }
};

// Example of calling the get_balance tool on testnet
const getBalanceExample = {
  name: 'get_balance',
  arguments: {
    address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
    network: 'testnet'
  }
};

// Example of calling the create_wallet tool on mainnet
const createWalletExample = {
  name: 'create_wallet',
  arguments: {
    password: 'your-secure-password',
    network: 'mainnet'
  }
};

// Example of calling the import_wallet tool on testnet
const importWalletExample = {
  name: 'import_wallet',
  arguments: {
    key: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    password: 'your-secure-password',
    network: 'testnet'
  }
};

// Example of calling the transfer_assets tool on mainnet
const transferAssetsExample = {
  name: 'transfer_assets',
  arguments: {
    fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
    asset: 'NEO',
    amount: '1',
    confirm: true,
    network: 'mainnet'
  }
};

// Example of calling the invoke_contract tool on testnet
const invokeContractExample = {
  name: 'invoke_contract',
  arguments: {
    fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    scriptHash: '0x8c23f196d8a1bfd103a9dcb1f9ccf0c611377d3b', // Testnet NEO
    operation: 'transfer',
    args: [
      {
        type: 'Hash160',
        value: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ'
      },
      {
        type: 'Hash160',
        value: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ'
      },
      {
        type: 'Integer',
        value: '1'
      },
      {
        type: 'Any',
        value: null
      }
    ],
    confirm: true,
    network: 'testnet'
  }
};

// Example of accessing the Neo N3 Network Status resource (default network)
const networkStatusResource = 'neo://network/status';

// Example of accessing the Neo N3 Network Status for specific networks
const mainnetStatusResource = 'neo://mainnet/status';
const testnetStatusResource = 'neo://testnet/status';

// Example of accessing the Neo N3 Block by Height resource
const blockByHeightResource = 'neo://block/12345'; // Default network
const mainnetBlockResource = 'neo://mainnet/block/12345';
const testnetBlockResource = 'neo://testnet/block/12345';

// Example of accessing the Neo N3 Address Balance resource
const addressBalanceResource = 'neo://address/NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ/balance'; // Default network
const mainnetAddressResource = 'neo://mainnet/address/NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ/balance';
const testnetAddressResource = 'neo://testnet/address/NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ/balance';

// Print the examples
console.log('Neo N3 MCP Server Client Examples:');
console.log('\nTool Examples:');
console.log('get_blockchain_info (default network):', JSON.stringify(getBlockchainInfoExample, null, 2));
console.log('get_blockchain_info (testnet):', JSON.stringify(getTestnetBlockchainInfoExample, null, 2));
console.log('get_block (default network):', JSON.stringify(getBlockExample, null, 2));
console.log('get_block (testnet):', JSON.stringify(getTestnetBlockExample, null, 2));
console.log('get_transaction (mainnet):', JSON.stringify(getTransactionExample, null, 2));
console.log('get_balance (testnet):', JSON.stringify(getBalanceExample, null, 2));
console.log('create_wallet (mainnet):', JSON.stringify(createWalletExample, null, 2));
console.log('import_wallet (testnet):', JSON.stringify(importWalletExample, null, 2));
console.log('transfer_assets (mainnet):', JSON.stringify(transferAssetsExample, null, 2));
console.log('invoke_contract (testnet):', JSON.stringify(invokeContractExample, null, 2));

console.log('\nResource Examples:');
console.log('Neo N3 Network Status (default):', networkStatusResource);
console.log('Neo N3 Network Status (mainnet):', mainnetStatusResource);
console.log('Neo N3 Network Status (testnet):', testnetStatusResource);
console.log('Neo N3 Block by Height (default):', blockByHeightResource);
console.log('Neo N3 Block by Height (mainnet):', mainnetBlockResource);
console.log('Neo N3 Block by Height (testnet):', testnetBlockResource);
console.log('Neo N3 Address Balance (default):', addressBalanceResource);
console.log('Neo N3 Address Balance (mainnet):', mainnetAddressResource);
console.log('Neo N3 Address Balance (testnet):', testnetAddressResource);
