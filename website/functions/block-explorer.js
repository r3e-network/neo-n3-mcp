/**
 * Block Explorer Widget Function for Neo N3 MCP
 * 
 * This function provides a simplified block explorer functionality to query
 * block information and transactions from the Neo N3 blockchain.
 */

const axios = require('axios');

// Configuration
const NODE_URLS = {
  mainnet: 'https://mainnet1.neo.coz.io:443',
  testnet: 'https://testnet1.neo.coz.io:443'
};

// Helper function to make RPC requests
async function makeRpcRequest(network, method, params) {
  const nodeUrl = NODE_URLS[network] || NODE_URLS.testnet;
  
  const response = await axios.post(nodeUrl, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params
  });
  
  return response.data;
}

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
  
  // Get query parameters
  const params = event.queryStringParameters || {};
  const action = params.action;
  const network = params.network || 'testnet';
  
  try {
    let result;
    
    // Handle different actions
    switch (action) {
      case 'latestBlocks':
        // Get current blockchain height
        const heightResponse = await makeRpcRequest(network, 'getblockcount', []);
        const currentHeight = heightResponse.result - 1;
        
        // Get the latest 5 blocks
        const blockPromises = [];
        for (let i = 0; i < 5; i++) {
          if (currentHeight - i >= 0) {
            blockPromises.push(makeRpcRequest(network, 'getblock', [currentHeight - i, 1]));
          }
        }
        
        const blocks = await Promise.all(blockPromises);
        result = blocks.map(block => block.result);
        break;
        
      case 'getBlock':
        const blockHeight = parseInt(params.height);
        if (isNaN(blockHeight) && !params.hash) {
          throw new Error('Block height or hash is required');
        }
        
        const blockIdentifier = params.hash || blockHeight;
        const blockResponse = await makeRpcRequest(network, 'getblock', [blockIdentifier, 1]);
        result = blockResponse.result;
        break;
        
      case 'getTransaction':
        if (!params.txid) {
          throw new Error('Transaction ID is required');
        }
        
        const txResponse = await makeRpcRequest(network, 'getrawtransaction', [params.txid, 1]);
        result = txResponse.result;
        break;
        
      case 'getStats':
        // Get blockchain statistics
        const [blockCountResponse, versionResponse] = await Promise.all([
          makeRpcRequest(network, 'getblockcount', []),
          makeRpcRequest(network, 'getversion', [])
        ]);
        
        result = {
          blockCount: blockCountResponse.result,
          version: versionResponse.result,
          network: network
        };
        break;
        
      default:
        throw new Error('Invalid action. Supported actions: latestBlocks, getBlock, getTransaction, getStats');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.message || 'Server error',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      })
    };
  }
}; 