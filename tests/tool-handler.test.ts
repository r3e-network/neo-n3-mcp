/**
 * Comprehensive Unit Tests for Tool Handlers
 * Testing all MCP tool operations
 */

import { jest } from '@jest/globals';
import { callTool } from '../src/handlers/tool-handler';
import { NeoService, NeoNetwork } from '../src/services/neo-service';
import { ContractService } from '../src/contracts/contract-service';
import { ValidationError } from '../src/utils/errors';
import { config, NetworkMode } from '../src/config';
import { TEST_WIF } from './test-wallet';

// Mock data
const mockBlockchainInfo = {
  height: 12345,
  network: NeoNetwork.MAINNET,
  validators: []
};

const mockBalance = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  balance: [
    { asset_name: 'NEO', asset_hash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', amount: '100' },
    { asset_name: 'GAS', asset_hash: '0xd2a4cff31913016155e38e474a2c06d08be276cf', amount: '50.5' }
  ]
};

const mockTransferResult = { txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' };
const mockKnownRecipientScriptHash = '0xf970f4ccecd765b63732b821775dc38c25d74b39';
const mockKnownRecipientAddress = 'NdxiFLMContract1111111111111111111';
const mockApplicationLog = {
  txid: mockTransferResult.txid,
  executions: [{
    vmstate: 'HALT',
    notifications: [{
      contract: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      eventname: 'Transfer',
      parsed: {
        type: 'nep17_transfer',
        amount: '42',
        asset: {
          symbol: 'GAS',
          name: 'GasToken',
          scriptHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
          logo: 'data:image/svg+xml;utf8,mock-gas-logo',
        },
        to: {
          address: mockKnownRecipientAddress,
          scriptHash: mockKnownRecipientScriptHash,
          displayName: 'Flamingo',
          name: 'Flamingo',
          kind: 'contract',
          logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
          knownAccount: {
            id: 'flamingo',
            name: 'Flamingo',
            kind: 'contract',
            scriptHash: mockKnownRecipientScriptHash,
            address: mockKnownRecipientAddress,
            logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
          },
        },
      },
    }],
  }],
};
const mockNep17Transfers = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  sent: [
    {
      txhash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      transferaddress: mockKnownRecipientAddress,
      amount: '42',
      timestamp: 1710000000000,
      direction: 'sent',
      timestampIso: new Date(1710000000000).toISOString(),
      to: {
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
        logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
      },
      asset: {
        symbol: 'GAS',
        name: 'GasToken',
        scriptHash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
        logo: 'data:image/svg+xml;utf8,mock-gas-logo',
      },
      counterparty: {
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      },
    }
  ],
  received: [],
};
const mockNep11AssetHash = '0x1234567890abcdef1234567890abcdef12345678';
const mockNep11Balances = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  balance: [
    {
      assethash: mockNep11AssetHash,
      amount: '2',
      tokens: [
        { tokenid: 'nft-1', amount: '1' },
        { tokenid: 'nft-2', amount: '1' }
      ],
      asset: {
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      }
    }
  ]
};
const mockNep11Transfers = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  sent: [
    {
      txhash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      assethash: mockNep11AssetHash,
      transferaddress: mockKnownRecipientAddress,
      amount: '1',
      tokenid: 'nft-1',
      timestamp: 1710000002000,
      direction: 'sent',
      timestampIso: new Date(1710000002000).toISOString(),
      to: {
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
        logo: 'data:image/svg+xml;utf8,mock-flamingo-logo',
      },
      asset: {
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      },
      counterparty: {
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      },
    }
  ],
  received: [],
};
const mockWallet = {
  address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
  publicKey: 'mock-public-key',
  encryptedPrivateKey: 'encrypted-key',
  WIF: 'mock-wif'
};

