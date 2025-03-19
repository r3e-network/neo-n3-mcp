const nock = require('nock');
const blockExplorerFunction = require('../../netlify/functions/block-explorer');

// Mock Neo N3 RPC responses
const mockBlockchainHeight = {
  jsonrpc: '2.0',
  id: 1,
  result: 10000
};

const mockBlockData = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    size: 1024,
    version: 0,
    previousblockhash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    merkleroot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    time: 1600000000,
    index: 9999,
    nextblockhash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    tx: [
      '0xtx1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      '0xtx2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    ]
  }
};

const mockVersionData = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    protocol_version: 3,
    user_agent: '/Neo:3.5.0/'
  }
};

const mockTransactionData = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    txid: '0xtx1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    size: 256,
    type: 'ContractTransaction',
    version: 0,
    blockhash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    blocktime: 1600000000
  }
};

describe('Block Explorer Function Tests', () => {
  beforeEach(() => {
    // Clear all mocks and interceptors before each test
    nock.cleanAll();
  });

  test('should handle CORS preflight requests', async () => {
    const event = {
      httpMethod: 'OPTIONS',
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.body).toBe('');
  });

  test('should fetch latest blocks successfully', async () => {
    // Mock the RPC endpoints
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockchainHeight)
      .post('/')
      .times(5)
      .reply(200, mockBlockData);

    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'latestBlocks',
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(5);
    expect(body[0].hash).toBe(mockBlockData.result.hash);
    
    // Verify all our nock endpoints were called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should fetch blockchain stats successfully', async () => {
    // Mock the RPC endpoints
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockchainHeight)
      .post('/')
      .reply(200, mockVersionData);

    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'getStats',
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.blockCount).toBe(mockBlockchainHeight.result);
    expect(body.version).toEqual(mockVersionData.result);
    expect(body.network).toBe('testnet');
    
    // Verify all our nock endpoints were called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should fetch block details successfully', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockData);

    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'getBlock',
        height: '9999',
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.hash).toBe(mockBlockData.result.hash);
    expect(body.index).toBe(mockBlockData.result.index);
    
    // Verify all our nock endpoints were called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should fetch transaction details successfully', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockTransactionData);

    const txid = '0xtx1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'getTransaction',
        txid: txid,
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.txid).toBe(mockTransactionData.result.txid);
    
    // Verify all our nock endpoints were called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should handle invalid action gracefully', async () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'invalidAction',
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid action');
  });

  test('should handle RPC errors gracefully', async () => {
    // Mock a failed RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(500, { error: 'Internal Server Error' });

    // Mock backup RPC node to fail too
    const backupNode = nock('https://testnet2.neo.coz.io:443')
      .post('/')
      .reply(500, { error: 'Internal Server Error' });

    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'getStats',
        network: 'testnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    
    // Verify both nodes were tried
    expect(testnetNode.isDone()).toBe(true);
    expect(backupNode.isDone()).toBe(true);
  });

  test('should use mainnet when specified', async () => {
    // Mock the mainnet RPC endpoint
    const mainnetNode = nock('https://mainnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockData);

    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        action: 'getBlock',
        height: '9999',
        network: 'mainnet'
      }
    };
    
    const response = await blockExplorerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.hash).toBe(mockBlockData.result.hash);
    
    // Verify mainnet endpoint was called
    expect(mainnetNode.isDone()).toBe(true);
  });
}); 