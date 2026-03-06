import * as http from 'http';
import { AddressInfo } from 'net';

import { HttpServer } from '../src/http-server';
import { NeoNetwork } from '../src/services/neo-service';

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

function request(
  port: number,
  path: string,
  options: RequestOptions = {}
): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders; }> {
  const method = options.method ?? 'GET';
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          : undefined
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
            headers: res.headers
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForPort(server: HttpServer): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const address = server.getAddress() as AddressInfo | null;
    if (address && typeof address.port === 'number') {
      return address.port;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('HTTP server did not start listening in time');
}

const mockKnownRecipientScriptHash = '0xf970f4ccecd765b63732b821775dc38c25d74b39';
const mockKnownRecipientAddress = 'NdxiFLMContract1111111111111111111';
const mockApplicationLog = {
  txid: '0xabc',
  executions: [{
    vmstate: 'HALT',
    notifications: [{
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
    }
  ],
  received: [],
};

describe('HttpServer', () => {
  test('serves a healthy status payload', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(12345),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/health');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        status: 'healthy',
        network: NeoNetwork.TESTNET,
        height: 12345
      });
    } finally {
      await server.stop();
    }
  });

  test('exposes prometheus-style metrics', async () => {
    const neoService = {
      getBlockCount: jest.fn().mockResolvedValue(456),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/metrics');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('neo_n3_mcp_uptime_seconds');
      expect(response.body).toContain('neo_n3_mcp_block_height{network="mainnet"} 456');
    } finally {
      await server.stop();
    }
  });

  test('sanitizes stored wallet responses', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;
    const walletService = {
      getWallet: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        encryptedPrivateKey: 'secret-nep2',
        createdAt: '2026-03-06T00:00:00.000Z'
      })
    } as any;

    const server = new HttpServer(neoService, walletService, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key',
        createdAt: '2026-03-06T00:00:00.000Z'
      });
    } finally {
      await server.stop();
    }
  });

  test('serves transaction application logs', async () => {
    const neoService = {
      getApplicationLog: jest.fn().mockResolvedValue(mockApplicationLog),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const txid = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const response = await request(port, `/api/transactions/${txid}/application-log`);
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('txid', '0xabc');
      expect(payload.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(payload.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect(neoService.getApplicationLog).toHaveBeenCalledWith(txid);
    } finally {
      await server.stop();
    }
  });

  test('serves nep17 transfer history for an address', async () => {
    const neoService = {
      getNep17Transfers: jest.fn().mockResolvedValue(mockNep17Transfers),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep17-transfers?fromTimestampMs=0&toTimestampMs=1710000000000');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.sent[0]).toMatchObject({
        direction: 'sent',
        timestampIso: new Date(1710000000000).toISOString(),
      });
      expect(payload.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect(neoService.getNep17Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000000000,
      });
    } finally {
      await server.stop();
    }
  });

  test('serves nep11 balances for an address', async () => {
    const neoService = {
      getNep11Balances: jest.fn().mockResolvedValue(mockNep11Balances),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep11-balances');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.balance[0]).toMatchObject({
        assethash: mockNep11AssetHash,
        amount: '2',
      });
      expect(payload.balance[0].asset).toMatchObject({
        scriptHash: mockNep11AssetHash,
        name: mockNep11AssetHash,
      });
      expect(neoService.getNep11Balances).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    } finally {
      await server.stop();
    }
  });

  test('serves nep11 transfer history for an address', async () => {
    const neoService = {
      getNep11Transfers: jest.fn().mockResolvedValue(mockNep11Transfers),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/nep11-transfers?fromTimestampMs=0&toTimestampMs=1710000002000');
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toHaveProperty('address', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
      expect(payload.sent[0]).toMatchObject({
        tokenid: 'nft-1',
        direction: 'sent',
        timestampIso: new Date(1710000002000).toISOString(),
      });
      expect(payload.sent[0].to).toMatchObject({
        address: mockKnownRecipientAddress,
        name: 'Flamingo',
      });
      expect(neoService.getNep11Transfers).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', {
        fromTimestampMs: 0,
        toTimestampMs: 1710000002000,
      });
    } finally {
      await server.stop();
    }
  });

  test('wait route parses polling options', async () => {
    const neoService = {
      waitForTransaction: jest.fn().mockResolvedValue({
        txid: '0xabc',
        confirmed: true,
        blockHeight: 999,
        applicationLog: mockApplicationLog,
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const txid = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const response = await request(port, `/api/transactions/${txid}/wait?timeoutMs=5000&pollIntervalMs=250&includeApplicationLog=true`);
      const payload = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(payload).toMatchObject({ txid: '0xabc', confirmed: true, blockHeight: 999 });
      expect(payload.applicationLog.executions[0].notifications[0].parsed.to).toMatchObject({
        address: mockKnownRecipientAddress,
        scriptHash: mockKnownRecipientScriptHash,
        displayName: 'Flamingo',
        name: 'Flamingo',
        kind: 'contract',
      });
      expect(payload.applicationLog.executions[0].notifications[0].parsed.to.logo).toContain('data:image/svg+xml');
      expect(neoService.waitForTransaction).toHaveBeenCalledWith(txid, {
        timeoutMs: 5000,
        pollIntervalMs: 250,
        includeApplicationLog: true
      });
    } finally {
      await server.stop();
    }
  });

  test('serves unclaimed gas for an address', async () => {
    const neoService = {
      getUnclaimedGas: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        unclaimedGas: '123456789'
      }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr/unclaimed-gas');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        unclaimedGas: '123456789'
      });
      expect(neoService.getUnclaimedGas).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr');
    } finally {
      await server.stop();
    }
  });



  test('serves contract info by name or hash', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      getContract: jest.fn().mockReturnValue({ name: 'NeoFS', description: 'Decentralized storage' }),
      getContractOperations: jest.fn().mockReturnValue({ operations: { transfer: { name: 'transfer' } }, count: 1, contractName: 'NeoFS', network: NeoNetwork.TESTNET, available: true }),
      getContractScriptHash: jest.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
      isContractDeployed: jest.fn().mockResolvedValue(false),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/NeoFS');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        name: 'NeoFS',
        description: 'Decentralized storage',
        scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
        operations: { operations: { transfer: { name: 'transfer' } }, count: 1, contractName: 'NeoFS', network: NeoNetwork.TESTNET, available: false },
        network: NeoNetwork.TESTNET,
        available: false
      });
    } finally {
      await server.stop();
    }
  });

  test('rejects named contract invocation when the contract is not live on the current network', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeReadContract: jest.fn()
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockRejectedValue(new Error('Contract NeoFS is not deployed on testnet')),
      isContractDeployed: jest.fn().mockResolvedValue(false)
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'balanceOf',
          args: []
        }
      });
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Resource not found',
        details: 'Contract NeoFS is not deployed on testnet',
        path: '/api/contracts/invoke',
        method: 'POST'
      });
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('invokes contracts via generic HTTP route using contractName', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      invokeReadContract: jest.fn().mockResolvedValue({ state: 'HALT', stack: [{ value: '100' }] })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'balanceOf',
          args: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ state: 'HALT', stack: [{ value: '100' }] });
      expect(contractService.invokeReadContract).toHaveBeenCalledWith('NeoFS', 'balanceOf', []);
      expect(neoService.invokeReadContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });



  test('invokes write contracts via generic HTTP route using contractName', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET),
      invokeContract: jest.fn().mockResolvedValue({ txid: '0xneo' })
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      invokeWriteContract: jest.fn().mockResolvedValue({ txid: '0xcontract' })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke', {
        method: 'POST',
        body: {
          contractName: 'NeoFS',
          operation: 'transfer',
          args: [],
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          confirm: true
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ txid: '0xcontract' });
      expect(contractService.invokeWriteContract).toHaveBeenCalledWith(expect.anything(), 'NeoFS', 'transfer', []);
      expect(neoService.invokeContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });



  test('supports stateless wallet import without a password', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.MAINNET)
    } as any;
    const walletService = {
      importWallet: jest.fn().mockResolvedValue({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key'
      })
    } as any;

    const server = new HttpServer(neoService, walletService, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/wallets/import', {
        method: 'POST',
        body: {
          privateKeyOrWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8'
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        publicKey: 'mock-public-key'
      });
      expect(walletService.importWallet).toHaveBeenCalledWith('Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8', undefined);
    } finally {
      await server.stop();
    }
  });

  test('serves block details by hash as well as height', async () => {
    const blockHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const neoService = {
      getBlock: jest.fn().mockResolvedValue({ hash: blockHash, index: 1234 }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, `/api/blocks/${blockHash}`);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ hash: blockHash, index: 1234 });
      expect(neoService.getBlock).toHaveBeenCalledWith(blockHash);
    } finally {
      await server.stop();
    }
  });

  test('requires confirm=true for transfer execution', async () => {
    const neoService = {
      transferAssets: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          asset: 'NEO',
          amount: '1'
        }
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing required parameter: confirm=true' });
      expect(neoService.transferAssets).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('executes transfers when confirmation is present', async () => {
    const neoService = {
      transferAssets: jest.fn().mockResolvedValue({ txid: '0xtransfer' }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          asset: 'NEO',
          amount: '1',
          confirm: true
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ txid: '0xtransfer' });
      expect(neoService.transferAssets).toHaveBeenCalledWith(expect.anything(), 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'NEO', '1');
    } finally {
      await server.stop();
    }
  });

  test('estimates transfer fees via HTTP', async () => {
    const neoService = {
      calculateTransferFee: jest.fn().mockResolvedValue({ networkFee: 0.1, systemFee: 0.05 }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/transfers/estimate-fees', {
        method: 'POST',
        body: {
          fromAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          toAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          asset: 'NEO',
          amount: '1'
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ networkFee: 0.1, systemFee: 0.05 });
      expect(neoService.calculateTransferFee).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', 'NEO', '1');
    } finally {
      await server.stop();
    }
  });

  test('estimates invoke fees via HTTP using contractName', async () => {
    const neoService = {
      calculateInvokeFee: jest.fn().mockResolvedValue({ networkFee: 0.2, systemFee: 0.07 }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      assertContractDeployed: jest.fn().mockResolvedValue(undefined),
      getContractScriptHash: jest.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678')
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/invoke/estimate-fees', {
        method: 'POST',
        body: {
          signerAddress: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
          contractName: 'NeoFS',
          operation: 'transfer',
          args: []
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ networkFee: 0.2, systemFee: 0.07 });
      expect(contractService.getContractScriptHash).toHaveBeenCalledWith('NeoFS');
      expect(neoService.calculateInvokeFee).toHaveBeenCalledWith('NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr', '0x1234567890abcdef1234567890abcdef12345678', 'transfer', []);
    } finally {
      await server.stop();
    }
  });

  test('requires confirm=true for GAS claim', async () => {
    const neoService = {
      claimGas: jest.fn(),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/claim-gas', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8'
        }
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing required parameter: confirm=true' });
      expect(neoService.claimGas).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('claims GAS when confirmation is present', async () => {
    const neoService = {
      claimGas: jest.fn().mockResolvedValue({ txid: '0xclaim' }),
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;

    const server = new HttpServer(neoService, {} as any, {} as any, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/accounts/claim-gas', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          confirm: true
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ txid: '0xclaim' });
      expect(neoService.claimGas).toHaveBeenCalledWith(expect.anything());
    } finally {
      await server.stop();
    }
  });

  test('requires confirm=true for contract deployment', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      deployContract: jest.fn()
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    try {
      const response = await request(port, '/api/contracts/deploy', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          script: Buffer.from('aa55', 'hex').toString('base64'),
          manifest: {
            name: 'TestContract',
            groups: [],
            supportedstandards: [],
            abi: { methods: [], events: [] },
            permissions: [],
            trusts: [],
            extra: null
          }
        }
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing required parameter: confirm=true' });
      expect(contractService.deployContract).not.toHaveBeenCalled();
    } finally {
      await server.stop();
    }
  });

  test('deploys contracts when confirmation is present', async () => {
    const neoService = {
      getNetwork: jest.fn().mockReturnValue(NeoNetwork.TESTNET)
    } as any;
    const contractService = {
      deployContract: jest.fn().mockResolvedValue({
        txid: '0xabc',
        contractHash: '0x1234567890abcdef1234567890abcdef12345678',
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        network: NeoNetwork.TESTNET
      })
    } as any;

    const server = new HttpServer(neoService, {} as any, contractService, 0);
    const port = await waitForPort(server);

    const manifest = {
      name: 'TestContract',
      groups: [],
      supportedstandards: [],
      abi: { methods: [], events: [] },
      permissions: [],
      trusts: [],
      extra: null
    };

    try {
      const response = await request(port, '/api/contracts/deploy', {
        method: 'POST',
        body: {
          fromWIF: 'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
          script: Buffer.from('aa55', 'hex').toString('base64'),
          manifest,
          confirm: true
        }
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        txid: '0xabc',
        contractHash: '0x1234567890abcdef1234567890abcdef12345678',
        address: 'NaMLm1hwCaQitxmLboJGo2XJkG8PSYvuyr',
        network: NeoNetwork.TESTNET
      });
      expect(contractService.deployContract).toHaveBeenCalledWith(
        'Kx61m6KtSMHA61qrmwXpQQxG1EDurDGrtPGUUTuKnwxiDDnq7GC8',
        Buffer.from('aa55', 'hex').toString('base64'),
        manifest
      );
    } finally {
      await server.stop();
    }
  });
});