// Mock services
const createMockNeoService = (): jest.Mocked<NeoService> => ({
  getBlockchainInfo: jest.fn().mockResolvedValue(mockBlockchainInfo),
  getBlockCount: jest.fn().mockResolvedValue(12345),
  getBlock: jest.fn().mockResolvedValue({ hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', index: 12344 }),
  getTransaction: jest.fn().mockResolvedValue({ hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', sender: 'NMock' }),
  getBalance: jest.fn().mockResolvedValue(mockBalance),
  transferAssets: jest.fn().mockResolvedValue(mockTransferResult),
  invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] }),
  invokeContract: jest.fn().mockResolvedValue(mockTransferResult),
  createWallet: jest.fn().mockReturnValue(mockWallet),
  importWallet: jest.fn().mockReturnValue(mockWallet),
  calculateTransferFee: jest.fn().mockResolvedValue({
    networkFeeDatos: '10000000',
    systemFeeDatos: '5000000',
    networkFeeGas: '0.1',
    systemFeeGas: '0.05',
  }),
  calculateInvokeFee: jest.fn().mockResolvedValue({
    networkFeeDatos: '10000000',
    systemFeeDatos: '5000000',
    networkFeeGas: '0.1',
    systemFeeGas: '0.05',
  }),
  claimGas: jest.fn().mockResolvedValue(mockTransferResult),
  getApplicationLog: jest.fn().mockResolvedValue(mockApplicationLog),
  getNep17Transfers: jest.fn().mockResolvedValue(mockNep17Transfers),
  getNep11Balances: jest.fn().mockResolvedValue(mockNep11Balances),
  getNep11Transfers: jest.fn().mockResolvedValue(mockNep11Transfers),
  waitForTransaction: jest.fn().mockResolvedValue({
    txid: mockTransferResult.txid,
    confirmed: true,
    blockHeight: 12345,
    applicationLog: mockApplicationLog,
  }),
  getUnclaimedGas: jest.fn().mockResolvedValue({ address: mockBalance.address, unclaimedGas: '123456789' }),
  getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
} as any);

const createMockWalletService = () => ({
  createWallet: jest.fn().mockResolvedValue({
    address: mockWallet.address,
    publicKey: mockWallet.publicKey,
    encryptedPrivateKey: mockWallet.encryptedPrivateKey,
    keyFormat: 'nep2',
    createdAt: '2026-03-06T00:00:00.000Z'
  }),
  importWallet: jest.fn().mockImplementation(async (_key: string, password?: string) => {
    if (password) {
      return {
        address: mockWallet.address,
        publicKey: mockWallet.publicKey,
        encryptedPrivateKey: mockWallet.encryptedPrivateKey,
        keyFormat: 'nep2',
        createdAt: '2026-03-06T00:00:00.000Z'
      };
    }
    return {
      address: mockWallet.address,
      publicKey: mockWallet.publicKey
    };
  }),
  getWallet: jest.fn().mockResolvedValue({
    address: mockWallet.address,
    publicKey: mockWallet.publicKey,
    encryptedPrivateKey: mockWallet.encryptedPrivateKey,
    encryptedWIF: 'legacy-secret-nep2',
    WIF: 'raw-wif-secret',
    privateKey: 'raw-private-key-secret',
    keyFormat: 'nep2',
    createdAt: '2026-03-06T00:00:00.000Z'
  })
});

const createMockContractService = (): jest.Mocked<ContractService> => {
  const resolveReference = (reference: string) => {
    if (
      reference === 'NeoFS' ||
      reference === 'neofs' ||
      reference === '0x1234567890abcdef1234567890abcdef12345678' ||
      reference === 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M'
    ) {
      return {
        contract: {
          name: 'NeoFS',
          description: 'Decentralized storage',
          scriptHash: {
            mainnet: '0x1234567890abcdef1234567890abcdef12345678'
          },
          operations: {
            transfer: {
              name: 'transfer',
              description: 'Transfer tokens'
            }
          }
        },
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678'
      };
    }

    throw new Error('Contract not found');
  };

  const isContractDeployed = jest.fn().mockResolvedValue(true);
  const assertContractDeployed = jest.fn().mockImplementation(async (reference: string) => {
    const isDeployed = await isContractDeployed(reference);
    if (!isDeployed) {
      const { contract } = resolveReference(reference);
      throw new Error(`Contract ${contract.name} is not deployed on mainnet`);
    }
  });

  return ({
    listSupportedContracts: jest.fn().mockResolvedValue([
      { name: 'NeoFS', description: 'Decentralized storage', available: true, operationCount: 5, network: NeoNetwork.MAINNET }
    ]),
    isContractAvailable: jest.fn().mockReturnValue(true),
    isContractDeployed,
    assertContractDeployed,
    getContractOperations: jest.fn().mockImplementation((reference: string) => {
      const { contract } = resolveReference(reference);
      return {
        operations: { transfer: { name: 'transfer', description: 'Transfer tokens' } },
        count: 1,
        contractName: contract.name,
        network: NeoNetwork.MAINNET,
        available: true
      };
    }),
    getContract: jest.fn().mockImplementation((reference: string) => resolveReference(reference).contract),
    getContractScriptHash: jest.fn().mockImplementation((reference: string) => resolveReference(reference).scriptHash),
    resolveContractScriptHash: jest.fn().mockImplementation(async (reference: string) => resolveReference(reference).scriptHash),
    getContractInfo: jest.fn().mockImplementation(async (reference: string) => {
      resolveReference(reference);
      return {
        name: 'NeoFS',
        description: 'Decentralized storage',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        address: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
        operations: {
          operations: { transfer: { name: 'transfer', description: 'Transfer tokens' } },
          count: 1,
          contractName: 'NeoFS',
          network: NeoNetwork.MAINNET,
          available: true
        },
        network: NeoNetwork.MAINNET,
        available: true,
        status: {
          deployed: true,
          status: 'deployed',
          scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
          network: NeoNetwork.MAINNET
        }
      };
    }),
    queryContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] }),
    invokeContract: jest.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] }),
    invokeWriteContract: jest.fn().mockResolvedValue({ txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' }),
    getContractStatus: jest.fn().mockResolvedValue({
      deployed: true,
      status: 'deployed',
      scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
      address: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
      manifestName: 'NeoFS',
      operationCount: 1,
      network: NeoNetwork.MAINNET
    }),
    deployContract: jest.fn().mockResolvedValue({
      txid: mockTransferResult.txid,
      contractHash: '0x1234567890abcdef1234567890abcdef12345678',
      address: mockWallet.address,
      network: NeoNetwork.MAINNET
    }),
    getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
  } as any);
};

