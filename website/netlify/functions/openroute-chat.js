/**
 * OpenRoute Chat Function for Neo N3 MCP
 * 
 * This function handles communication with OpenRoute API for chatting
 * with an AI model that has Neo N3 MCP capabilities.
 */

const axios = require('axios');

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { 
      apiKey,
      model = 'openai/gpt-3.5-turbo',
      messages,
      temperature = 0.7,
      stream = false
    } = data;
    
    // Validate request
    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OpenRoute API key is required' })
      };
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Messages array is required and must not be empty' })
      };
    }
    
    // Add Neo N3 MCP system message if not already present
    let chatMessages = [...messages];
    if (!chatMessages.some(msg => msg.role === 'system')) {
      chatMessages.unshift({
        role: 'system',
        content: `You are an AI assistant with knowledge of the Neo N3 blockchain and integrated access to the Model Context Protocol (MCP). You can help users understand blockchain concepts and perform actual blockchain operations through the Neo N3 MCP server.

You can execute the following MCP operations on behalf of users:

1. get_blockchain_info - Get general blockchain information (parameters: network)
   Example: {{mcp:get_blockchain_info:{"network":"mainnet"}}}

2. get_balance - Check the balance of a NEO address (parameters: address, network)
   Example: {{mcp:get_balance:{"address":"NUVPACMnKFhpuHxsHbNDcpGXgpxM5qr6hX","network":"mainnet"}}}

3. get_block - Get information about a specific block (parameters: block_height or block_hash, network)
   Example: {{mcp:get_block:{"block_height":10000,"network":"mainnet"}}}
   Example: {{mcp:get_block:{"block_hash":"0x..hash..","network":"testnet"}}}

4. get_transaction - Get details of a transaction (parameters: tx_hash, network)
   Example: {{mcp:get_transaction:{"tx_hash":"0x..tx-hash..","network":"mainnet"}}}

5. call_contract - Call a smart contract method (parameters: contract_hash, method, args, network)
   Example: {{mcp:call_contract:{"contract_hash":"0x..hash..","method":"balanceOf","args":["NUVPACMnKFhpuHxsHbNDcpGXgpxM5qr6hX"],"network":"mainnet"}}}

6. list_operations - List all available MCP operations (useful for debugging)
   Example: {{mcp:list_operations:{}}}

When a user asks to perform any of these operations, detect their intent and format your response like this:

"I'll execute that for you using Neo N3 MCP. Here's the result: {{mcp:operation_name:{"param1":"value1","param2":"value2"}}}"

IMPORTANT: Ensure proper JSON formatting of parameters - this is critical for operations to work correctly.

This special syntax will be detected by the chat interface and replaced with actual blockchain data from the Neo N3 MCP server. Always provide clear explanations after showing the results.

If users report "is not a function" errors, suggest they try the diagnostic command: "{{mcp:list_operations:{}}}" to see which operations are currently available.`
      });
    }
    
    // Call OpenRoute API
    const openRouteResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: chatMessages,
        temperature,
        max_tokens: 1024,
        stream
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://neo-n3-mcp.netlify.app/',
          'X-Title': 'Neo N3 MCP Chat'
        },
      }
    );
    
    // Handle streaming response if enabled
    if (stream) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: openRouteResponse.data
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: openRouteResponse.data.choices[0].message,
        model: openRouteResponse.data.model,
        usage: openRouteResponse.data.usage
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    // Extract relevant error info from OpenRoute API response
    let errorMessage = 'Server error';
    let errorDetails = {};
    
    if (error.response && error.response.data) {
      errorMessage = error.response.data.error?.message || 'API error';
      errorDetails = error.response.data;
    } else {
      errorMessage = error.message || 'Unknown error';
    }
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      })
    };
  }
}; 