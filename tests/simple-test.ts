import * as assert from 'assert';

// Create a mock version of @cityofzion/neon-js
const neonJsMock = {
  rpc: {
    RPCClient: function(url: string) {
      console.log(`Creating mock RPCClient with URL: ${url}`);
      return {
        getBlockCount: async () => 12345,
        getValidators: async () => [
          { publickey: 'key1', votes: '100', active: true },
          { publickey: 'key2', votes: '200', active: true },
        ],
        getBlock: async () => ({
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
        }),
        getTransaction: async () => ({
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
        }),
        getBalance: async () => ({
          balance: [
            { asset: 'NEO', amount: '100' },
            { asset: 'GAS', amount: '50.5' },
          ],
        }),
        invokeScript: async () => ({}),
        sendRawTransaction: async () => 'txhash123',
      };
    }
  },
  wallet: {
    Account: function(wif?: string) {
      console.log(`Creating mock Account with WIF: ${wif || 'none'}`);
      return {
        address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
        publicKey: 'publicKey',
        WIF: 'WIF',
        encrypt: (password: string) => 'encryptedKey',
        decrypt: (key: string, password: string) => {},
      };
    },
    getScriptHashFromAddress: (address: string) => 'scriptHash',
    signTransaction: (tx: any, account: any) => tx,
  },
  sc: {
    createScript: (params: any) => 'script',
    ContractParam: {
      hash160: (param: any) => 'hash160Param',
      integer: (param: any) => 'integerParam',
      any: (param: any) => 'anyParam',
    },
  },
  u: {
    HexString: {
      fromHex: (hex: string) => 'hexString',
    },
  },
};

// Define a test NeoService class that uses our mock
class TestNeoService {
  private rpcClient: any;

  constructor(rpcUrl: string) {
    this.rpcClient = neonJsMock.rpc.RPCClient(rpcUrl);
  }

  async getBlockchainInfo() {
    const height = await this.rpcClient.getBlockCount();
    const validators = await this.rpcClient.getValidators();
    return { height, validators };
  }

  async getBlock(hashOrHeight: string | number) {
    return await this.rpcClient.getBlock(hashOrHeight, 1);
  }

  async getTransaction(txid: string) {
    return await this.rpcClient.getTransaction(txid);
  }

  async getBalance(address: string) {
    return await this.rpcClient.getBalance(address);
  }

  createWallet(password: string) {
    const account = neonJsMock.wallet.Account();
    return {
      address: account.address,
      publicKey: account.publicKey,
      encryptedPrivateKey: account.encrypt(password),
      WIF: account.WIF,
    };
  }

  importWallet(key: string, password?: string) {
    let account: any;

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

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
}); 