describe('Tool Handlers', () => {
  let mockNeoServices: Map<NeoNetwork, NeoService>;
  let mockContractServices: Map<NeoNetwork, ContractService>;
  let mockWalletService: ReturnType<typeof createMockWalletService>;

  beforeEach(() => {
    config.networkMode = NetworkMode.BOTH;
    config.writes.enabled = true;
    jest.clearAllMocks();
    
    mockNeoServices = new Map();
    mockNeoServices.set(NeoNetwork.MAINNET, createMockNeoService());
    mockNeoServices.set(NeoNetwork.TESTNET, createMockNeoService());

    mockContractServices = new Map();
    mockContractServices.set(NeoNetwork.MAINNET, createMockContractService());
    mockContractServices.set(NeoNetwork.TESTNET, createMockContractService());

    mockWalletService = createMockWalletService();
  });

  describe('get_network_mode', () => {
    test('should return network mode successfully', async () => {
      const result = await callTool('get_network_mode', {}, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('networkMode');
    });
  });

  describe('get_blockchain_info', () => {
    test('should get blockchain info for mainnet', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('height');
      expect(result.result.height).toBe(12345);
    });

    test('should get blockchain info for testnet', async () => {
      const input = { network: 'testnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('height');
    });

    test('should handle missing network parameter', async () => {
      const result = await callTool('get_blockchain_info', {}, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('result');
    });
  });

  describe('get_block_count', () => {
    test('should get block count successfully', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('get_block_count', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('blockCount');
      expect(result.result.blockCount).toBe(12345);
    });
  });

  describe('get_block', () => {
    test('should get block by height', async () => {
      const input = { network: 'mainnet', hashOrHeight: 12344 };
      const result = await callTool('get_block', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('hash');
    });

    test('should get block by hash', async () => {
      const input = { 
        network: 'mainnet', 
        hashOrHeight: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };
      const result = await callTool('get_block', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
    });

    test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
      'should reject invalid block height %p',
      async (hashOrHeight) => {
        const neoService = mockNeoServices.get(NeoNetwork.MAINNET) as any;
        const result = await callTool(
          'get_block',
          { network: 'mainnet', hashOrHeight },
          mockNeoServices,
          mockContractServices,
        );

        expect(result).toHaveProperty('error');
        expect(neoService.getBlock).not.toHaveBeenCalled();
      }
    );
  });

  describe('get_transaction', () => {
    test('should get transaction successfully', async () => {
      const input = { 
        network: 'mainnet', 
        txid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };
      const result = await callTool('get_transaction', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('hash');
    });

    test('should handle invalid transaction hash', async () => {
      const input = { network: 'mainnet', txid: 'invalid' };
      const result = await callTool('get_transaction', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('get_balance', () => {
    test('should get balance successfully', async () => {
      const input = { network: 'mainnet', address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('address');
      expect(result.result).toHaveProperty('balance');
      expect(Array.isArray(result.result.balance)).toBe(true);
    });

    test('should handle invalid address', async () => {
      const input = { network: 'mainnet', address: 'invalid' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('get_wallet', () => {
    test('should get sanitized wallet metadata successfully', async () => {
      const input = { address: mockWallet.address };
      const result = await callTool('get_wallet', input, mockNeoServices, mockContractServices, mockWalletService as any);

      expect(result).toHaveProperty('result');
      expect(result.result).toEqual({
        address: mockWallet.address,
        publicKey: mockWallet.publicKey,
        keyFormat: 'nep2',
        createdAt: '2026-03-06T00:00:00.000Z'
      });
      expect(mockWalletService.getWallet).toHaveBeenCalledWith(mockWallet.address);
    });
  });

  describe('default write safety', () => {
    beforeEach(() => {
      config.writes.enabled = false;
    });
    test.each([
      ['create_wallet', { password: 'password123' }],
      ['import_wallet', { key: TEST_WIF, password: 'password123' }],
      ['transfer_assets', {
        network: 'mainnet',
        fromWIF: TEST_WIF,
        toAddress: mockWallet.address,
        asset: 'GAS',
        amount: '1',
        confirm: true,
      }],
      ['claim_gas', { network: 'mainnet', fromWIF: TEST_WIF, confirm: true }],
      ['deploy_contract', {
        network: 'mainnet',
        fromWIF: TEST_WIF,
        nef: { encoding: 'hex', data: 'aa55' },
        manifest: { name: 'TestContract' },
        confirm: true,
      }],
      ['invoke_contract', {
        network: 'mainnet',
        fromWIF: TEST_WIF,
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: [],
        confirm: true,
      }],
    ])('rejects disabled or secret-bearing tool %s before calling a service', async (name, input) => {
      const result = await callTool(name, input, mockNeoServices, mockContractServices, mockWalletService as any);

      expect(result).toMatchObject({
        error: { message: expect.stringMatching(/not available|server-held signer/i) },
      });
      expect(mockWalletService.createWallet).not.toHaveBeenCalled();
      expect(mockWalletService.importWallet).not.toHaveBeenCalled();
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).transferAssets).not.toHaveBeenCalled();
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).claimGas).not.toHaveBeenCalled();
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).deployContract).not.toHaveBeenCalled();
    });
  });

  describe('invoke_contract', () => {
    test('should invoke read-only contract', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'balanceOf',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect((mockNeoServices.get(NeoNetwork.MAINNET) ).invokeReadContract).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678',
        'balanceOf',
        []
      );
      expect((mockContractServices.get(NeoNetwork.MAINNET) ).queryContract).not.toHaveBeenCalled();
    });

    test('should resolve contractName for read-only contract invocation', async () => {
      const input = {
        network: 'mainnet',
        contractName: 'NeoFS',
        operation: 'balanceOf',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).invokeReadContract).toHaveBeenCalledWith(
        'NeoFS',
        'balanceOf',
        []
      );
      expect((mockNeoServices.get(NeoNetwork.MAINNET) ).invokeReadContract).not.toHaveBeenCalled();
    });

    test('should accept a generic contract reference by Neo address for read-only invocation', async () => {
      const input = {
        network: 'mainnet',
        contract: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
        operation: 'balanceOf',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).invokeReadContract).toHaveBeenCalledWith(
        'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M',
        'balanceOf',
        []
      );
    });

    test('should reject named contract invocation when the contract is not live on the current network', async () => {
      const contractService = mockContractServices.get(NeoNetwork.MAINNET) as any;
      contractService.isContractDeployed.mockResolvedValue(false);

      const input = {
        network: 'mainnet',
        contractName: 'NeoFS',
        operation: 'balanceOf',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('error');
      expect(result.error.message).toContain('not deployed on mainnet');
      expect(contractService.invokeReadContract).not.toHaveBeenCalled();
    });

    test('should default to the only enabled network when network is omitted', async () => {
      const onlyTestnetNeoServices = new Map([
        [NeoNetwork.TESTNET, createMockNeoService()]
      ]);
      const onlyTestnetContractServices = new Map([
        [NeoNetwork.TESTNET, createMockContractService()]
      ]);

      const result = await callTool('get_blockchain_info', {}, onlyTestnetNeoServices as any, onlyTestnetContractServices as any);

      expect(result).toHaveProperty('result');
      expect((onlyTestnetNeoServices.get(NeoNetwork.TESTNET) ).getBlockchainInfo).toHaveBeenCalled();
    });
  });


  describe('get_application_log', () => {
    test('should get application log successfully', async () => {
      const input = {
        network: 'mainnet',
        txid: mockTransferResult.txid
      };
      const result = await callTool('get_application_log', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('txid', mockTransferResult.txid);
      expect(result.result.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(result.result.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).getApplicationLog).toHaveBeenCalledWith(mockTransferResult.txid);
    });
  });

  describe('wait_for_transaction', () => {
    test('should wait for transaction successfully', async () => {
      const input = {
        network: 'mainnet',
        txid: mockTransferResult.txid,
        timeoutMs: 5000,
        pollIntervalMs: 250,
        includeApplicationLog: true
      };
      const result = await callTool('wait_for_transaction', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('confirmed', true);
      expect(result.result.applicationLog.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(result.result.applicationLog.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).waitForTransaction).toHaveBeenCalledWith(mockTransferResult.txid, {
        timeoutMs: 5000,
        pollIntervalMs: 250,
        includeApplicationLog: true
      });
    });

    test.each([
      [{ timeoutMs: 120_001, pollIntervalMs: 250 }, /timeoutMs must not exceed/i],
      [{ timeoutMs: 5_000, pollIntervalMs: 249 }, /pollIntervalMs must be at least/i],
    ])('rejects unsafe wait options as invalid parameters', async (options, message) => {
      const service = mockNeoServices.get(NeoNetwork.MAINNET) as any;
      const result = await callTool('wait_for_transaction', {
        network: 'mainnet',
        txid: mockTransferResult.txid,
        ...options,
      }, mockNeoServices, mockContractServices);

      expect(result).toMatchObject({ error: { code: -32602 } });
      expect(result.error.message).toMatch(message);
      expect(service.waitForTransaction).not.toHaveBeenCalled();
    });
  });

  describe('get_nep17_transfers', () => {
    test('should return enriched transfer history for an address', async () => {
      const input = {
        network: 'mainnet',
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        fromTimestampMs: 0,
        toTimestampMs: 1710000000000,
      };
      const result = await callTool('get_nep17_transfers', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result.address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result.result.sent[0]).toMatchObject({
        direction: 'sent',
        timestampIso: new Date(1710000000000).toISOString(),
      });
      expect(result.result.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).getNep17Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000000000,
      });
    });
  });

  describe('get_nep11_balances', () => {
    test('should return enriched nep11 balances for an address', async () => {
      const input = {
        network: 'mainnet',
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr'
      };
      const result = await callTool('get_nep11_balances', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result.address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result.result.balance[0]).toMatchObject({
        assethash: mockNep11AssetHash,
        amount: '2',
      });
      expect(result.result.balance[0].asset).toMatchObject({
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      });
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).getNep11Balances).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    });
  });

  describe('get_nep11_transfers', () => {
    test('should return enriched nep11 transfer history for an address', async () => {
      const input = {
        network: 'mainnet',
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        fromTimestampMs: 0,
        toTimestampMs: 1710000002000,
      };
      const result = await callTool('get_nep11_transfers', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result.address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(result.result.sent[0]).toMatchObject({
        tokenid: 'nft-1',
        direction: 'sent',
        timestampIso: new Date(1710000002000).toISOString(),
      });
      expect(result.result.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).getNep11Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000002000,
      });
    });
  });

  describe('get_unclaimed_gas', () => {
    test('should get unclaimed gas successfully', async () => {
      const input = { network: 'mainnet', address: mockBalance.address };
      const result = await callTool('get_unclaimed_gas', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect(result.result).toEqual({ address: mockBalance.address, unclaimedGas: '123456789' });
      expect((mockNeoServices.get(NeoNetwork.MAINNET) as any).getUnclaimedGas).toHaveBeenCalledWith(mockBalance.address);
    });
  });

  describe('list_famous_contracts', () => {
    test('should list contracts successfully', async () => {
      const input = { network: 'mainnet' };
      const result = await callTool('list_famous_contracts', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('contracts');
      expect(Array.isArray(result.contracts)).toBe(true);
      expect(result).toHaveProperty('network', NeoNetwork.MAINNET);
    });

    test('should filter out contracts that are not live on the current network', async () => {
      const contractService = mockContractServices.get(NeoNetwork.MAINNET) as any;
      contractService.listSupportedContracts.mockResolvedValue([
        { name: 'NeoFS', description: 'Decentralized storage', available: false, operationCount: 5, network: NeoNetwork.MAINNET }
      ]);

      const input = { network: 'mainnet' };
      const result = await callTool('list_famous_contracts', input, mockNeoServices, mockContractServices);

      expect(result).toEqual({ contracts: [], network: NeoNetwork.MAINNET });
    });
  });

  describe('get_contract_info', () => {
    test('should get contract info successfully', async () => {
      const input = { network: 'mainnet', contractName: 'NeoFS' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);
      
      expect(result).toMatchObject({
        name: 'NeoFS',
        description: expect.stringContaining('Decentralized storage'),
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        network: NeoNetwork.MAINNET
      });
      expect(result.operations).toHaveProperty('operations');
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).getContractInfo).toHaveBeenCalledWith('NeoFS');
    });

    test('should get contract info via nameOrHash alias', async () => {
      const input = { network: 'mainnet', nameOrHash: '0x1234567890abcdef1234567890abcdef12345678' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);

      expect(result).toMatchObject({
        name: 'NeoFS',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678'
      });
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).getContractInfo).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678');
    });

    test('should handle invalid contract name', async () => {
      const input = { network: 'mainnet', nameOrHash: 'NonExistent' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should get contract info by Neo address reference', async () => {
      const input = { network: 'mainnet', contract: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M' };
      const result = await callTool('get_contract_info', input, mockNeoServices, mockContractServices);

      expect(result).toMatchObject({
        name: 'NeoFS',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
      });
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).getContractInfo).toHaveBeenCalledWith('NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M');
    });
  });

  describe('get_contract_status', () => {
    test('should return deployment status for a generic contract reference', async () => {
      const input = { network: 'mainnet', contract: 'NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M' };
      const result = await callTool('get_contract_status', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect(result.result).toMatchObject({
        deployed: true,
        status: 'deployed',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
      });
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).getContractStatus).toHaveBeenCalledWith('NdzDrZQcdA4V3wRaL6h6JXS8s3i8dJzY5M');
    });
  });

  describe('estimate_transfer_fees', () => {
    test('should estimate transfer fees successfully', async () => {
      const input = {
        network: 'mainnet',
        fromAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        asset: 'NEO',
        amount: '1'
      };
      const result = await callTool('estimate_transfer_fees', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toHaveProperty('networkFeeDatos', '10000000');
      expect(result.result).toHaveProperty('systemFeeDatos', '5000000');
    });
  });

  describe('estimate_invoke_fees', () => {
    test('should estimate invoke fees successfully', async () => {
      const input = {
        network: 'mainnet',
        signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);
      
      expect(result).toHaveProperty('result');
      expect(result.result).toEqual({
        networkFeeDatos: '10000000',
        systemFeeDatos: '5000000',
        networkFeeGas: '0.1',
        systemFeeGas: '0.05',
      });
    });

    test('should estimate invoke fees with contractName alias', async () => {
      const input = {
        network: 'mainnet',
        signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        contractName: 'NeoFS',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);

      expect(result).toHaveProperty('result');
      expect((mockContractServices.get(NeoNetwork.MAINNET) as any).resolveContractScriptHash).toHaveBeenCalledWith('NeoFS');
      expect((mockNeoServices.get(NeoNetwork.MAINNET) ).calculateInvokeFee).toHaveBeenCalledWith(
        'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        '0x1234567890abcdef1234567890abcdef12345678',
        'transfer',
        []
      );
    });

    test('should require signer address', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operation: 'transfer'
      };
      const result = await callTool('estimate_invoke_fees', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });

  describe('error handling', () => {
    test('should handle unknown tool', async () => {
      const result = await callTool('unknown_tool', {}, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should handle invalid network', async () => {
      const input = { network: 'invalid' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should handle service errors', async () => {
      const mockService = mockNeoServices.get(NeoNetwork.MAINNET)!;
      mockService.getBlockchainInfo = jest.fn().mockRejectedValue(new Error('Service error'));

      const input = { network: 'mainnet' };
      const result = await callTool('get_blockchain_info', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });

  describe('validation', () => {
    test('should validate addresses', async () => {
      const input = { network: 'mainnet', address: 'invalid-address' };
      const result = await callTool('get_balance', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should validate amounts', async () => {
      const input = {
        network: 'mainnet',
        fromWIF: TEST_WIF,
        toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        asset: 'NEO',
        amount: '0', // invalid amount
        confirm: true
      };
      const result = await callTool('transfer_assets', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });

    test('should validate script hashes', async () => {
      const input = {
        network: 'mainnet',
        scriptHash: 'invalid-hash',
        operation: 'transfer',
        args: []
      };
      const result = await callTool('invoke_contract', input, mockNeoServices, mockContractServices);
      expect(result).toHaveProperty('error');
    });
  });
}); 
