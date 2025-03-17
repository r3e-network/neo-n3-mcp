/**
 * Example client for the Neo N3 MCP server
 * 
 * This script demonstrates how to use the Neo N3 MCP server from a client perspective.
 * It shows how to call the various tools and access the resources provided by the server.
 */

// Example of calling the get_blockchain_info tool
const getBlockchainInfoExample = {
  name: 'get_blockchain_info',
  arguments: {}
};

// Example of calling the get_block tool
const getBlockExample = {
  name: 'get_block',
  arguments: {
    hashOrHeight: 12345
  }
};

// Example of calling the get_transaction tool
const getTransactionExample = {
  name: 'get_transaction',
  arguments: {
    txid: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  }
};

// Example of calling the get_balance tool
const getBalanceExample = {
  name: 'get_balance',
  arguments: {
    address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ'
  }
};

// Example of calling the create_wallet tool
const createWalletExample = {
  name: 'create_wallet',
  arguments: {
    password: 'your-secure-password'
  }
};

// Example of calling the import_wallet tool
const importWalletExample = {
  name: 'import_wallet',
  arguments: {
    key: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    password: 'your-secure-password'
  }
};

// Example of calling the transfer_assets tool
const transferAssetsExample = {
  name: 'transfer_assets',
  arguments: {
    fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    toAddress: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
    asset: 'NEO',
    amount: '1',
    confirm: true
  }
};

// Example of calling the invoke_contract tool
const invokeContractExample = {
  name: 'invoke_contract',
  arguments: {
    fromWIF: 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn',
    scriptHash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
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
    confirm: true
  }
};

// Example of accessing the Neo N3 Network Status resource
const networkStatusResource = 'neo://network/status';

// Example of accessing the Neo N3 Block by Height resource
const blockByHeightResource = 'neo://block/12345';

// Example of accessing the Neo N3 Address Balance resource
const addressBalanceResource = 'neo://address/NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ/balance';

// Print the examples
console.log('Neo N3 MCP Server Client Examples:');
console.log('\nTool Examples:');
console.log('get_blockchain_info:', JSON.stringify(getBlockchainInfoExample, null, 2));
console.log('get_block:', JSON.stringify(getBlockExample, null, 2));
console.log('get_transaction:', JSON.stringify(getTransactionExample, null, 2));
console.log('get_balance:', JSON.stringify(getBalanceExample, null, 2));
console.log('create_wallet:', JSON.stringify(createWalletExample, null, 2));
console.log('import_wallet:', JSON.stringify(importWalletExample, null, 2));
console.log('transfer_assets:', JSON.stringify(transferAssetsExample, null, 2));
console.log('invoke_contract:', JSON.stringify(invokeContractExample, null, 2));

console.log('\nResource Examples:');
console.log('Neo N3 Network Status:', networkStatusResource);
console.log('Neo N3 Block by Height:', blockByHeightResource);
console.log('Neo N3 Address Balance:', addressBalanceResource);
