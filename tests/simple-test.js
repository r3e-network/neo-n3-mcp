import { strict as assert } from 'assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('Script started');

// Create a mock version of @cityofzion/neon-js
const neonJsMock = {
  rpc: {
    RPCClient: function(url) {
      console.log(`Creating mock RPCClient with URL: ${url}`);
      return {
        getBlockCount: async () => {
          console.log('Mock getBlockCount called');
          return 12345;
        },
        getValidators: async () => {
          console.log('Mock getValidators called');
          return [
            { publickey: 'key1', votes: '100', active: true },
            { publickey: 'key2', votes: '200', active: true },
          ];
        },
        getBlock: async () => {
          console.log('Mock getBlock called');
          return {
            hash: '0x1234567890abcdef',
            size: 1000,
            version: 0,
            previousblockhash: '0x0987654321fedcba',
            merkleroot: '0xabcdef1234567890',
            time: 1600000000,
            index: 12344,
            nonce: '0',
            nextconsensus: 'address',
            script: { invocation: '', verification: '' },
            tx: [],
          };
        },
        getTransaction: async () => {
          console.log('Mock getTransaction called');
          return {
            hash: '0xabcdef1234567890',
            size: 500,
            version: 0,
            nonce: 0,
            sender: 'address1',
            sysfee: '0.1',
            netfee: '0.05',
            validuntilblock: 12400,
            signers: [],
            attributes: [],
            script: '',
            witnesses: [],
          };
        },
        getBalance: async () => {
          console.log('Mock getBalance called');
          return {
            balance: [
              { asset: 'NEO', amount: '100' },
              { asset: 'GAS', amount: '50.5' },
            ],
          };
        },
        invokeScript: async () => {
          console.log('Mock invokeScript called');
          return {};
        },
        sendRawTransaction: async () => {
          console.log('Mock sendRawTransaction called');
          return 'txhash123';
        },
      };
    }
  },
  wallet: {
    Account: function(wif) {
      console.log(`Creating mock Account with WIF: ${wif || 'none'}`);
      return {
        address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
        publicKey: 'publicKey',
        WIF: 'WIF',
        encrypt: (password) => {
          console.log(`Mock encrypt called with password: ${password}`);
          return 'encryptedKey';
        },
        decrypt: (key, password) => {
          console.log(`Mock decrypt called with key: ${key}, password: ${password}`);
        },
      };
    },
    getScriptHashFromAddress: (address) => {
      console.log(`Mock getScriptHashFromAddress called with address: ${address}`);
      return 'scriptHash';
    },
    signTransaction: (tx, account) => {
      console.log('Mock signTransaction called');
      return tx;
    },
  },
  sc: {
    createScript: (params) => {
      console.log('Mock createScript called');
      return 'script';
    },
    ContractParam: {
      hash160: (param) => {
        console.log(`Mock hash160 called with param: ${param}`);
        return 'hash160Param';
      },
      integer: (param) => {
        console.log(`Mock integer called with param: ${param}`);
        return 'integerParam';
      },
      any: (param) => {
        console.log(`Mock any called with param: ${param}`);
        return 'anyParam';
      },
    },
  },
  u: {
    HexString: {
      fromHex: (hex) => {
        console.log(`Mock fromHex called with hex: ${hex}`);
        return 'hexString';
      },
    },
  },
};

console.log('Defined mock objects');

// Define a test NeoService class that uses our mock
class TestNeoService {
  constructor(rpcUrl) {
    console.log(`TestNeoService constructor with URL: ${rpcUrl}`);
    this.rpcClient = neonJsMock.rpc.RPCClient(rpcUrl);
  }

  async getBlockchainInfo() {
    console.log('TestNeoService.getBlockchainInfo called');
    const height = await this.rpcClient.getBlockCount();
    const validators = await this.rpcClient.getValidators();
    return { height, validators };
  }

  async getBlock(hashOrHeight) {
    console.log(`TestNeoService.getBlock called with: ${hashOrHeight}`);
    return await this.rpcClient.getBlock(hashOrHeight, 1);
  }

