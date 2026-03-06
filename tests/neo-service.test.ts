import { jest } from '@jest/globals';
import { NeoService, NeoNetwork } from '../src/services/neo-service';

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
const mockSenderScriptHash = 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e';
const mockFlamingoScriptHash = 'f970f4ccecd765b63732b821775dc38c25d74b39';
const mockSenderAddress = 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr';
const mockFlamingoAddress = 'NdxiFLMContract1111111111111111111';

const mockApplicationLog = {
  txid: '0xabcdef1234567890',
  executions: [{
    vmstate: 'HALT',
    notifications: [{
      contract: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      eventname: 'Transfer',
      state: {
        type: 'Array',
        value: [
          { type: 'ByteString', value: Buffer.from(mockSenderScriptHash, 'hex').toString('base64') },
          { type: 'ByteString', value: Buffer.from(mockFlamingoScriptHash, 'hex').toString('base64') },
          { type: 'Integer', value: '42' }
        ]
      }
    }]
  }],
};
const mockNep17Transfers = {
  address: mockSenderAddress,
  sent: [
    {
      timestamp: 1710000000000,
      assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      transferaddress: mockFlamingoAddress,
      amount: '42',
      blockindex: 12345,
      transfernotifyindex: 0,
      txhash: '0x1111111111111111111111111111111111111111111111111111111111111111'
    }
  ],
  received: [
    {
      timestamp: 1710000001000,
      assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      transferaddress: mockFlamingoAddress,
      amount: '7',
      blockindex: 12346,
      transfernotifyindex: 1,
      txhash: '0x2222222222222222222222222222222222222222222222222222222222222222'
    }
  ]
};
const mockNep11AssetHash = '0x1234567890abcdef1234567890abcdef12345678';
const mockNep11Balances = {
  address: mockSenderAddress,
  balance: [
    {
      assethash: mockNep11AssetHash,
      amount: '2',
      lastupdatedblock: 23456,
      tokens: [
        { tokenid: 'nft-1', amount: '1', lastupdatedblock: 23455 },
        { tokenid: 'nft-2', amount: '1', lastupdatedblock: 23456 }
      ]
    }
  ]
};
const mockNep11Transfers = {
  address: mockSenderAddress,
  sent: [
    {
      timestamp: 1710000002000,
      assethash: mockNep11AssetHash,
      transferaddress: mockFlamingoAddress,
      amount: '1',
      tokenid: 'nft-1',
      blockindex: 12347,
      transfernotifyindex: 0,
      txhash: '0x3333333333333333333333333333333333333333333333333333333333333333'
    }
  ],
  received: [
    {
      timestamp: 1710000003000,
      assethash: mockNep11AssetHash,
      transferaddress: mockFlamingoAddress,
      amount: '1',
      tokenid: 'nft-2',
      blockindex: 12348,
      transfernotifyindex: 1,
      txhash: '0x4444444444444444444444444444444444444444444444444444444444444444'
    }
  ]
};
const mockUnclaimedGas = '123456789';
const mockTransactionHeight = 12346;
const mockTransactionId = 'txhash123';
var mockNetworkMagic = 894710606;
var mockNep17Transfer = jest.fn().mockResolvedValue(mockTransactionId);
var mockSmartContractInvoke = jest.fn().mockResolvedValue(mockTransactionId);
var mockClaimGas = jest.fn().mockResolvedValue(mockTransactionId);
var mockSmartCalculateNetworkFee = jest.fn().mockResolvedValue({ toString: () => '123456' });

