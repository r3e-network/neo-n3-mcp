const nock = require('nock');
const apiPlaygroundFunction = require('../../netlify/functions/api-playground');

// Mock Neo N3 RPC responses
const mockVersionResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    protocol_version: 3,
    user_agent: '/Neo:3.5.0/'
  }
};

const mockBlockResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    size: 1024,
    version: 0,
    time: 1600000000,
    index: 9999
  }
};

const mockBalanceResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    balances: [
      {
        assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        name: 'NEO',
        symbol: 'NEO',
        amount: '50'
      }
    ]
  }
};

describe('API Playground Function Tests', () => {
  beforeEach(() => {
    // Clear all mocks and interceptors before each test
    nock.cleanAll();
  });

  test('should handle CORS preflight requests', async () => {
    const event = {
      httpMethod: 'OPTIONS',
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.body).toBe('');
  });

  test('should reject non-POST requests', async () => {
    const event = {
      httpMethod: 'GET',
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(405);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Method not allowed');
  });

  test('should fetch blockchain version info', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockVersionResponse);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBlockchainInfo',
        network: 'testnet'
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.result).toEqual(mockVersionResponse);
    expect(body.request.method).toBe('getversion');
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should fetch block information', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockResponse);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBlock',
        network: 'testnet',
        params: {
          blockHeight: 9999
        }
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.result).toEqual(mockBlockResponse);
    expect(body.request.method).toBe('getblock');
    expect(body.request.params).toEqual([9999, 1]);
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should fetch address balance', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBalanceResponse);

    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBalance',
        network: 'testnet',
        params: {
          address: testAddress
        }
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.result).toEqual(mockBalanceResponse);
    expect(body.request.method).toBe('getnep17balances');
    expect(body.request.params).toEqual([testAddress]);
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should handle invalid endpoint parameter', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'invalidEndpoint',
        network: 'testnet'
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid endpoint');
  });

  test('should handle RPC errors gracefully', async () => {
    // Mock a failed RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(500, { error: 'Internal Server Error' });

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBlockchainInfo',
        network: 'testnet'
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should use mainnet when specified', async () => {
    // Mock the mainnet RPC endpoint
    const mainnetNode = nock('https://mainnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockVersionResponse);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBlockchainInfo',
        network: 'mainnet'
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    
    // Verify mainnet endpoint was called
    expect(mainnetNode.isDone()).toBe(true);
  });

  test('should handle template substitution correctly', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBlockResponse);

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        endpoint: 'getBlock',
        network: 'testnet',
        params: {
          blockHeight: 5000
        }
      })
    };
    
    const response = await apiPlaygroundFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.request.params).toEqual([5000, 1]); // Verify template substitution worked
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });
}); 