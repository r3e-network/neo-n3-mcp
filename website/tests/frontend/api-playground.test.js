/**
 * API Playground Component Tests
 * 
 * These tests use JSDOM to test the frontend API Playground component
 */

// Mock the DOM environment for browser-like testing
const originalDocument = global.document;
const originalWindow = global.window;

describe('API Playground Component Tests', () => {
  // Before each test, setup a DOM environment
  beforeEach(() => {
    // Create a minimal HTML structure with the necessary elements
    document.body.innerHTML = `
      <div id="api-playground"></div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    `;
    
    // Mock fetch API
    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: { data: 'test data' } })
      })
    );
    
    // Mock bootstrap
    global.bootstrap = {
      Modal: class {
        show() {}
      }
    };
    
    // Load the API Playground script
    require('../../js/api-playground');
  });
  
  // After each test, restore the original document and window
  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    jest.resetModules();
  });
  
  test('should initialize the API Playground component', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Check that the component was initialized
    const playgroundContainer = document.getElementById('api-playground');
    expect(playgroundContainer.innerHTML).not.toBe('');
    
    // Check that key elements were created
    expect(document.getElementById('operation-select')).not.toBeNull();
    expect(document.getElementById('parameters-container')).not.toBeNull();
    expect(document.getElementById('execute-btn')).not.toBeNull();
    expect(document.getElementById('get-code-btn')).not.toBeNull();
    expect(document.getElementById('results-output')).not.toBeNull();
  });
  
  test('should update parameters when operation changes', () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Get the operation select element
    const operationSelect = document.getElementById('operation-select');
    
    // Initial state should show parameters for the first operation
    const firstOperationParams = document.getElementById('parameters-container').children.length;
    expect(firstOperationParams).toBeGreaterThan(0);
    
    // Change the selected operation
    operationSelect.value = 'getBlock';
    operationSelect.dispatchEvent(new Event('change'));
    
    // Parameters should update for the new operation
    const newParams = document.getElementById('parameters-container').children.length;
    expect(newParams).toBeGreaterThan(0);
    // Different operations have different numbers of parameters
    expect(document.querySelector('[data-param-name="blockHeight"]')).not.toBeNull();
  });
  
  test('should execute operation when button is clicked', async () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Set operation and parameters
    const operationSelect = document.getElementById('operation-select');
    operationSelect.value = 'getBlockchainInfo';
    operationSelect.dispatchEvent(new Event('change'));
    
    // Click execute button
    const executeBtn = document.getElementById('execute-btn');
    executeBtn.click();
    
    // Wait for fetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch should have been called
    expect(global.fetch).toHaveBeenCalled();
    
    // Results should be updated
    const resultsOutput = document.getElementById('results-output');
    expect(resultsOutput.textContent).not.toBe('No results yet. Execute an operation to see results.');
  });
  
  test('should get code snippets when button is clicked', async () => {
    // Fire DOMContentLoaded event
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
    
    // Set operation and parameters
    const operationSelect = document.getElementById('operation-select');
    operationSelect.value = 'getBlockchainInfo';
    operationSelect.dispatchEvent(new Event('change'));
    
    // Mock multiple fetch responses for different code languages
    global.fetch
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ code: 'JavaScript code' })
        })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ code: 'Python code' })
        })
      )
      .mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ code: 'cURL code' })
        })
      );
    
    // Click get code button
    const getCodeBtn = document.getElementById('get-code-btn');
    getCodeBtn.click();
    
    // Wait for fetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch should have been called multiple times (once for each language)
    expect(global.fetch).toHaveBeenCalledTimes(3);
    
    // Code snippets should be updated
    expect(document.getElementById('js-code')).not.toBeNull();
    expect(document.getElementById('python-code')).not.toBeNull();
    expect(document.getElementById('curl-code')).not.toBeNull();
  });
}); 