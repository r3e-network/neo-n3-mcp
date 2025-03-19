const openrouteChatFunction = require('../../netlify/functions/openroute-chat');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('OpenRoute Chat Function Tests', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle CORS preflight requests', async () => {
    const event = {
      httpMethod: 'OPTIONS',
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(response.body).toBe('');
  });

  test('should reject non-POST requests', async () => {
    const event = {
      httpMethod: 'GET',
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(405);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Method not allowed');
  });

  test('should require an API key', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('API key is required');
  });

  test('should require messages array', async () => {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key'
      })
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Messages array is required');
  });

  test('should add system message if not provided', async () => {
    // Mock successful API response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { role: 'assistant', content: 'Hello there!' } }],
        model: 'openai/gpt-3.5-turbo',
        usage: { total_tokens: 100 }
      }
    });
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };
    
    await openrouteChatFunction.handler(event);
    
    // Check that the API was called with the system message added
    expect(axios.post).toHaveBeenCalledTimes(1);
    const apiCallArgs = axios.post.mock.calls[0][1];
    expect(apiCallArgs.messages.length).toBe(2);
    expect(apiCallArgs.messages[0].role).toBe('system');
    expect(apiCallArgs.messages[0].content).toContain('Neo N3 blockchain');
  });

  test('should not duplicate system message if already provided', async () => {
    // Mock successful API response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { role: 'assistant', content: 'Hello there!' } }],
        model: 'openai/gpt-3.5-turbo',
        usage: { total_tokens: 100 }
      }
    });
    
    const systemMessage = {
      role: 'system',
      content: 'Custom system message'
    };
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        messages: [
          systemMessage,
          { role: 'user', content: 'Hello' }
        ]
      })
    };
    
    await openrouteChatFunction.handler(event);
    
    // Check that the API was called with just the provided system message
    expect(axios.post).toHaveBeenCalledTimes(1);
    const apiCallArgs = axios.post.mock.calls[0][1];
    expect(apiCallArgs.messages.length).toBe(2);
    expect(apiCallArgs.messages[0].role).toBe('system');
    expect(apiCallArgs.messages[0].content).toBe('Custom system message');
  });

  test('should forward OpenRoute API response', async () => {
    // Mock successful API response
    const mockResponse = {
      data: {
        choices: [{ message: { role: 'assistant', content: 'Hello from Neo N3!' } }],
        model: 'openai/gpt-3.5-turbo',
        usage: { total_tokens: 100 }
      }
    };
    
    axios.post.mockResolvedValueOnce(mockResponse);
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Tell me about Neo N3' }]
      })
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toEqual(mockResponse.data.choices[0].message);
    expect(body.model).toBe(mockResponse.data.model);
    expect(body.usage).toEqual(mockResponse.data.usage);
  });

  test('should handle streaming responses when stream=true', async () => {
    // Mock a streaming response (just the raw data to be returned)
    const mockStreamData = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" from"}}]}\n\ndata: {"choices":[{"delta":{"content":" Neo N3!"}}]}\n\ndata: [DONE]';
    axios.post.mockResolvedValueOnce({
      data: mockStreamData
    });
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Tell me about Neo N3' }],
        stream: true
      })
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('text/event-stream');
    expect(response.headers['Cache-Control']).toBe('no-cache');
    expect(response.headers['Connection']).toBe('keep-alive');
    expect(response.body).toBe(mockStreamData);
  });

  test('should handle OpenRoute API errors', async () => {
    // Mock API error response
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Invalid API key'
          }
        }
      }
    });
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'invalid-key',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };
    
    const response = await openrouteChatFunction.handler(event);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('Invalid API key');
  });

  test('should use custom temperature when provided', async () => {
    // Mock successful API response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        model: 'openai/gpt-3.5-turbo',
        usage: { total_tokens: 100 }
      }
    });
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.2
      })
    };
    
    await openrouteChatFunction.handler(event);
    
    // Check that the API was called with the right temperature
    expect(axios.post).toHaveBeenCalledTimes(1);
    const apiCallArgs = axios.post.mock.calls[0][1];
    expect(apiCallArgs.temperature).toBe(0.2);
  });

  test('should include correct headers including X-Title', async () => {
    // Mock successful API response
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { role: 'assistant', content: 'Hello there!' } }],
        model: 'openai/gpt-3.5-turbo',
        usage: { total_tokens: 100 }
      }
    });
    
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };
    
    await openrouteChatFunction.handler(event);
    
    // Check that the headers were set correctly
    expect(axios.post).toHaveBeenCalledTimes(1);
    const headers = axios.post.mock.calls[0][2].headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['HTTP-Referer']).toBe('https://neo-n3-mcp.netlify.app/');
    expect(headers['X-Title']).toBe('Neo N3 MCP Chat');
  });
}); 