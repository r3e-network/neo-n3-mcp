/**
 * Code Snippet Generator Function for Neo N3 MCP
 * 
 * This function generates code snippets for common Neo N3 MCP operations
 * based on user-specified parameters. It helps users quickly get started
 * with the Neo N3 MCP API in various programming languages.
 */

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Only accept POST requests with JSON body
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed. Please use POST.' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { operation, language = 'javascript', params = {} } = data;
    
    // Validate request
    if (!operation || !CODE_TEMPLATES[operation]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid operation. Available operations: ' + Object.keys(CODE_TEMPLATES).join(', ')
        })
      };
    }
    
    if (!CODE_TEMPLATES[operation][language]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Unsupported language for this operation. Available languages: ' + 
            Object.keys(CODE_TEMPLATES[operation]).join(', ')
        })
      };
    }
    
    // Get the code template
    const codeTemplate = CODE_TEMPLATES[operation][language];
    
    // Replace template variables with actual values
    const generatedCode = Object.entries(params).reduce((code, [key, value]) => {
      // Different replacement based on value type
      if (typeof value === 'string') {
        return code.replace(new RegExp(`{{${key}}}`, 'g'), value);
      } else if (typeof value === 'object') {
        return code.replace(new RegExp(`{{${key}}}`, 'g'), JSON.stringify(value, null, 2));
      } else {
        return code.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }, codeTemplate);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation,
        language,
        code: generatedCode
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Server error: ' + (error.message || 'Unknown error'),
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      })
    };
  }
};

