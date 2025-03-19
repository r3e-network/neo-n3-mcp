/**
 * API Playground Function for Neo N3 MCP
 * 
 * This function allows users to test the Neo N3 MCP API endpoints directly from the documentation.
 * It acts as a proxy to demonstrate API capabilities without requiring server setup.
 */

const axios = require('axios');

// Configuration
const NODE_URLS = {
  mainnet: 'https://mainnet1.neo.coz.io:443',
  testnet: 'https://testnet1.neo.coz.io:443'
};

// RPC method templates for common operations
const RPC_TEMPLATES = {
  getBlockchainInfo: {
    jsonrpc: "2.0",
    method: "getversion",
    params: [],
    id: 1
  },
  getBlock: {
    jsonrpc: "2.0", 
    method: "getblock",
    params: ["{{blockHeight}}", 1],
    id: 1
  },
  getBalance: {
    jsonrpc: "2.0",
    method: "getnep17balances", 
    params: ["{{address}}"],
    id: 1
  }
};

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
    const { endpoint, network = 'testnet', params = {} } = data;
    
    // Validate request
    if (!endpoint || !RPC_TEMPLATES[endpoint]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid endpoint. Available endpoints: ' + Object.keys(RPC_TEMPLATES).join(', ')
        })
      };
    }
    
    // Get the RPC template and substitute parameters
    const rpcRequest = JSON.parse(JSON.stringify(RPC_TEMPLATES[endpoint]));
    
    // Replace template variables with actual values
    const stringifiedRequest = JSON.stringify(rpcRequest);
    const processedRequest = JSON.parse(
      Object.entries(params).reduce((req, [key, value]) => {
        return req.replace(new RegExp(`"{{${key}}}"`, 'g'), typeof value === 'number' ? value : `"${value}"`);
      }, stringifiedRequest)
    );
    
    // Make the RPC call to the Neo node
    const nodeUrl = NODE_URLS[network] || NODE_URLS.testnet;
    const response = await axios.post(nodeUrl, processedRequest);
    
    // Return the result
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        result: response.data,
        request: processedRequest
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