jest.mock('@cityofzion/neon-js', () => {
  return {
    rpc: {
      Query: jest.fn().mockImplementation((q) => q),
      RPCClient: jest.fn().mockImplementation(() => ({
        getBlockCount: jest.fn().mockReturnValue(Promise.resolve(mockBlockCount)),
        getValidators: jest.fn().mockReturnValue(Promise.resolve(mockValidators)),
        getBlock: jest.fn().mockReturnValue(Promise.resolve(mockBlock)),
        getTransaction: jest.fn().mockReturnValue(Promise.resolve(mockTransaction)),
        getRawTransaction: jest.fn().mockReturnValue(Promise.resolve(mockTransaction)),
        getApplicationLog: jest.fn().mockReturnValue(Promise.resolve(mockApplicationLog)),
        getUnclaimedGas: jest.fn().mockReturnValue(Promise.resolve(mockUnclaimedGas)),
        getTransactionHeight: jest.fn().mockReturnValue(Promise.resolve(mockTransactionHeight)),
        getBalance: jest.fn().mockReturnValue(Promise.resolve(mockBalance)),
        getAccountState: jest.fn().mockReturnValue(Promise.resolve(mockAccountState)),
        invokeScript: jest.fn().mockReturnValue(Promise.resolve({ state: 'HALT', stack: [{ value: '100' }] })),
        invokeFunction: jest.fn().mockReturnValue(Promise.resolve({
          state: 'HALT',
          gasconsumed: '1000000',
          stack: [{ value: '100' }],
          validuntilblock: 12500,
        })),
        sendRawTransaction: jest.fn().mockReturnValue(Promise.resolve(mockTransactionId)),
        execute: jest.fn().mockImplementation((queryOrMethod, paramsArray) => {
          let method = queryOrMethod;
          if (typeof queryOrMethod === 'object' && queryOrMethod !== null) {
            method = queryOrMethod.req ? queryOrMethod.req.method : queryOrMethod.method;
          }
          if (method === 'getblockcount') return Promise.resolve(mockBlockCount);
          if (method === 'getvalidators') return Promise.resolve(mockValidators);
          if (method === 'getblock') return Promise.resolve(mockBlock);
          if (method === 'getrawtransaction') return Promise.resolve(mockTransaction);
          if (method === 'getaccountstate') return Promise.resolve(mockAccountState);
          if (method === 'getversion') return Promise.resolve({ protocol: { network: mockNetworkMagic } });
          if (method === 'getnep17balances') {
            return Promise.resolve({
              address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
              balance: [
                { assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', amount: '100', lastupdatedblock: 12345 },
                { assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '50.5', lastupdatedblock: 12345 },
              ],
            });
          }
          if (method === 'getnep17transfers') {
            return Promise.resolve(mockNep17Transfers);
          }
          if (method === 'getnep11balances') {
            return Promise.resolve(mockNep11Balances);
          }
          if (method === 'getnep11transfers') {
            return Promise.resolve(mockNep11Transfers);
          }
          if (method === 'invokescript') return Promise.resolve({ state: 'HALT', stack: [{ value: '100' }] });
          if (method === 'invokefunction') {
            return Promise.resolve({
              state: 'HALT',
              gasconsumed: '1000000',
              stack: [{ value: '100' }],
              validuntilblock: 12500,
            });
          }
          if (method === 'sendrawtransaction') return Promise.resolve(mockTransactionId);
          return Promise.resolve(null);
        }),
      })),
    },
    wallet: {
      Account: jest.fn().mockImplementation(() => ({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'publicKey',
        WIF: 'WIF',
        scriptHash: 'f81a9a9ebf8cc9ae7f9ac3491f5a9f3b282b5e9e',
        contract: { script: 'EQ==' },
        encrypt: jest.fn().mockReturnValue('encryptedKey'),
        decrypt: jest.fn(),
      })),
      getScriptHashFromAddress: jest.fn().mockImplementation((address) => {
        if (address === mockSenderAddress) return mockSenderScriptHash;
        if (address === mockFlamingoAddress) return mockFlamingoScriptHash;
        return mockSenderScriptHash;
      }),
      getAddressFromScriptHash: jest.fn().mockImplementation((scriptHash) => {
        const normalized = String(scriptHash).replace(/^0x/, '').toLowerCase();
        if (normalized === mockSenderScriptHash) return mockSenderAddress;
        if (normalized === mockFlamingoScriptHash) return mockFlamingoAddress;
        return `addr-${normalized}`;
      }),
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
        fromBase64: jest.fn().mockReturnValue({ toString: () => 'verificationScript' }),
      },
    },
    tx: {
      Transaction: jest.fn().mockImplementation(() => ({
        addSigner: jest.fn(),
        addWitness: jest.fn(),
        signers: [],
        witnesses: [],
        sign: jest.fn().mockReturnValue(true),
        serialize: jest.fn().mockReturnValue('serializedTransaction'),
      })),
      Witness: jest.fn().mockImplementation((input) => input),
      WitnessScope: {
        CalledByEntry: 'CalledByEntry',
        Global: 'Global',
        None: 'None',
      },
    },
    experimental: {
      SmartContract: jest.fn().mockImplementation(() => ({
        invoke: mockSmartContractInvoke,
      })),
      txHelpers: {
        getSystemFee: jest.fn().mockResolvedValue({ toString: () => '1000000' }),
      },
      nep17: {
        Nep17Contract: jest.fn().mockImplementation(() => ({
          transfer: mockNep17Transfer,
        })),
        NEOContract: jest.fn().mockImplementation(() => ({
          claimGas: mockClaimGas,
        })),
      },
    },
    api: {
      smartCalculateNetworkFee: mockSmartCalculateNetworkFee,
    },
  };
});