// Code templates for different operations and languages
const CODE_TEMPLATES = {
  getBlockchainInfo: {
    javascript: `// Get blockchain information from Neo N3 MCP
const fetch = require('node-fetch');

async function getBlockchainInfo() {
  const response = await fetch('/.netlify/functions/api-playground', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: 'getBlockchainInfo',
      network: '{{network}}'
    })
  });
  
  const data = await response.json();
  console.log('Blockchain Info:', data.result);
  return data.result;
}

getBlockchainInfo()
  .catch(error => console.error('Error:', error));`,

    python: `# Get blockchain information from Neo N3 MCP
import requests
import json

def get_blockchain_info():
    url = "/.netlify/functions/api-playground"
    payload = {
        "endpoint": "getBlockchainInfo",
        "network": "{{network}}"
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    print("Blockchain Info:", data["result"])
    return data["result"]

try:
    get_blockchain_info()
except Exception as e:
    print("Error:", str(e))`,

    curl: `curl -X POST "/.netlify/functions/api-playground" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "getBlockchainInfo",
    "network": "{{network}}"
  }'`
  },
  
  getBlock: {
    javascript: `// Get block information from Neo N3 MCP
const fetch = require('node-fetch');

async function getBlock() {
  const response = await fetch('/.netlify/functions/api-playground', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: 'getBlock',
      network: '{{network}}',
      params: {
        blockHeight: {{blockHeight}}
      }
    })
  });
  
  const data = await response.json();
  console.log('Block Info:', data.result);
  return data.result;
}

getBlock()
  .catch(error => console.error('Error:', error));`,

    python: `# Get block information from Neo N3 MCP
import requests
import json

def get_block():
    url = "/.netlify/functions/api-playground"
    payload = {
        "endpoint": "getBlock",
        "network": "{{network}}",
        "params": {
            "blockHeight": {{blockHeight}}
        }
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    print("Block Info:", data["result"])
    return data["result"]

try:
    get_block()
except Exception as e:
    print("Error:", str(e))`,

    curl: `curl -X POST "/.netlify/functions/api-playground" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "getBlock",
    "network": "{{network}}",
    "params": {
      "blockHeight": {{blockHeight}}
    }
  }'`
  },
  
  getBalance: {
    javascript: `// Get address balance from Neo N3 MCP
const fetch = require('node-fetch');

async function getBalance() {
  const address = "{{address}}";
  const network = "{{network}}";
  
  const response = await fetch(\`/.netlify/functions/balance-checker?address=\${address}&network=\${network}\`);
  const data = await response.json();
  
  console.log('Address:', data.address);
  console.log('Network:', data.network);
  console.log('Balances:');
  
  data.balances.forEach(token => {
    console.log(\`\${token.name} (\${token.symbol}): \${token.formatted}\`);
  });
  
  return data;
}

getBalance()
  .catch(error => console.error('Error:', error));`,

    python: `# Get address balance from Neo N3 MCP
import requests

def get_balance():
    address = "{{address}}"
    network = "{{network}}"
    
    url = f"/.netlify/functions/balance-checker?address={address}&network={network}"
    response = requests.get(url)
    data = response.json()
    
    print("Address:", data["address"])
    print("Network:", data["network"])
    print("Balances:")
    
    for token in data["balances"]:
        print(f"{token['name']} ({token['symbol']}): {token['formatted']}")
    
    return data

try:
    get_balance()
except Exception as e:
    print("Error:", str(e))`,

    curl: `curl "/.netlify/functions/balance-checker?address={{address}}&network={{network}}"`
  },
  
  // MCP Server function templates
  mcpGetBlockchainInfo: {
    javascript: `// Get blockchain information using Neo N3 MCP Server with Claude
async function getBlockchainInfo() {
  // Make an MCP function call using Neo N3 MCP
  const result = await claude.mcp.callFunction("neo-n3", "get_blockchain_info", {
    network: "{{network}}"
  });
  
  // Process the result
  console.log('Blockchain Height:', result.height);
  console.log('Version:', result.version);
  console.log('Validators:', result.validators);
  
  return result;
}`,

    python: `# Get blockchain information using Neo N3 MCP Server with Claude
def get_blockchain_info():
    # Make an MCP function call using Neo N3 MCP
    result = claude.mcp.call_function("neo-n3", "get_blockchain_info", {
        "network": "{{network}}"
    })
    
    # Process the result
    print("Blockchain Height:", result["height"])
    print("Version:", result["version"])
    print("Validators:", result["validators"])
    
    return result`,

    typescript: `// Get blockchain information using Neo N3 MCP Server with Claude
async function getBlockchainInfo(): Promise<any> {
  // Make an MCP function call using Neo N3 MCP
  const result = await claude.mcp.callFunction("neo-n3", "get_blockchain_info", {
    network: "{{network}}"
  });
  
  // Process the result
  console.log('Blockchain Height:', result.height);
  console.log('Version:', result.version);
  console.log('Validators:', result.validators);
  
  return result;
}`
  },
  
  mcpTransferAssets: {
    javascript: `// Transfer assets using Neo N3 MCP Server with Claude
async function transferAssets() {
  // Make an MCP function call using Neo N3 MCP
  const result = await claude.mcp.callFunction("neo-n3", "transfer_assets", {
    fromWIF: "{{wif}}",
    toAddress: "{{toAddress}}",
    asset: "{{asset}}",
    amount: "{{amount}}",
    network: "{{network}}",
    confirm: true
  });
  
  // Process the result
  console.log('Transaction ID:', result.txid);
  console.log('Status:', result.status);
  
  return result;
}`,

    python: `# Transfer assets using Neo N3 MCP Server with Claude
def transfer_assets():
    # Make an MCP function call using Neo N3 MCP
    result = claude.mcp.call_function("neo-n3", "transfer_assets", {
        "fromWIF": "{{wif}}",
        "toAddress": "{{toAddress}}",
        "asset": "{{asset}}",
        "amount": "{{amount}}",
        "network": "{{network}}",
        "confirm": True
    })
    
    # Process the result
    print("Transaction ID:", result["txid"])
    print("Status:", result["status"])
    
    return result`,

    typescript: `// Transfer assets using Neo N3 MCP Server with Claude
async function transferAssets(): Promise<any> {
  // Make an MCP function call using Neo N3 MCP
  const result = await claude.mcp.callFunction("neo-n3", "transfer_assets", {
    fromWIF: "{{wif}}",
    toAddress: "{{toAddress}}",
    asset: "{{asset}}",
    amount: "{{amount}}",
    network: "{{network}}",
    confirm: true
  });
  
  // Process the result
  console.log('Transaction ID:', result.txid);
  console.log('Status:', result.status);
  
  return result;
}`
  }
}; 