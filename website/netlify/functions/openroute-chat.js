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
        content: 'You are an AI assistant with knowledge of the Neo N3 blockchain and access to the Model Context Protocol (MCP) for blockchain operations. You can help users understand blockchain concepts, perform operations on the Neo N3 blockchain, and interact with smart contracts through MCP functions.'
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