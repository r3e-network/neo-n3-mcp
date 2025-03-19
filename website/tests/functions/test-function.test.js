const testFunction = require('../../netlify/functions/test-function');

describe('Test Function Tests', () => {
  test('should return a valid response', async () => {
    const event = {};
    const response = await testFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Neo N3 MCP Netlify Functions are working correctly!');
    expect(body.timestamp).toBeDefined();
    expect(body.nodeVersion).toBeDefined();
  });
}); 