import { jest } from '@jest/globals';
import { NeoService, NeoNetwork } from '../src/services/neo-service';

// Utility function to create typed mocks
function createMock<T>(value: T) {
  return jest.fn<() => Promise<T>>().mockResolvedValue(value);
}

// Define mock data
const mockBlockCount = 12345;
const mockValidators = [
  { publickey: 'key1', votes: '100', active: true },
  { publickey: 'key2', votes: '200', active: true },
];
const mockBlock = {
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
const mockTransaction = {
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
const mockAccountState = {
  balances: [
    { asset: 'NEO', amount: '100' },
    { asset: 'GAS', amount: '50.5' },
  ],
};
const mockBalance = {
  balance: [
    { asset: 'NEO', amount: '100' },
    { asset: 'GAS', amount: '50.5' },
  ],
};
const mockTransactionId = 'txhash123';

// Mock the neon-js library
jest.mock('@cityofzion/neon-js', () => {
  return {
    rpc: {
      RPCClient: jest.fn().mockImplementation(() => ({
        getBlockCount: jest.fn().mockReturnValue(Promise.resolve(mockBlockCount)),
        getValidators: jest.fn().mockReturnValue(Promise.resolve(mockValidators)),
        getBlock: jest.fn().mockReturnValue(Promise.resolve(mockBlock)),
        getTransaction: jest.fn().mockReturnValue(Promise.resolve(mockTransaction)),
        getBalance: jest.fn().mockReturnValue(Promise.resolve(mockBalance)),
        getAccountState: jest.fn().mockReturnValue(Promise.resolve(mockAccountState)),
        invokeScript: jest.fn().mockReturnValue(Promise.resolve({})),
        sendRawTransaction: jest.fn().mockReturnValue(Promise.resolve(mockTransactionId)),
        execute: jest.fn().mockImplementation((method, params) => {
          if (method === 'getblockcount') return Promise.resolve(mockBlockCount);
          if (method === 'getvalidators') return Promise.resolve(mockValidators);
          if (method === 'getblock') return Promise.resolve(mockBlock);
          if (method === 'getrawtransaction') return Promise.resolve(mockTransaction);
          if (method === 'getaccountstate') return Promise.resolve(mockAccountState);
          if (method === 'invokescript') return Promise.resolve({});
          if (method === 'sendrawtransaction') return Promise.resolve(mockTransactionId);
          return Promise.resolve(null);
        })
      })),
    },
    wallet: {
      Account: jest.fn().mockImplementation(() => ({
        address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
        publicKey: 'publicKey',
        WIF: 'WIF',
        encrypt: jest.fn().mockReturnValue('encryptedKey'),
        decrypt: jest.fn(),
      })),
      getScriptHashFromAddress: jest.fn().mockReturnValue('scriptHash'),
    },
    sc: {
      createScript: jest.fn().mockReturnValue('script'),
      ContractParam: {
        hash160: jest.fn().mockReturnValue('hash160Param'),
        integer: jest.fn().mockReturnValue('integerParam'),
        any: jest.fn().mockReturnValue('anyParam'),
      },
    },
    u: {
      HexString: {
        fromHex: jest.fn().mockReturnValue('hexString'),
      },
    },
    tx: {
      Transaction: jest.fn().mockImplementation(() => {
        return {
          sign: jest.fn().mockReturnValue(true),
          serialize: jest.fn().mockReturnValue('serializedTransaction')
        };
      })
    }
  };
});

describe('NeoService', () => {
  let neoService: NeoService;

  beforeEach(() => {
    neoService = new NeoService('http://localhost:10332', NeoNetwork.MAINNET);
  });

  test('getBlockchainInfo returns height and validators', async () => {
    const info = await neoService.getBlockchainInfo();
    expect(info).toHaveProperty('height', mockBlockCount);
    expect(info).toHaveProperty('validators');
    expect(info.validators).toHaveLength(2);
    expect(info).toHaveProperty('network', NeoNetwork.MAINNET);
  });

  test('getBlock returns block details', async () => {
    const block = await neoService.getBlock(12344);
    expect(block).toHaveProperty('hash', mockBlock.hash);
    expect(block).toHaveProperty('index', mockBlock.index);
  });

  test('getTransaction returns transaction details', async () => {
    const tx = await neoService.getTransaction('0xabcdef1234567890');
    expect(tx).toHaveProperty('hash', mockTransaction.hash);
    expect(tx).toHaveProperty('sysfee', mockTransaction.sysfee);
  });

  test('getBalance returns balance for address', async () => {
    const balance = await neoService.getBalance('NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
    expect(balance).toHaveProperty('balance');
    expect(balance.balance).toHaveLength(2);
    expect(balance.balance[0]).toHaveProperty('asset', 'NEO');
    expect(balance.balance[0]).toHaveProperty('amount', '100');
  });
  
  test('transferAssets calls the right methods', async () => {
    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };
    const result = await neoService.transferAssets(
      account,
      'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ',
      'NEO',
      '1'
    );
    expect(result).toHaveProperty('txid', mockTransactionId);
  });
  
  test('invokeContract calls the right methods', async () => {
    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };
    const result = await neoService.invokeContract(
      account,
      '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      'transfer',
      []
    );
    expect(result).toHaveProperty('txid', mockTransactionId);
  });

  test('createWallet returns wallet information', () => {
    const wallet = neoService.createWallet('password');
    expect(wallet).toHaveProperty('address', 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
    expect(wallet).toHaveProperty('publicKey', 'publicKey');
    expect(wallet).toHaveProperty('encryptedPrivateKey', 'encryptedKey');
    expect(wallet).toHaveProperty('WIF', 'WIF');
  });

  test('importWallet returns wallet information', () => {
    const wallet = neoService.importWallet('WIF');
    expect(wallet).toHaveProperty('address', 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ');
    expect(wallet).toHaveProperty('publicKey', 'publicKey');
  });
  
  test('getNetwork returns the current network', () => {
    expect(neoService.getNetwork()).toBe(NeoNetwork.MAINNET);
    
    const testnetService = new NeoService('http://localhost:10332', NeoNetwork.TESTNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });
});
