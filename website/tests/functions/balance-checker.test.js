const nock = require('nock');
const balanceCheckerFunction = require('../../netlify/functions/balance-checker');

// Mock Neo N3 RPC responses
const mockBalanceData = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    balances: [
      {
        assethash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        name: 'NEO',
        symbol: 'NEO',
        amount: '50'
      },
      {
        assethash: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
        name: 'GAS',
        symbol: 'GAS',
        amount: '1000000000'
      },
      {
        assethash: '0x9a83ff8a9b0d0a656dae42e1c4b6d8ea8146c990',
        name: 'UnknownToken',
        symbol: 'UNK',
        amount: '1000'
      }
    ]
  }
};

const mockEmptyBalanceData = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    balances: []
  }
};

describe('Balance Checker Function Tests', () => {
  beforeEach(() => {
    // Clear all mocks and interceptors before each test
    nock.cleanAll();
  });

  test('should handle CORS preflight requests', async () => {
    const event = {
      httpMethod: 'OPTIONS',
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.body).toBe('');
  });

  test('should fetch balances successfully for an address', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockBalanceData);

    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        address: testAddress,
        network: 'testnet'
      }
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.address).toBe(testAddress);
    expect(body.network).toBe('testnet');
    expect(Array.isArray(body.balances)).toBe(true);
    expect(body.balances.length).toBe(mockBalanceData.result.balances.length);
    
    // Check specific token details
    const neo = body.balances.find(token => token.symbol === 'NEO');
    expect(neo).toBeDefined();
    expect(neo.amount).toBe('50');
    expect(neo.formatted).toBe('50'); // NEO has 0 decimals
    
    const gas = body.balances.find(token => token.symbol === 'GAS');
    expect(gas).toBeDefined();
    expect(gas.amount).toBe('1000000000');
    expect(gas.formatted).toBe('10.00000000'); // GAS has 8 decimals
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should handle empty balances correctly', async () => {
    // Mock the RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(200, mockEmptyBalanceData);

    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        address: testAddress,
        network: 'testnet'
      }
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.address).toBe(testAddress);
    expect(body.balances).toEqual([]);
    
    // Verify our nock endpoint was called
    expect(testnetNode.isDone()).toBe(true);
  });

  test('should handle missing address parameter', async () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        network: 'testnet'
      }
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Address parameter is required');
  });

  test('should handle RPC errors gracefully', async () => {
    // Mock a failed RPC endpoint
    const testnetNode = nock('https://testnet1.neo.coz.io:443')
      .post('/')
      .reply(500, { error: 'Internal Server Error' });

    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        address: testAddress,
        network: 'testnet'
      }
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
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
      .reply(200, mockBalanceData);

    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        address: testAddress,
        network: 'mainnet'
      }
    };
    
    const response = await balanceCheckerFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.network).toBe('mainnet');
    
    // Verify mainnet endpoint was called
    expect(mainnetNode.isDone()).toBe(true);
  });
}); 