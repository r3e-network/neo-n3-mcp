/**
 * Balance Checker Function for Neo N3 MCP
 * 
 * This function provides a simple way to check balances of Neo N3 addresses
 * on mainnet or testnet, returning formatted results with token information.
 */

const axios = require('axios');

// Configuration
const NODE_URLS = {
  mainnet: 'https://mainnet1.neo.coz.io:443',
  testnet: 'https://testnet1.neo.coz.io:443'
};

// Common token contract hashes
const TOKEN_CONTRACTS = {
  mainnet: {
    NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
    GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf'
  },
  testnet: {
    NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
    GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf'
  }
};

// Token metadata
const TOKEN_METADATA = {
  NEO: {
    name: 'NEO',
    symbol: 'NEO',
    decimals: 0
  },
  GAS: {
    name: 'GAS',
    symbol: 'GAS',
    decimals: 8
  }
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

// Format balance with proper decimals
function formatBalance(balance, decimals) {
  return decimals === 0 
    ? balance 
    : (parseInt(balance) / Math.pow(10, decimals)).toFixed(decimals);
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
  const address = params.address;
  const network = params.network || 'testnet';
  
  if (!address) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Address parameter is required'
      })
    };
  }
  
  try {
    // Get all NEP-17 balances for the address
    const balanceResponse = await makeRpcRequest(network, 'getnep17balances', [address]);
    
    if (!balanceResponse.result || !balanceResponse.result.balances) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          network,
          balances: []
        })
      };
    }
    
    // Process and enhance balance data
    const balances = balanceResponse.result.balances.map(balance => {
      // Identify known tokens
      let tokenInfo = { decimals: 0, symbol: 'Unknown' };
      let knownToken = false;
      
      Object.entries(TOKEN_CONTRACTS[network] || {}).forEach(([symbol, hash]) => {
        if (balance.assethash.toLowerCase() === hash.toLowerCase()) {
          tokenInfo = TOKEN_METADATA[symbol];
          knownToken = true;
        }
      });
      
      return {
        assetHash: balance.assethash,
        name: balance.name || tokenInfo.name || 'Unknown Token',
        symbol: balance.symbol || tokenInfo.symbol,
        amount: balance.amount,
        formatted: formatBalance(balance.amount, tokenInfo.decimals),
        decimals: tokenInfo.decimals,
        isKnownToken: knownToken
      };
    });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        network,
        balances
      })
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