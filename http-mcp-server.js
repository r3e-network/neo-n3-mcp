const http = require('http');
const { handleMcpRequest } = require('./dist/index');

/**
 * Neo N3 MCP HTTP Server
 *
 * This server exposes the Neo N3 MCP functionality via HTTP.
 * It provides a simple REST API for interacting with the Neo N3 blockchain.
 *
 * Endpoint: POST /mcp
 * Request format: { "name": "tool_name", "arguments": { ... } }
 * Response format: { "result": { ... } } or { "error": { "message": "...", "code": "..." } }
 */

console.log('Starting Neo N3 MCP HTTP Server...');

// Create an HTTP server
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle GET requests to /health
  if (req.method === 'GET' && req.url === '/health') {
    // Return a health check response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: require('./package.json').version,
      uptime: process.uptime()
    }));
    return;
  }

  // Only handle POST requests to /mcp
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Parse the request body
        const request = JSON.parse(body);
        console.log('Received MCP request:', request);

        // Call the MCP handler directly
        const response = await handleMcpRequest(request);
        console.log('MCP response:', response);

        // Send the response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            message: error.message,
            code: error.code || 'INTERNAL_ERROR'
          }
        }));
      }
    });
  } else {
    // Return 404 for all other requests
    res.writeHead(404);
    res.end();
  }
});

// Start the HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
  console.log(`MCP endpoint available at http://localhost:${PORT}/mcp`);
});
