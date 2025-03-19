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

// Add backup RPC nodes
const BACKUP_NODE_URLS = {
  mainnet: 'https://mainnet2.neo.coz.io:443',
  testnet: 'https://testnet2.neo.coz.io:443'
};

// Helper function to make RPC requests
async function makeRpcRequest(network, method, params) {
  const nodeUrl = NODE_URLS[network] || NODE_URLS.testnet;
  console.log(`Making RPC request to ${nodeUrl} with method ${method}`);
  
  try {
    const response = await axios.post(nodeUrl, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    });
    
    console.log(`Successful RPC response for ${method}`);
    return response.data;
  } catch (error) {
    console.error(`Error with primary node: ${error.message}`);
    
    // Try backup node if primary fails
    try {
      const backupNodeUrl = BACKUP_NODE_URLS[network] || BACKUP_NODE_URLS.testnet;
      console.log(`Trying backup node ${backupNodeUrl}`);
      
      const backupResponse = await axios.post(backupNodeUrl, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      });
      
      console.log(`Successful RPC response from backup node for ${method}`);
      return backupResponse.data;
    } catch (backupError) {
      console.error(`Error with backup node: ${backupError.message}`);
      throw error; // Throw original error if backup also fails
    }
  }
}

exports.handler = async function(event, context) {
  console.log('Block explorer function invoked with query params:', event.queryStringParameters);
  
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
  
  console.log(`Processing action: ${action} on network: ${network}`);
  
  try {
    let result;
    
    // Handle different actions
    switch (action) {
      case 'latestBlocks':
        // Get current blockchain height
        console.log('Getting blockchain height');
        const heightResponse = await makeRpcRequest(network, 'getblockcount', []);
        const currentHeight = heightResponse.result - 1;
        console.log(`Current blockchain height: ${currentHeight}`);
        
        // Get the latest 5 blocks
        console.log('Fetching latest blocks');
        const blockPromises = [];
        for (let i = 0; i < 5; i++) {
          if (currentHeight - i >= 0) {
            blockPromises.push(makeRpcRequest(network, 'getblock', [currentHeight - i, 1]));
          }
        }
        
        const blocks = await Promise.all(blockPromises);
        result = blocks.map(block => block.result);
        console.log(`Successfully fetched ${result.length} blocks`);
        break;
        
      case 'getBlock':
        const blockHeight = parseInt(params.height);
        if (isNaN(blockHeight) && !params.hash) {
          throw new Error('Block height or hash is required');
        }
        
        const blockIdentifier = params.hash || blockHeight;
        console.log(`Fetching block with identifier: ${blockIdentifier}`);
        const blockResponse = await makeRpcRequest(network, 'getblock', [blockIdentifier, 1]);
        result = blockResponse.result;
        console.log('Successfully fetched block details');
        break;
        
      case 'getTransaction':
        if (!params.txid) {
          throw new Error('Transaction ID is required');
        }
        
        console.log(`Fetching transaction with ID: ${params.txid}`);
        const txResponse = await makeRpcRequest(network, 'getrawtransaction', [params.txid, 1]);
        result = txResponse.result;
        console.log('Successfully fetched transaction details');
        break;
        
      case 'getStats':
        // Get blockchain statistics
        console.log('Fetching blockchain stats');
        const [blockCountResponse, versionResponse] = await Promise.all([
          makeRpcRequest(network, 'getblockcount', []),
          makeRpcRequest(network, 'getversion', [])
        ]);
        
        result = {
          blockCount: blockCountResponse.result,
          version: versionResponse.result,
          network: network
        };
        console.log('Successfully fetched blockchain stats');
        break;
        
      default:
        throw new Error('Invalid action. Supported actions: latestBlocks, getBlock, getTransaction, getStats');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30' // Add caching to reduce load on RPC nodes
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    // Create a more detailed error response
    const errorResponse = {
      error: error.message || 'Server error',
      action: params.action,
      network: params.network,
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    };
    
    // If it's an axios error, add more details
    if (error.isAxiosError) {
      errorResponse.status = error.response?.status;
      errorResponse.data = error.response?.data;
      errorResponse.requestUrl = error.config?.url;
    }
    
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorResponse)
    };
  }
}; 