/**
 * HTTP Server for Neo N3 MCP
 *
 * This module provides an HTTP server that exposes the Neo N3 MCP functionality
 * through a RESTful API.
 */

import * as http from 'http';
import { AddressInfo } from 'net';
import * as neonJs from '@cityofzion/neon-js';

import { NeoService, NeoNetwork } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { ContractService } from './contracts/contract-service';
import { logger } from './utils/logger';

export class HttpServer {
  private server: http.Server;
  private neoService: NeoService;
  private walletService: WalletService;
  private contractService: ContractService;

  constructor(
    neoService: NeoService,
    walletService: WalletService,
    contractService: ContractService,
    port: number = 3000
  ) {
    this.neoService = neoService;
    this.walletService = walletService;
    this.contractService = contractService;

    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.listen(port, () => {
      logger.info('HTTP server listening', { port: this.getPort() ?? port });
    });

    logger.info('HTTP server initialized', {
      neoService: Boolean(this.neoService),
      walletService: Boolean(this.walletService),
      contractService: Boolean(this.contractService)
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const path = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    try {
      logger.info('HTTP request', { method, path });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (path === '/health' && method === 'GET') {
        const health = await this.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
        logger.info('HTTP response', { method, path, statusCode });
        return;
      }

      if (path === '/metrics' && method === 'GET') {
        const metrics = await this.buildMetrics();
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(metrics);
        logger.info('HTTP response', { method, path, statusCode: 200 });
        return;
      }

      let body: any = {};
      if (method === 'POST' || method === 'PUT') {
        body = await this.parseRequestBody(req);
      }

      let result: any;
      let statusCode = 200;

      if (path === '/api/blockchain/info' && method === 'GET') {
        result = await this.neoService.getBlockchainInfo();
      } else if (path === '/api/blockchain/height' && method === 'GET') {
        const height = await this.neoService.getBlockCount();
        result = { height };
      } else if (path.match(/^\/api\/blocks\/[^/]+$/) && method === 'GET') {
        const rawBlockRef = path.split('/').pop() || '';
        const blockRef = /^\d+$/.test(rawBlockRef) ? Number.parseInt(rawBlockRef, 10) : rawBlockRef;
        result = await this.neoService.getBlock(blockRef);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+$/) && method === 'GET') {
        const txid = path.split('/').pop() || '';
        result = await this.neoService.getTransaction(txid);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+\/application-log$/) && method === 'GET') {
        const txid = path.split('/')[3] || '';
        result = await this.neoService.getApplicationLog(txid);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+\/wait$/) && method === 'GET') {
        const txid = path.split('/')[3] || '';
        const timeoutMs = parsedUrl.searchParams.get('timeoutMs');
        const pollIntervalMs = parsedUrl.searchParams.get('pollIntervalMs');
        const includeApplicationLog = parsedUrl.searchParams.get('includeApplicationLog');
        result = await this.neoService.waitForTransaction(txid, {
          timeoutMs: timeoutMs ? Number.parseInt(timeoutMs, 10) : undefined,
          pollIntervalMs: pollIntervalMs ? Number.parseInt(pollIntervalMs, 10) : undefined,
          includeApplicationLog: includeApplicationLog === 'true'
        });
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/balance$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        result = await this.neoService.getBalance(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/unclaimed-gas$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        result = await this.neoService.getUnclaimedGas(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep17-transfers$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        const fromTimestampMs = parsedUrl.searchParams.get('fromTimestampMs');
        const toTimestampMs = parsedUrl.searchParams.get('toTimestampMs');
        const parsedFromTimestampMs = fromTimestampMs !== null ? Number.parseInt(fromTimestampMs, 10) : undefined;
        const parsedToTimestampMs = toTimestampMs !== null ? Number.parseInt(toTimestampMs, 10) : undefined;

        if (parsedFromTimestampMs !== undefined && Number.isNaN(parsedFromTimestampMs)) {
          throw new Error(`Invalid fromTimestampMs: ${fromTimestampMs}`);
        }

        if (parsedToTimestampMs !== undefined && Number.isNaN(parsedToTimestampMs)) {
          throw new Error(`Invalid toTimestampMs: ${toTimestampMs}`);
        }

        result = await this.neoService.getNep17Transfers(address, {
          ...(parsedFromTimestampMs !== undefined ? { fromTimestampMs: parsedFromTimestampMs } : {}),
          ...(parsedToTimestampMs !== undefined ? { toTimestampMs: parsedToTimestampMs } : {}),
        });
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep11-balances$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        result = await this.neoService.getNep11Balances(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep11-transfers$/) && method === 'GET') {
        const address = path.split('/')[3] || '';
        const fromTimestampMs = parsedUrl.searchParams.get('fromTimestampMs');
        const toTimestampMs = parsedUrl.searchParams.get('toTimestampMs');
        const parsedFromTimestampMs = fromTimestampMs !== null ? Number.parseInt(fromTimestampMs, 10) : undefined;
        const parsedToTimestampMs = toTimestampMs !== null ? Number.parseInt(toTimestampMs, 10) : undefined;

        if (parsedFromTimestampMs !== undefined && Number.isNaN(parsedFromTimestampMs)) {
          throw new Error(`Invalid fromTimestampMs: ${fromTimestampMs}`);
        }

        if (parsedToTimestampMs !== undefined && Number.isNaN(parsedToTimestampMs)) {
          throw new Error(`Invalid toTimestampMs: ${toTimestampMs}`);
        }

        result = await this.neoService.getNep11Transfers(address, {
          ...(parsedFromTimestampMs !== undefined ? { fromTimestampMs: parsedFromTimestampMs } : {}),
          ...(parsedToTimestampMs !== undefined ? { toTimestampMs: parsedToTimestampMs } : {}),
        });
      } else if (path === '/api/wallets' && method === 'POST') {
        if (!body.password) {
          statusCode = 400;
          result = { error: 'Missing required parameter: password' };
        } else {
          result = await this.walletService.createWallet(body.password);
        }
      } else if (path.match(/^\/api\/wallets\/[A-Za-z0-9]+$/) && method === 'GET') {
        const address = path.split('/').pop() || '';
        const wallet = await this.walletService.getWallet(address);
        const { encryptedPrivateKey, ...sanitizedWallet } = wallet;
        result = sanitizedWallet;
      } else if (path === '/api/wallets/import' && method === 'POST') {
        const key = body.key || body.privateKeyOrWIF;
        if (!key) {
          statusCode = 400;
          result = { error: 'Missing required parameter: key (WIF or private key)' };
        } else {
          try {
            result = await this.walletService.importWallet(key, body.password);
          } catch (error) {
            statusCode = 500;
            result = {
              error: 'Wallet import failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
      } else if (path === '/api/transfers' && method === 'POST') {
        const fromWIF = body.fromWIF || body.wif;
        if (!body.confirm) {
          statusCode = 400;
          result = { error: 'Missing required parameter: confirm=true' };
        } else if (!fromWIF) {
          statusCode = 400;
          result = { error: 'Missing required parameter: fromWIF' };
        } else if (!body.toAddress) {
          statusCode = 400;
          result = { error: 'Missing required parameter: toAddress' };
        } else if (!body.asset) {
          statusCode = 400;
          result = { error: 'Missing required parameter: asset' };
        } else if (body.amount === undefined || body.amount === null || body.amount === '') {
          statusCode = 400;
          result = { error: 'Missing required parameter: amount' };
        } else {
          const account = new neonJs.wallet.Account(fromWIF);
          result = await this.neoService.transferAssets(account, body.toAddress, body.asset, body.amount);
        }
      } else if (path === '/api/transfers/estimate-fees' && method === 'POST') {
        if (!body.fromAddress) {
          statusCode = 400;
          result = { error: 'Missing required parameter: fromAddress' };
        } else if (!body.toAddress) {
          statusCode = 400;
          result = { error: 'Missing required parameter: toAddress' };
        } else if (!body.asset) {
          statusCode = 400;
          result = { error: 'Missing required parameter: asset' };
        } else if (body.amount === undefined || body.amount === null || body.amount === '') {
          statusCode = 400;
          result = { error: 'Missing required parameter: amount' };
        } else {
          result = await this.neoService.calculateTransferFee(body.fromAddress, body.toAddress, body.asset, body.amount);
        }
      } else if (path === '/api/accounts/claim-gas' && method === 'POST') {
        const fromWIF = body.fromWIF || body.wif;
        if (!body.confirm) {
          statusCode = 400;
          result = { error: 'Missing required parameter: confirm=true' };
        } else if (!fromWIF) {
          statusCode = 400;
          result = { error: 'Missing required parameter: fromWIF' };
        } else {
          const account = new neonJs.wallet.Account(fromWIF);
          result = await this.neoService.claimGas(account);
        }
      } else if (path === '/api/network/mode' && method === 'GET') {
        const network = this.neoService.getNetwork();
        result = { mode: network === NeoNetwork.MAINNET ? 'mainnet' : 'testnet' };
      } else if (path.match(/^\/api\/contracts\/[A-Za-z0-9]+$/) && method === 'GET') {
        const contractReference = path.split('/')[3] || '';
        const contract = this.contractService.getContract(contractReference);
        const available = await this.contractService.isContractDeployed(contractReference);
        const operations = {
          ...this.contractService.getContractOperations(contractReference),
          available
        };
        const scriptHash = this.contractService.getContractScriptHash(contractReference);
        result = {
          name: contract.name,
          description: contract.description,
          scriptHash,
          operations,
          network: this.contractService.getNetwork(),
          available
        };
      } else if (path === '/api/contracts/invoke/estimate-fees' && method === 'POST') {
        const hasNamedContract = typeof body.contractName === 'string' && body.contractName.trim().length > 0 && !body.scriptHash;
        if (hasNamedContract) {
          await this.contractService.assertContractDeployed(body.contractName.trim());
        }
        const scriptHash = body.scriptHash || (body.contractName ? this.contractService.getContractScriptHash(body.contractName) : '');
        const operation = body.operation || '';
        const args = body.args || [];
        if (!body.signerAddress) {
          statusCode = 400;
          result = { error: 'Missing required parameter: signerAddress' };
        } else if (!scriptHash) {
          statusCode = 400;
          result = { error: 'Missing required parameter: scriptHash or contractName' };
        } else if (!operation) {
          statusCode = 400;
          result = { error: 'Missing required parameter: operation' };
        } else {
          result = await this.neoService.calculateInvokeFee(body.signerAddress, scriptHash, operation, args);
        }
      } else if (path === '/api/contracts/invoke' && method === 'POST') {
        const scriptHash = body.scriptHash || '';
        const contractName = typeof body.contractName === 'string' ? body.contractName.trim() : '';
        const operation = body.operation || '';
        const args = body.args || [];
        const useNamedContract = !scriptHash && Boolean(contractName);
        if (!scriptHash && !contractName) {
          statusCode = 400;
          result = { error: 'Missing required parameter: scriptHash or contractName' };
        } else if (!operation) {
          statusCode = 400;
          result = { error: 'Missing required parameter: operation' };
        } else {
          if (useNamedContract) {
            await this.contractService.assertContractDeployed(contractName);
          }
          if (body.fromWIF) {
            if (!body.confirm) {
              statusCode = 400;
              result = { error: 'Missing required parameter: confirm=true' };
            } else {
              const account = new neonJs.wallet.Account(body.fromWIF);
              result = useNamedContract
                ? await this.contractService.invokeWriteContract(account, contractName, operation, args)
                : await this.neoService.invokeContract(account, scriptHash, operation, args);
            }
          } else {
            result = useNamedContract
              ? await this.contractService.invokeReadContract(contractName, operation, args)
              : await this.neoService.invokeReadContract(scriptHash, operation, args);
          }
        }
      } else if (path.match(/^\/api\/contracts\/[A-Za-z0-9]+\/invoke$/) && method === 'POST') {
        const contractName = path.split('/')[3] || '';
        const operation = body.operation || '';
        const args = body.args || [];
        await this.contractService.assertContractDeployed(contractName);
        result = await this.contractService.invokeReadContract(contractName, operation, args);
      } else if (path === '/api/contracts/deploy' && method === 'POST') {
        const fromWIF = body.fromWIF || body.wif;
        if (!body.confirm) {
          statusCode = 400;
          result = { error: 'Missing required parameter: confirm=true' };
        } else if (!fromWIF) {
          statusCode = 400;
          result = { error: 'Missing required parameter: fromWIF' };
        } else if (!body.script) {
          statusCode = 400;
          result = { error: 'Missing required parameter: script' };
        } else if (!body.manifest) {
          statusCode = 400;
          result = { error: 'Missing required parameter: manifest' };
        } else {
          try {
            result = await this.contractService.deployContract(fromWIF, body.script, body.manifest);
          } catch (error) {
            statusCode = 500;
            result = {
              error: 'Contract deployment failed',
              details: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }
      } else {
        statusCode = 404;
        result = { error: 'Not found' };
      }

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      logger.info('HTTP response', { method, path, statusCode });
    } catch (error) {
      logger.error('Error handling HTTP request', {
        method,
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      let statusCode = 500;
      let errorMessage = 'Internal server error';
      let errorDetails = null;

      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('Not found') || error.message.includes('not deployed')) {
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

        errorDetails = error.message;
      }

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        path,
        method
      }));
    }
  }

  private async getHealthStatus(): Promise<Record<string, unknown>> {
    try {
      const height = await this.neoService.getBlockCount();
      return {
        status: 'healthy',
        network: this.neoService.getNetwork(),
        height,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        network: this.neoService.getNetwork(),
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async buildMetrics(): Promise<string> {
    let blockHeight = -1;

    try {
      blockHeight = await this.neoService.getBlockCount();
    } catch {
      blockHeight = -1;
    }

    const labels = `network="${this.neoService.getNetwork()}"`;
    return [
      '# HELP neo_n3_mcp_uptime_seconds Process uptime in seconds.',
      '# TYPE neo_n3_mcp_uptime_seconds gauge',
      `neo_n3_mcp_uptime_seconds ${process.uptime().toFixed(3)}`,
      '# HELP neo_n3_mcp_network_info Current network mode marker.',
      '# TYPE neo_n3_mcp_network_info gauge',
      `neo_n3_mcp_network_info{${labels}} 1`,
      '# HELP neo_n3_mcp_block_height Latest observed block height.',
      '# TYPE neo_n3_mcp_block_height gauge',
      `neo_n3_mcp_block_height{${labels}} ${blockHeight}`,
      ''
    ].join('\n');
  }

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

  public getAddress(): string | AddressInfo | null {
    return this.server.address();
  }

  public getPort(): number | null {
    const address = this.server.address();
    return typeof address === 'object' && address ? address.port : null;
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