describe('NeoService', () => {
  let neoService: NeoService;

  beforeEach(() => {
    jest.clearAllMocks();
    neoService = new NeoService('http://localhost:10332', NeoNetwork.MAINNET);
  });

  test('getBlockchainInfo returns height and validators', async () => {
    const info = await neoService.getBlockchainInfo();
    expect(info).toHaveProperty('height', mockBlockCount);
    expect(info).toHaveProperty('validators');
    expect(info.validators).toHaveLength(2);
    expect(info).toHaveProperty('network', NeoNetwork.MAINNET);
  });

  test('getBlockchainInfo throws on unrecoverable rpc failure', async () => {
    const mockRpcClient = (neoService as any).rpcClient;
    mockRpcClient.getBlockCount = jest.fn().mockRejectedValue(new Error('RPC Error'));

    await expect(neoService.getBlockchainInfo()).rejects.toThrow('Failed to get blockchain info');
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
    const balance = await neoService.getBalance('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    expect(balance).toHaveProperty('balance');
    expect(balance.balance).toHaveLength(2);
    expect(balance.balance[0]).toHaveProperty('asset_name', 'NEO');
    expect(balance.balance[0]).toHaveProperty('amount');
  });



test('getApplicationLog enriches known transfer recipients with name and logo metadata', async () => {
  const applicationLog = await neoService.getApplicationLog('0xabcdef1234567890');
  const notification = applicationLog.executions[0].notifications[0];

  expect(notification.parsed).toMatchObject({
    type: 'nep17_transfer',
    amount: '42',
    asset: expect.objectContaining({
      symbol: 'GAS',
      scriptHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
    }),
    to: expect.objectContaining({
      address: mockFlamingoAddress,
      scriptHash: `0x${mockFlamingoScriptHash}`,
      knownAccount: expect.objectContaining({
        name: 'Flamingo',
      }),
    }),
  });

  expect(notification.parsed.to.knownAccount.logo).toContain('data:image/svg+xml');
  expect(notification.parsed.to).toMatchObject({
    name: 'Flamingo',
  });
  expect(notification.parsed.to.logo).toContain('data:image/svg+xml');
});

test('getUnclaimedGas returns the address and amount', async () => {
  const result = await neoService.getUnclaimedGas('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
  expect(result).toEqual({
    address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
    unclaimedGas: mockUnclaimedGas,
  });
});

test('getNep17Transfers enriches sent and received transfers with known-account metadata', async () => {
  const result = await (neoService as any).getNep17Transfers(mockSenderAddress, {
    fromTimestampMs: 0,
    toTimestampMs: 1710000001000,
  });

  expect(result).toMatchObject({
    address: mockSenderAddress,
    sent: [
      expect.objectContaining({
        assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
        transferaddress: mockFlamingoAddress,
        direction: 'sent',
        timestampIso: new Date(1710000000000).toISOString(),
        asset: expect.objectContaining({
          symbol: 'GAS',
          name: 'GasToken',
        }),
        to: expect.objectContaining({
          address: mockFlamingoAddress,
          name: 'Flamingo',
        }),
        counterparty: expect.objectContaining({
          address: mockFlamingoAddress,
          name: 'Flamingo',
        }),
      }),
    ],
    received: [
      expect.objectContaining({
        assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        transferaddress: mockFlamingoAddress,
        direction: 'received',
        timestampIso: new Date(1710000001000).toISOString(),
        asset: expect.objectContaining({
          symbol: 'NEO',
          name: 'NeoToken',
        }),
        from: expect.objectContaining({
          address: mockFlamingoAddress,
          name: 'Flamingo',
        }),
        to: expect.objectContaining({
          address: mockSenderAddress,
          displayName: mockSenderAddress,
        }),
      }),
    ],
  });
});

test('getNep11Balances enriches balance entries with additive asset metadata', async () => {
  const result = await (neoService as any).getNep11Balances(mockSenderAddress);

  expect(result).toMatchObject({
    address: mockSenderAddress,
    balance: [
      expect.objectContaining({
        assethash: mockNep11AssetHash,
        amount: '2',
        tokens: [
          expect.objectContaining({ tokenid: 'nft-1' }),
          expect.objectContaining({ tokenid: 'nft-2' }),
        ],
        asset: expect.objectContaining({
          scriptHash: mockNep11AssetHash,
          name: mockNep11AssetHash,
        }),
      }),
    ],
  });
});

test('getNep11Transfers enriches sent and received NFT transfers with party metadata', async () => {
  const result = await (neoService as any).getNep11Transfers(mockSenderAddress, {
    fromTimestampMs: 0,
    toTimestampMs: 1710000003000,
  });

  expect(result).toMatchObject({
    address: mockSenderAddress,
    sent: [
      expect.objectContaining({
        assethash: mockNep11AssetHash,
        tokenid: 'nft-1',
        direction: 'sent',
        timestampIso: new Date(1710000002000).toISOString(),
        to: expect.objectContaining({
          address: mockFlamingoAddress,
          name: 'Flamingo',
        }),
      }),
    ],
    received: [
      expect.objectContaining({
        assethash: mockNep11AssetHash,
        tokenid: 'nft-2',
        direction: 'received',
        timestampIso: new Date(1710000003000).toISOString(),
        from: expect.objectContaining({
          address: mockFlamingoAddress,
          name: 'Flamingo',
        }),
        to: expect.objectContaining({
          address: mockSenderAddress,
          displayName: mockSenderAddress,
        }),
      }),
    ],
  });
});

test('waitForTransaction returns confirmed transaction details and application log', async () => {
  const result = await neoService.waitForTransaction('0xabcdef1234567890', {
    timeoutMs: 10,
    pollIntervalMs: 1,
    includeApplicationLog: true,
  });

  expect(result).toMatchObject({
    txid: '0xabcdef1234567890',
    confirmed: true,
    blockHeight: mockTransactionHeight,
    transaction: mockTransaction,
    applicationLog: expect.objectContaining({
      txid: '0xabcdef1234567890',
      executions: expect.arrayContaining([
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              parsed: expect.objectContaining({
                to: expect.objectContaining({
                  knownAccount: expect.objectContaining({
                    name: 'Flamingo',
                  }),
                }),
              }),
            }),
          ]),
        }),
      ]),
    }),
  });
});

  test('transferAssets uses the NEP-17 SDK helper with fetched network magic', async () => {
    const account = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };
    const result = await neoService.transferAssets(
      account,
      'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
      'NEO',
      '1'
    );

    expect(result).toHaveProperty('txid', mockTransactionId);

    const neonJs = require('@cityofzion/neon-js');
    expect(neonJs.experimental.nep17.Nep17Contract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rpcAddress: 'http://localhost:10332',
        networkMagic: mockNetworkMagic,
        account,
      })
    );
  });

  test('invokeContract uses the smart contract SDK helper with fetched network magic', async () => {
    const account = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };
    const result = await neoService.invokeContract(
      account,
      '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
      'transfer',
      []
    );

    expect(result).toHaveProperty('txid', mockTransactionId);

    const neonJs = require('@cityofzion/neon-js');
    expect(neonJs.experimental.SmartContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rpcAddress: 'http://localhost:10332',
        networkMagic: mockNetworkMagic,
        account,
      })
    );
  });

  test('claimGas uses the NEO native contract helper', async () => {
    const account = { address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };
    const result = await neoService.claimGas(account);

    expect(result).toHaveProperty('txid', mockTransactionId);
    expect(mockClaimGas).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
  });

  test('createWallet returns wallet information without raw WIF leakage', () => {
    const wallet = neoService.createWallet('password');
    expect(wallet).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    expect(wallet).toHaveProperty('publicKey', 'publicKey');
    expect(wallet).toHaveProperty('encryptedPrivateKey', 'encryptedKey');
    expect(wallet).not.toHaveProperty('WIF');
  });

  test('importWallet returns wallet information', () => {
    const wallet = neoService.importWallet('WIF');
    expect(wallet).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    expect(wallet).toHaveProperty('publicKey', 'publicKey');
  });

  test('getNetwork returns the current network', () => {
    expect(neoService.getNetwork()).toBe(NeoNetwork.MAINNET);

    const testnetService = new NeoService('http://localhost:10332', NeoNetwork.TESTNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });
});
