/**
 * HTTP Server for Neo N3 MCP
 *
 * This module provides an HTTP server that exposes the Neo N3 MCP functionality
 * through a RESTful API.
 */

import * as http from 'http';
import * as url from 'url';
import { NeoService, NeoNetwork } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { ContractService } from './contracts/contract-service';

export class HttpServer {
  private server: http.Server;
  private neoService: NeoService;
  private walletService: WalletService;
  private contractService: ContractService;

  constructor(
    neoService: NeoService,
    walletService: WalletService,
    contractService: ContractService,
    port: number = 3002
  ) {
    this.neoService = neoService;
    this.walletService = walletService;
    this.contractService = contractService;

    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.listen(port, () => {
      console.log(`HTTP server listening on port ${port}`);
    });

    // Log the server initialization
    console.log('HTTP server initialized with:');
    console.log(`- Neo Service: ${this.neoService ? 'Available' : 'Not available'}`);
    console.log(`- Wallet Service: ${this.walletService ? 'Available' : 'Not available'}`);
    console.log(`- Contract Service: ${this.contractService ? 'Available' : 'Not available'}`);
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Define these variables outside the try block so they're available in the catch block
    const parsedUrl = url.parse(req.url || '', true);
    const path = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    try {
      console.log(`HTTP ${method} ${path}`);

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight requests
      if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parse request body for POST/PUT requests
      let body: any = {};
      if (method === 'POST' || method === 'PUT') {
        body = await this.parseRequestBody(req);
      }

      // Route the request
      let result: any;
      let statusCode = 200;

      // Blockchain routes
      if (path === '/api/blockchain/info' && method === 'GET') {
        result = await this.neoService.getBlockchainInfo();
      } else if (path === '/api/blockchain/height' && method === 'GET') {
        const height = await this.neoService.getBlockCount();
        result = { height };
      } else if (path.match(/^\/api\/blocks\/\d+$/) && method === 'GET') {
        const blockHeight = parseInt(path.split('/').pop() || '0');
        result = await this.neoService.getBlock(blockHeight);
      } else if (path.match(/^\/api\/transactions\/[0-9a-fA-F]+$/) && method === 'GET') {
        const txid = path.split('/').pop() || '';
        result = await this.neoService.getTransaction(txid);
      }
      // Account routes
      else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/balance$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        result = await this.neoService.getBalance(address);
      }
      // Wallet routes
      else if (path === '/api/wallets' && method === 'POST') {
        const password = body.password || 'password';
        result = await this.walletService.createWallet(password);
      } else if (path.match(/^\/api\/wallets\/[A-Za-z0-9]+$/) && method === 'GET') {
        const address = path.split('/').pop() || '';
        result = await this.walletService.getWallet(address);
      }
      // Network routes
      else if (path === '/api/network/mode' && method === 'GET') {
        const network = this.neoService.getNetwork();
        const mode = network === NeoNetwork.MAINNET ? 'mainnet' : 'testnet';
        result = { mode };
      }
      // Contract routes
      else if (path.match(/^\/api\/contracts\/[A-Za-z0-9]+\/invoke$/) && method === 'POST') {
        const contractName = path.split('/')[3] || '';
        const operation = body.operation || '';
        const args = body.args || [];
        result = await this.contractService.invokeReadContract(contractName, operation, args);
      }
      // Contract deployment
      else if (path === '/api/contracts/deploy' && method === 'POST') {
        // Validate required parameters
        if (!body.wif) {
          statusCode = 400;
          result = { error: 'Missing required parameter: wif' };
        } else if (!body.script) {
          statusCode = 400;
          result = { error: 'Missing required parameter: script' };
        } else if (!body.manifest) {
          statusCode = 400;
          result = { error: 'Missing required parameter: manifest' };
        } else {
          try {
            // Deploy the contract
            result = await this.contractService.deployContract(
              body.wif,
              body.script,
              body.manifest
            );
          } catch (error) {
            statusCode = 500;
            result = {
              error: 'Contract deployment failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
      }
      // Wallet import
      else if (path === '/api/wallets/import' && method === 'POST') {
        // Validate required parameters
        if (!body.key) {
          statusCode = 400;
          result = { error: 'Missing required parameter: key (WIF or private key)' };
        } else {
          try {
            const password = body.password || 'password';
            result = await this.walletService.importWallet(body.key, password);
          } catch (error) {
            statusCode = 500;
            result = {
              error: 'Wallet import failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
      } else {
        statusCode = 404;
        result = { error: 'Not found' };
      }

      // Send the response
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      const responseBody = JSON.stringify(result);
      res.end(responseBody);

      console.log(`HTTP Response ${statusCode}: ${responseBody.substring(0, 100)}${responseBody.length > 100 ? '...' : ''}`);
    } catch (error) {
      // Log the error with detailed information
      console.error('Error handling request:', {
        requestMethod: method,
        requestPath: path,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Determine the appropriate status code based on the error type
      let statusCode = 500;
      let errorMessage = 'Internal server error';
      let errorDetails = null;

      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('not found') || error.message.includes('Not found')) {
          statusCode = 404;
          errorMessage = 'Resource not found';
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          statusCode = 400;
          errorMessage = 'Bad request';
        } else if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
          statusCode = 401;
          errorMessage = 'Unauthorized';
        } else if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
          statusCode = 403;
          errorMessage = 'Forbidden';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          statusCode = 504;
          errorMessage = 'Gateway timeout';
        }

        // Include the original error message as details
        errorDetails = error.message;
      }

      // Send the error response
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        path: path,
        method: method
      }));
    }
  }

  /**
   * Parse request body
   */
  private parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the server
   */
  public stop() {
    this.server.close();
  }
}