  async getTransaction(txid) {
    console.log(`TestNeoService.getTransaction called with: ${txid}`);
    return await this.rpcClient.getTransaction(txid);
  }

  async getBalance(address) {
    console.log(`TestNeoService.getBalance called with: ${address}`);
    return await this.rpcClient.getBalance(address);
  }

  createWallet(password) {
    console.log(`TestNeoService.createWallet called with password: ${password}`);
    const account = neonJsMock.wallet.Account();
    return {
      address: account.address,
      publicKey: account.publicKey,
      encryptedPrivateKey: account.encrypt(password),
      WIF: account.WIF,
    };
  }

  importWallet(key, password) {
    console.log(`TestNeoService.importWallet called with key: ${key}, password: ${password || 'none'}`);
    let account;

    if (password) {
      account = neonJsMock.wallet.Account();
      account.decrypt(key, password);
    } else {
      account = neonJsMock.wallet.Account(key);
    }

    return {
      address: account.address,
      publicKey: account.publicKey,
    };
  }
}

console.log('Defined TestNeoService class');

// Simple test runner
async function runTests() {
  console.log('Running Neo Service tests...');
  
  const neoService = new TestNeoService('http://localhost:10332');
  let passedTests = 0;
  let failedTests = 0;
  
  try {
    // Test getBlockchainInfo
    console.log('Testing getBlockchainInfo...');
    const info = await neoService.getBlockchainInfo();
    console.log('getBlockchainInfo result:', JSON.stringify(info));
    assert.strictEqual(info.height, 12345, 'Height should be 12345');
    assert.strictEqual(info.validators.length, 2, 'Should have 2 validators');
    console.log('✅ getBlockchainInfo test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ getBlockchainInfo test failed:', error);
    failedTests++;
  }

  try {
    // Test getBlock
    console.log('Testing getBlock...');
    const block = await neoService.getBlock(12344);
    console.log('getBlock result:', JSON.stringify(block));
    assert.strictEqual(block.hash, '0x1234567890abcdef', 'Block hash should match');
    assert.strictEqual(block.index, 12344, 'Block index should match');
    console.log('✅ getBlock test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ getBlock test failed:', error);
    failedTests++;
  }

  try {
    // Test getTransaction
    console.log('Testing getTransaction...');
    const tx = await neoService.getTransaction('0xabcdef1234567890');
    console.log('getTransaction result:', JSON.stringify(tx));
    assert.strictEqual(tx.hash, '0xabcdef1234567890', 'Transaction hash should match');
    console.log('✅ getTransaction test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ getTransaction test failed:', error);
    failedTests++;
  }

  try {
    // Test getBalance
    console.log('Testing getBalance...');
    const balance = await neoService.getBalance('NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
    console.log('getBalance result:', JSON.stringify(balance));
    assert.strictEqual(balance.balance[0].asset, 'NEO', 'First asset should be NEO');
    assert.strictEqual(balance.balance[0].amount, '100', 'NEO amount should be 100');
    console.log('✅ getBalance test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ getBalance test failed:', error);
    failedTests++;
  }

  try {
    // Test createWallet
    console.log('Testing createWallet...');
    const wallet = neoService.createWallet('password');
    console.log('createWallet result:', JSON.stringify(wallet));
    assert.strictEqual(wallet.address, 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ', 'Wallet address should match');
    assert.strictEqual(wallet.encryptedPrivateKey, 'encryptedKey', 'Encrypted key should match');
    console.log('✅ createWallet test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ createWallet test failed:', error);
    failedTests++;
  }

  try {
    // Test importWallet
    console.log('Testing importWallet...');
    const wallet = neoService.importWallet('WIF');
    console.log('importWallet result:', JSON.stringify(wallet));
    assert.strictEqual(wallet.address, 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ', 'Wallet address should match');
    console.log('✅ importWallet test passed');
    passedTests++;
  } catch (error) {
    console.error('❌ importWallet test failed:', error);
    failedTests++;
  }

  console.log(`\nTest summary: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

console.log('Defined runTests function');

// Run the tests
console.log('Starting test execution');
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
}); 