/**
 * Standalone Neo N3 HTTP Server for testing
 *
 * This is a simple HTTP server that can be used for testing the Neo N3 HTTP API
 * without running the full MCP server. It's useful for debugging and development.
 *
 * Usage: node tests/neo-http-server.js
 */

const http = require('http');
const { NeoService } = require('../dist/services/neo-service');
const { WalletService } = require('../dist/services/wallet-service');
const { ContractService } = require('../dist/contracts/contract-service');
const { config } = require('../dist/config');

// Create services
console.log('Creating services...');
const neoService = new NeoService(config.testnetRpcUrl, 'testnet');
const walletService = new WalletService();
const contractService = new ContractService(config.testnetRpcUrl, 'testnet');

// Create a simple HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse request body for POST/PUT requests
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      console.log(`Request body: ${body}`);

      // Parse URL
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;

      // Route the request
      let result;
      let statusCode = 200;

      // Blockchain routes
      if (path === '/api/blockchain/info' && req.method === 'GET') {
        result = await neoService.getBlockchainInfo();
      } else if (path === '/api/blockchain/height' && req.method === 'GET') {
        const height = await neoService.getBlockCount();
        result = { height };
      } else if (path.match(/^\/api\/blocks\/\d+$/) && req.method === 'GET') {
        const blockHeight = parseInt(path.split('/').pop() || '0');
        result = await neoService.getBlock(blockHeight);
      } else if (path.match(/^\/api\/transactions\/[0-9a-fA-F]+$/) && req.method === 'GET') {
        const txid = path.split('/').pop() || '';
        result = await neoService.getTransaction(txid);
      }
      // Account routes
      else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/balance$/) && req.method === 'GET') {
        const address = path.split('/')[3] || '';
        result = await neoService.getBalance(address);
      }
      // Wallet routes
      else if (path === '/api/wallets' && req.method === 'POST') {
        const password = parsedBody.password || 'password';
        result = await walletService.createWallet(password);
      }
      // Network routes
      else if (path === '/api/network/mode' && req.method === 'GET') {
        const network = neoService.getNetwork();
        const mode = network === 'mainnet' ? 'mainnet' : 'testnet';
        result = { mode };
      } else {
        statusCode = 404;
        result = { error: 'Not found' };
      }

      // Send the response
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      const responseBody = JSON.stringify(result);
      res.end(responseBody);

      console.log(`Response: ${responseBody.substring(0, 100)}${responseBody.length > 100 ? '...' : ''}`);
    } catch (error) {
      console.error('Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message || 'Unknown error' }));
    }
  });
});

// Start the server
const port = 3002;
server.listen(port, () => {
  console.log(`Neo N3 HTTP server listening on port ${port}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log('Server started');
