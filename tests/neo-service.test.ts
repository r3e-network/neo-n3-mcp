import { jest } from '@jest/globals';
import { NeoService } from '../src/services/neo-service';

// Mock the neon-js library
jest.mock('@cityofzion/neon-js', () => ({
  rpc: {
    RPCClient: jest.fn().mockImplementation(() => ({
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getValidators: jest.fn().mockResolvedValue([
        { publickey: 'key1', votes: '100', active: true },
        { publickey: 'key2', votes: '200', active: true },
      ]),
      getBlock: jest.fn().mockResolvedValue({
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
      getTransaction: jest.fn().mockResolvedValue({
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
      getBalance: jest.fn().mockResolvedValue({
        balance: [
          { asset: 'NEO', amount: '100' },
          { asset: 'GAS', amount: '50.5' },
        ],
      }),
      invokeScript: jest.fn().mockResolvedValue({}),
      sendRawTransaction: jest.fn().mockResolvedValue('txhash123'),
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
    signTransaction: jest.fn().mockImplementation((tx) => tx),
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
}));

describe('NeoService', () => {
  let neoService: NeoService;

  beforeEach(() => {
    neoService = new NeoService('http://localhost:10332');
  });

  test('getBlockchainInfo returns height and validators', async () => {
    const info = await neoService.getBlockchainInfo();
    expect(info).toHaveProperty('height', 12345);
    expect(info).toHaveProperty('validators');
    expect(info.validators).toHaveLength(2);
  });

  test('getBlock returns block details', async () => {
    const block = await neoService.getBlock(12344);
    expect(block).toHaveProperty('hash', '0x1234567890abcdef');
    expect(block).toHaveProperty('index', 12344);
  });

  test('getTransaction returns transaction details', async () => {
    const tx = await neoService.getTransaction('0xabcdef1234567890');
    expect(tx).toHaveProperty('hash', '0xabcdef1234567890');
    expect(tx).toHaveProperty('sysfee', '0.1');
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
    expect(result).toHaveProperty('txid', 'txhash123');
  });
  
  test('invokeContract calls the right methods', async () => {
    const account = { address: 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ' };
    const result = await neoService.invokeContract(
      account,
      '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      'transfer',
      []
    );
    expect(result).toHaveProperty('txid', 'txhash123');
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
});
