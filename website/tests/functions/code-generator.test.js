const codeGeneratorFunction = require('../../netlify/functions/code-generator');

describe('Code Generator Function Tests', () => {
  test('should handle CORS preflight requests', async () => {
    const event = {
      httpMethod: 'OPTIONS',
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.body).toBe('');
  });

  test('should reject non-POST requests', async () => {
    const event = {
      httpMethod: 'GET',
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(405);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Method not allowed');
  });

  test('should generate JavaScript code for getBlockchainInfo', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'getBlockchainInfo',
        language: 'javascript',
        params: {
          network: 'testnet'
        }
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.operation).toBe('getBlockchainInfo');
    expect(body.language).toBe('javascript');
    
    // Check that the code contains the network parameter
    expect(body.code).toContain('network: \'testnet\'');
    expect(body.code).not.toContain('{{network}}');
  });

  test('should generate Python code for getBlock', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'getBlock',
        language: 'python',
        params: {
          network: 'mainnet',
          blockHeight: 5000
        }
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.operation).toBe('getBlock');
    expect(body.language).toBe('python');
    
    // Check that the code contains the correct parameters
    expect(body.code).toContain('"network": "mainnet"');
    expect(body.code).toContain('"blockHeight": 5000');
    expect(body.code).not.toContain('{{network}}');
    expect(body.code).not.toContain('{{blockHeight}}');
  });

  test('should generate cURL code for getBalance', async () => {
    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'getBalance',
        language: 'curl',
        params: {
          address: testAddress,
          network: 'testnet'
        }
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.operation).toBe('getBalance');
    expect(body.language).toBe('curl');
    
    // Check that the code contains the correct parameters
    expect(body.code).toContain(testAddress);
    expect(body.code).toContain('testnet');
    expect(body.code).not.toContain('{{address}}');
    expect(body.code).not.toContain('{{network}}');
  });

  test('should generate TypeScript code for mcpTransferAssets', async () => {
    const testWif = 'KwDZGCUXYAB1cUNmZKQ5RFUBAYPjwXvpavQQHvpeH1qM5pJ3zurn';
    const testAddress = 'NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ';
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'mcpTransferAssets',
        language: 'typescript',
        params: {
          wif: testWif,
          toAddress: testAddress,
          asset: 'NEO',
          amount: '1',
          network: 'testnet'
        }
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.operation).toBe('mcpTransferAssets');
    expect(body.language).toBe('typescript');
    
    // Check that the code contains the correct parameters and TypeScript typing
    expect(body.code).toContain(`fromWIF: "${testWif}"`);
    expect(body.code).toContain(`toAddress: "${testAddress}"`);
    expect(body.code).toContain(`asset: "NEO"`);
    expect(body.code).toContain(`amount: "1"`);
    expect(body.code).toContain(`network: "testnet"`);
    expect(body.code).toContain('Promise<any>'); // TypeScript return type
  });

  test('should handle invalid operation gracefully', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'invalidOperation',
        language: 'javascript'
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid operation');
  });

  test('should handle invalid language gracefully', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        operation: 'getBlockchainInfo',
        language: 'invalidLanguage'
      })
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Unsupported language');
  });

  test('should handle parse errors gracefully', async () => {
    const event = {
      httpMethod: 'POST',
      body: '{invalid: json}'
    };
    
    const response = await codeGeneratorFunction.handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });
}); 