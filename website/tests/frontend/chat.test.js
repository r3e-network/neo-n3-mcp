/**
 * Tests for the chat interface
 */

// Setup DOM environment
document.body.innerHTML = `
  <div id="chat-form"></div>
  <textarea id="chat-input"></textarea>
  <button id="send-button"></button>
  <div id="chat-messages"></div>
  <input id="openroute-api-key" />
  <div id="api-key-notice"></div>
  <button id="toggle-api-key"><i class="fa fa-eye"></i></button>
  <select id="model-select"></select>
  <input id="temperature-slider" type="range" />
  <span id="temperature-value">0.7</span>
  <div class="toggle-switch">
    <input type="checkbox" id="stream-toggle" checked>
    <span class="toggle-slider"></span>
  </div>
  <button id="new-chat"></button>
  <button id="clear-history"></button>
`;

// Mock standard fetch for non-streaming responses
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      message: { role: 'assistant', content: 'Test response' },
      model: 'openai/gpt-3.5-turbo',
      usage: { total_tokens: 100 }
    })
  })
);

// Create mock implementations for the streaming API
function createMockStreamResponse() {
  const mockReadableStream = {
    getReader: () => ({
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Test"}}]}\n\n')
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" streaming"}}]}\n\n')
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" response"}}]}\n\n')
        })
        .mockResolvedValueOnce({
          done: true
        })
    })
  };
  
  return Promise.resolve({
    ok: true,
    body: mockReadableStream,
    json: () => Promise.reject(new Error('Cannot call json() on a streaming response'))
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock confirm
window.confirm = jest.fn(() => true);

// Load the chat.js script
require('../../js/chat');

describe('Chat Interface', () => {
  beforeEach(() => {
    // Clear all mocks and localStorage before each test
    jest.clearAllMocks();
    localStorage.clear();
    
    // Reset fetch mock to default behavior
    global.fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: { role: 'assistant', content: 'Test response' },
          model: 'openai/gpt-3.5-turbo',
          usage: { total_tokens: 100 }
        })
      })
    );
    
    // Trigger DOMContentLoaded to initialize the chat
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });
  
  test('should initialize with disabled chat if no API key', () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const apiKeyNotice = document.getElementById('api-key-notice');
    
    expect(chatInput.disabled).toBe(true);
    expect(sendButton.disabled).toBe(true);
    expect(apiKeyNotice.style.display).not.toBe('none');
  });
  
  test('should enable chat when API key is provided', () => {
    const apiKeyInput = document.getElementById('openroute-api-key');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const apiKeyNotice = document.getElementById('api-key-notice');
    
    // Simulate API key input
    apiKeyInput.value = 'test-api-key';
    apiKeyInput.dispatchEvent(new Event('input'));
    
    expect(chatInput.disabled).toBe(false);
    expect(sendButton.disabled).toBe(false);
    expect(apiKeyNotice.style.display).toBe('none');
    expect(localStorage.setItem).toHaveBeenCalledWith('openroute_api_key', 'test-api-key');
  });
  
  test('should toggle API key visibility', () => {
    const apiKeyInput = document.getElementById('openroute-api-key');
    const toggleButton = document.getElementById('toggle-api-key');
    const icon = toggleButton.querySelector('i');
    
    // Initially password
    expect(apiKeyInput.type).toBe('password');
    
    // Click to show text
    toggleButton.click();
    expect(apiKeyInput.type).toBe('text');
    expect(icon.classList.contains('fa-eye-slash')).toBe(true);
    
    // Click again to hide
    toggleButton.click();
    expect(apiKeyInput.type).toBe('password');
    expect(icon.classList.contains('fa-eye')).toBe(true);
  });
  
  test('should update temperature value when slider changes', () => {
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    
    // Change temperature
    temperatureSlider.value = '0.3';
    temperatureSlider.dispatchEvent(new Event('input'));
    
    expect(temperatureValue.textContent).toBe('0.3');
    expect(localStorage.setItem).toHaveBeenCalledWith('chat_temperature', '0.3');
  });
  
  test('should save model selection to localStorage', () => {
    const modelSelect = document.getElementById('model-select');
    
    // Change model
    modelSelect.value = 'anthropic/claude-3-sonnet';
    modelSelect.dispatchEvent(new Event('change'));
    
    expect(localStorage.setItem).toHaveBeenCalledWith('chat_model', 'anthropic/claude-3-sonnet');
  });
  
  test('should save streaming preference to localStorage', () => {
    const streamToggle = document.getElementById('stream-toggle');
    
    // Change streaming preference
    streamToggle.checked = false;
    streamToggle.dispatchEvent(new Event('change'));
    
    expect(localStorage.setItem).toHaveBeenCalledWith('chat_stream', 'false');
    
    // Change back
    streamToggle.checked = true;
    streamToggle.dispatchEvent(new Event('change'));
    
    expect(localStorage.setItem).toHaveBeenCalledWith('chat_stream', 'true');
  });
  
  test('should add user message and call API when form is submitted', async () => {
    // Enable chat first
    const apiKeyInput = document.getElementById('openroute-api-key');
    apiKeyInput.value = 'test-api-key';
    apiKeyInput.dispatchEvent(new Event('input'));
    
    // Disable streaming for this test
    const streamToggle = document.getElementById('stream-toggle');
    streamToggle.checked = false;
    streamToggle.dispatchEvent(new Event('change'));
    
    // Set up the form submission
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    
    chatInput.value = 'Test message';
    
    // Submit the form
    chatForm.dispatchEvent(new Event('submit'));
    
    // Check that the message was added to the UI
    expect(chatMessages.innerHTML).toContain('Test message');
    
    // Wait for the API call to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that fetch was called correctly
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/openroute-chat', expect.any(Object));
    
    // Check that the response was added to the UI
    expect(chatMessages.innerHTML).toContain('Test response');
  });
  
  test('should handle streaming responses', async () => {
    // Mock the streaming response
    global.fetch.mockImplementationOnce(createMockStreamResponse);
    
    // Enable chat
    const apiKeyInput = document.getElementById('openroute-api-key');
    apiKeyInput.value = 'test-api-key';
    apiKeyInput.dispatchEvent(new Event('input'));
    
    // Ensure streaming is enabled
    const streamToggle = document.getElementById('stream-toggle');
    streamToggle.checked = true;
    streamToggle.dispatchEvent(new Event('change'));
    
    // Set up the form submission
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    
    chatInput.value = 'Test streaming message';
    
    // Submit the form
    chatForm.dispatchEvent(new Event('submit'));
    
    // Wait for the API call to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that fetch was called correctly with stream: true
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/openroute-chat', expect.objectContaining({
      body: expect.stringContaining('"stream":true')
    }));
  });
  
  test('should load saved API key and preferences on initialization', () => {
    // Reset DOM and mocks
    jest.clearAllMocks();
    
    // Set up localStorage with saved values
    localStorage.setItem('openroute_api_key', 'saved-api-key');
    localStorage.setItem('chat_model', 'openai/gpt-4');
    localStorage.setItem('chat_temperature', '0.5');
    localStorage.setItem('chat_stream', 'false');
    
    // Re-initialize
    document.dispatchEvent(new Event('DOMContentLoaded'));
    
    // Check that values were loaded
    const apiKeyInput = document.getElementById('openroute-api-key');
    const modelSelect = document.getElementById('model-select');
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    const streamToggle = document.getElementById('stream-toggle');
    
    expect(apiKeyInput.value).toBe('saved-api-key');
    expect(modelSelect.value).toBe('openai/gpt-4');
    expect(temperatureSlider.value).toBe('0.5');
    expect(temperatureValue.textContent).toBe('0.5');
    expect(streamToggle.checked).toBe(false);
    
    // Chat should be enabled
    const chatInput = document.getElementById('chat-input');
    expect(chatInput.disabled).toBe(false);
  });
  
  test('should clear chat history when clear button is clicked', () => {
    // Set up chat with a message
    const chatMessages = document.getElementById('chat-messages');
    
    // Add a message to localStorage
    localStorage.setItem('chat_messages', JSON.stringify([{
      role: 'user',
      content: 'Test message',
      timestamp: new Date().toISOString()
    }]));
    
    // Re-initialize to load the message
    document.dispatchEvent(new Event('DOMContentLoaded'));
    
    // Clear history
    const clearHistoryButton = document.getElementById('clear-history');
    clearHistoryButton.click();
    
    // Check that confirm was called
    expect(window.confirm).toHaveBeenCalled();
    
    // Check that localStorage was cleared
    expect(localStorage.removeItem).toHaveBeenCalledWith('chat_messages');
    
    // Check that UI was reset
    expect(chatMessages.innerHTML).toContain('Welcome to Neo N3 MCP Chat');
  });
}); 