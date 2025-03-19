/**
 * API Playground UI Component
 * 
 * This script provides a user interface for testing the Neo N3 MCP API
 * through the Netlify Functions. It allows users to select operations,
 * configure parameters, and view results.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Find API playground container if it exists
  const playgroundContainer = document.getElementById('api-playground');
  if (!playgroundContainer) return;
  
  // Operation configurations
  const operations = {
    getBlockchainInfo: {
      name: 'Get Blockchain Info',
      description: 'Retrieve general information about the Neo N3 blockchain',
      endpoint: '/.netlify/functions/api-playground',
      method: 'POST',
      params: [
        {
          name: 'network',
          type: 'select',
          options: ['mainnet', 'testnet'],
          default: 'testnet',
          description: 'The Neo N3 network to query'
        }
      ]
    },
    getBlock: {
      name: 'Get Block',
      description: 'Retrieve information about a specific block by height',
      endpoint: '/.netlify/functions/api-playground',
      method: 'POST',
      params: [
        {
          name: 'network',
          type: 'select',
          options: ['mainnet', 'testnet'],
          default: 'testnet',
          description: 'The Neo N3 network to query'
        },
        {
          name: 'blockHeight',
          type: 'number',
          default: 1000,
          description: 'The height of the block to query'
        }
      ]
    },
    getBalance: {
      name: 'Get Address Balance',
      description: 'Check the balance of a Neo N3 address',
      endpoint: '/.netlify/functions/balance-checker',
      method: 'GET',
      params: [
        {
          name: 'address',
          type: 'text',
          default: '',
          placeholder: 'Neo N3 address (e.g., NXV7ZhHiyM1aHXwvUNBLNAkCwZ6wgeKyMZ)',
          description: 'The Neo N3 address to check'
        },
        {
          name: 'network',
          type: 'select',
          options: ['mainnet', 'testnet'],
          default: 'testnet',
          description: 'The Neo N3 network to query'
        }
      ]
    }
  };
  
  // Build the operation selector
  let operationOptions = '';
  Object.keys(operations).forEach(key => {
    operationOptions += `<option value="${key}">${operations[key].name}</option>`;
  });
  
  // Create the playground UI
  playgroundContainer.innerHTML = `
    <div class="api-playground-container">
      <div class="operation-selector">
        <label for="operation-select">Select Operation:</label>
        <select id="operation-select" class="form-select">
          ${operationOptions}
        </select>
      </div>
      
      <div class="operation-description" id="operation-description"></div>
      
      <div class="parameters-container" id="parameters-container"></div>
      
      <div class="action-buttons">
        <button id="execute-btn" class="btn btn-primary">Execute</button>
        <button id="get-code-btn" class="btn btn-secondary">Get Code</button>
      </div>
      
      <div class="results-container">
        <div class="results-header">
          <h4>Results</h4>
          <button id="copy-results-btn" class="btn btn-sm btn-outline-secondary">Copy</button>
        </div>
        <pre id="results-output" class="results-output">No results yet. Execute an operation to see results.</pre>
      </div>
      
      <div id="code-snippet-modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Code Snippet</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <ul class="nav nav-tabs" id="code-tabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="js-tab" data-bs-toggle="tab" data-bs-target="#js" type="button" role="tab">JavaScript</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="python-tab" data-bs-toggle="tab" data-bs-target="#python" type="button" role="tab">Python</button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="curl-tab" data-bs-toggle="tab" data-bs-target="#curl" type="button" role="tab">cURL</button>
                </li>
              </ul>
              <div class="tab-content pt-3" id="code-content">
                <div class="tab-pane fade show active" id="js" role="tabpanel">
                  <pre id="js-code" class="code-snippet"></pre>
                  <button id="copy-js-btn" class="btn btn-sm btn-outline-secondary">Copy</button>
                </div>
                <div class="tab-pane fade" id="python" role="tabpanel">
                  <pre id="python-code" class="code-snippet"></pre>
                  <button id="copy-python-btn" class="btn btn-sm btn-outline-secondary">Copy</button>
                </div>
                <div class="tab-pane fade" id="curl" role="tabpanel">
                  <pre id="curl-code" class="code-snippet"></pre>
                  <button id="copy-curl-btn" class="btn btn-sm btn-outline-secondary">Copy</button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const operationSelect = document.getElementById('operation-select');
  const parametersContainer = document.getElementById('parameters-container');
  const operationDescription = document.getElementById('operation-description');
  const executeBtn = document.getElementById('execute-btn');
  const getCodeBtn = document.getElementById('get-code-btn');
  const resultsOutput = document.getElementById('results-output');
  const copyResultsBtn = document.getElementById('copy-results-btn');
  
  // Copy buttons for code snippets
  const copyJsBtn = document.getElementById('copy-js-btn');
  const copyPythonBtn = document.getElementById('copy-python-btn');
  const copyCurlBtn = document.getElementById('copy-curl-btn');
  
  // Function to update parameter UI based on selected operation
  function updateParameterUI() {
    const selectedOperation = operationSelect.value;
    const operation = operations[selectedOperation];
    
    // Clear the container
    parametersContainer.innerHTML = '';
    
    // Update description
    operationDescription.textContent = operation.description;
    
    // Add parameter inputs
    operation.params.forEach(param => {
      const paramContainer = document.createElement('div');
      paramContainer.classList.add('parameter');
      
      const label = document.createElement('label');
      label.setAttribute('for', `param-${param.name}`);
      label.textContent = param.name;
      
      const tooltip = document.createElement('span');
      tooltip.classList.add('parameter-description');
      tooltip.textContent = param.description;
      label.appendChild(tooltip);
      
      let input;
      
      if (param.type === 'select') {
        input = document.createElement('select');
        input.classList.add('form-select');
        
        param.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option;
          optionEl.textContent = option;
          if (option === param.default) {
            optionEl.selected = true;
          }
          input.appendChild(optionEl);
        });
      } else {
        input = document.createElement('input');
        input.type = param.type;
        input.classList.add('form-control');
        
        if (param.default !== undefined) {
          input.value = param.default;
        }
        
        if (param.placeholder) {
          input.placeholder = param.placeholder;
        }
      }
      
      input.id = `param-${param.name}`;
      input.dataset.paramName = param.name;
      
      paramContainer.appendChild(label);
      paramContainer.appendChild(input);
      parametersContainer.appendChild(paramContainer);
    });
  }
  
  // Function to get parameter values
  function getParameterValues() {
    const params = {};
    const selectedOperation = operationSelect.value;
    const operation = operations[selectedOperation];
    
    operation.params.forEach(param => {
      const input = document.getElementById(`param-${param.name}`);
      let value = input.value;
      
      // Convert to appropriate type
      if (param.type === 'number') {
        value = parseInt(value, 10);
      }
      
      params[param.name] = value;
    });
    
    return params;
  }
  
  // Execute the operation
  async function executeOperation() {
    try {
      resultsOutput.textContent = 'Loading...';
      
      const selectedOperation = operationSelect.value;
      const operation = operations[selectedOperation];
      const params = getParameterValues();
      
      let response;
      
      if (operation.method === 'GET') {
        // Build URL with query parameters
        const queryString = Object.entries(params)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        
        const url = `${operation.endpoint}?${queryString}`;
        response = await fetch(url);
      } else {
        // For POST requests
        const requestData = {
          endpoint: selectedOperation
        };
        
        // Add parameters if needed
        if (Object.keys(params).length > 0) {
          // Special handling for API playground endpoint
          if (operation.endpoint === '/.netlify/functions/api-playground') {
            // Extract network parameter
            const network = params.network;
            delete params.network;
            
            requestData.network = network;
            requestData.params = params;
          } else {
            // For other endpoints, pass all params
            Object.assign(requestData, params);
          }
        }
        
        response = await fetch(operation.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      }
      
      const result = await response.json();
      resultsOutput.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      resultsOutput.textContent = `Error: ${error.message}`;
    }
  }
  
  // Get code snippets
  async function getCodeSnippets() {
    try {
      const selectedOperation = operationSelect.value;
      const params = getParameterValues();
      
      // Call the code generator function
      const response = await fetch('/.netlify/functions/code-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation,
          params: params
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate code snippets');
      }
      
      const data = await response.json();
      
      // Show the modal
      const codeSnippetModal = new bootstrap.Modal(document.getElementById('code-snippet-modal'));
      
      // Set code snippets
      document.getElementById('js-code').textContent = data.code;
      
      // Get Python and cURL code as well
      const pythonResponse = await fetch('/.netlify/functions/code-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation,
          language: 'python',
          params: params
        })
      });
      
      const pythonData = await pythonResponse.json();
      document.getElementById('python-code').textContent = pythonData.code;
      
      const curlResponse = await fetch('/.netlify/functions/code-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation,
          language: 'curl',
          params: params
        })
      });
      
      const curlData = await curlResponse.json();
      document.getElementById('curl-code').textContent = curlData.code;
      
      codeSnippetModal.show();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }
  
  // Copy results to clipboard
  function copyResults() {
    navigator.clipboard.writeText(resultsOutput.textContent)
      .then(() => {
        // Show copied toast or indicator
        copyResultsBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyResultsBtn.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }
  
  // Copy code snippets to clipboard
  function copyCodeSnippet(codeId, buttonId) {
    const code = document.getElementById(codeId);
    const button = document.getElementById(buttonId);
    
    navigator.clipboard.writeText(code.textContent)
      .then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }
  
  // Add event listeners
  operationSelect.addEventListener('change', updateParameterUI);
  executeBtn.addEventListener('click', executeOperation);
  getCodeBtn.addEventListener('click', getCodeSnippets);
  copyResultsBtn.addEventListener('click', copyResults);
  
  // Code copy buttons
  copyJsBtn.addEventListener('click', () => copyCodeSnippet('js-code', 'copy-js-btn'));
  copyPythonBtn.addEventListener('click', () => copyCodeSnippet('python-code', 'copy-python-btn'));
  copyCurlBtn.addEventListener('click', () => copyCodeSnippet('curl-code', 'copy-curl-btn'));
  
  // Initialize the UI with the first operation
  updateParameterUI();
}); 