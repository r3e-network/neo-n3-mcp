/**
 * HTTP Server for Neo MCP
 *
 * This module provides an HTTP server that exposes the Neo MCP functionality
 * through a RESTful API.
 */

import * as http from 'http';
import { AddressInfo } from 'net';
import { createHash, timingSafeEqual } from 'crypto';

import {
  MAX_TRANSACTION_WAIT_TIMEOUT_MS,
  MIN_TRANSACTION_POLL_INTERVAL_MS,
  NeoService,
  NeoNetwork,
} from './services/neo-service';
import { sanitizeWalletMetadata, WalletService } from './services/wallet-service';
import { ContractService, EncodedNef } from './contracts/contract-service';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rate-limiter';
import { RateLimitError, ValidationError } from './utils/errors';
import { normalizeScriptHash, tryGetScriptHashFromAddress } from './metadata/known-accounts';
import { SubmissionOutcomeUnknownError } from './utils/rpc-deadline';
import { validateAddress, validateHash, validateInteger, validateTokenAmount } from './utils/validation';
import { WriteCoordinator, WriteOperationName } from './services/write-coordinator';
import type { WriteOperationRecord } from './services/write-operation-service';
import {
  createTrustedProxyBlockList,
  resolveForwardedClientAddress,
} from './utils/trusted-proxy';

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 10_000;
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 10_000;
const DEFAULT_HEALTH_CACHE_TTL_MS = 5_000;

export interface HttpServerOptions {
  host?: string;
  apiKey?: string;
  corsOrigins?: string[];
  trustedProxies?: string[];
  maxBodyBytes?: number;
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
  shutdownGraceMs?: number;
  healthCacheTtlMs?: number;
  writesEnabled?: boolean;
  walletAdministrationEnabled?: boolean;
  writeApprovalApiKey?: string;
  writeCoordinator?: WriteCoordinator;
}

class HttpRequestError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

export class HttpServer {
  private server: http.Server;
  private readonly startup: Promise<void>;
  private neoService: NeoService;
  private walletService: WalletService;
  private contractService: ContractService;
  private options: Required<Omit<HttpServerOptions, 'apiKey' | 'writeApprovalApiKey' | 'writeCoordinator'>>
    & Pick<HttpServerOptions, 'apiKey' | 'writeApprovalApiKey'>;
  private readonly writeCoordinator?: WriteCoordinator;
  private readonly activeWaitControllers = new Set<AbortController>();
  private readonly trustedProxyBlockList: ReturnType<typeof createTrustedProxyBlockList>;
  private healthStatusCache: { expiresAt: number; value: Record<string, unknown> } | null = null;
  private healthStatusRequest: Promise<Record<string, unknown>> | null = null;

  constructor(
    neoService: NeoService,
    walletService: WalletService,
    contractService: ContractService,
    port: number = 3000,
    options: HttpServerOptions = {}
  ) {
    const host = options.host?.trim() || '127.0.0.1';
    const normalizedHost = host.toLowerCase();
    const isLoopback = normalizedHost === 'localhost' ||
      normalizedHost === '127.0.0.1' ||
      normalizedHost === '::1' ||
      normalizedHost === '[::1]';
    if (!isLoopback && !options.apiKey) {
      throw new Error('An API key is required when binding to a non-loopback host');
    }
    if (options.apiKey !== undefined && Buffer.byteLength(options.apiKey, 'utf8') < 32) {
      throw new Error('The API key must contain at least 32 bytes');
    }
    if (options.writeApprovalApiKey !== undefined
      && Buffer.byteLength(options.writeApprovalApiKey, 'utf8') < 32) {
      throw new Error('The write approval API key must contain at least 32 bytes');
    }
    if (options.writesEnabled && !options.writeCoordinator) {
      throw new Error('A write coordinator is required when state-changing operations are enabled');
    }
    if (options.writesEnabled && !options.writeApprovalApiKey) {
      throw new Error('A write approval API key is required when state-changing operations are enabled');
    }
    if (options.apiKey && options.writeApprovalApiKey === options.apiKey) {
      throw new Error('The write approval API key must differ from the request API key');
    }

    const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.requirePositiveInteger(maxBodyBytes, 'maxBodyBytes');
    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const headersTimeoutMs = options.headersTimeoutMs ?? DEFAULT_HEADERS_TIMEOUT_MS;
    const keepAliveTimeoutMs = options.keepAliveTimeoutMs ?? DEFAULT_KEEP_ALIVE_TIMEOUT_MS;
    const shutdownGraceMs = options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;
    const healthCacheTtlMs = options.healthCacheTtlMs ?? DEFAULT_HEALTH_CACHE_TTL_MS;
    this.requirePositiveInteger(requestTimeoutMs, 'requestTimeoutMs');
    this.requirePositiveInteger(headersTimeoutMs, 'headersTimeoutMs');
    this.requirePositiveInteger(keepAliveTimeoutMs, 'keepAliveTimeoutMs');
    this.requirePositiveInteger(shutdownGraceMs, 'shutdownGraceMs');
    this.requirePositiveInteger(healthCacheTtlMs, 'healthCacheTtlMs');
    if (headersTimeoutMs > requestTimeoutMs) {
      throw new Error('headersTimeoutMs must not exceed requestTimeoutMs');
    }

    this.neoService = neoService;
    this.walletService = walletService;
    this.contractService = contractService;
    this.writeCoordinator = options.writeCoordinator;
    this.options = {
      host,
      apiKey: options.apiKey,
      corsOrigins: (options.corsOrigins ?? []).map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return origin;
        }
      }),
      trustedProxies: options.trustedProxies ?? [],
      maxBodyBytes,
      requestTimeoutMs,
      headersTimeoutMs,
      keepAliveTimeoutMs,
      shutdownGraceMs,
      healthCacheTtlMs,
      writesEnabled: options.writesEnabled ?? false,
      walletAdministrationEnabled: options.walletAdministrationEnabled ?? false,
      writeApprovalApiKey: options.writeApprovalApiKey,
    };
    this.trustedProxyBlockList = createTrustedProxyBlockList(this.options.trustedProxies);

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res).catch((error) => {
        logger.error('Unhandled HTTP request failure', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        } else {
          res.destroy();
        }
      });
    });
    this.server.requestTimeout = requestTimeoutMs;
    this.server.headersTimeout = headersTimeoutMs;
    this.server.keepAliveTimeout = keepAliveTimeoutMs;
    this.startup = new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.removeListener('error', onError);
        logger.info('HTTP server listening', {
          host: this.options.host,
          port: this.getPort() ?? port,
        });
        resolve();
      };

      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(port, this.options.host);
    });
    void this.startup.catch(() => undefined);

    logger.info('HTTP server initialized', {
      neoService: Boolean(this.neoService),
      walletService: Boolean(this.walletService),
      contractService: Boolean(this.contractService)
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const method = req.method || 'GET';
    let path = '/';

    try {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(req.url || '/', 'http://localhost');
      } catch {
        throw new HttpRequestError(400, 'Invalid request URL');
      }
      path = parsedUrl.pathname || '';
      this.applyResponseHeaders(req, res);

      logger.info('HTTP request', { method, path });

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const isPublicProbe = method === 'GET' && (path === '/live' || path === '/health');
      if (!isPublicProbe) {
        const clientIp = this.getClientAddress(req);
        try {
          rateLimiter.checkLimit(clientIp);
        } catch (error) {
          if (error instanceof RateLimitError) {
            res.writeHead(429, {
              'Content-Type': 'application/json',
              'Retry-After': String((error.details as Record<string, unknown>)?.retryAfter || 60)
            });
            res.end(JSON.stringify({ error: error.message }));
            return;
          }
          throw error;
        }
      }

      if (!this.isAuthorized(req, path)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer'
        });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const isWalletAdministrationRoute = method === 'POST'
        && (path === '/api/wallets' || path === '/api/wallets/import');
      if (isWalletAdministrationRoute && !this.options.walletAdministrationEnabled) {
        req.resume();
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Wallet administration is disabled' }));
        return;
      }

      const isWriteRoute = (method === 'POST' && (
        path === '/api/transfers'
        || path === '/api/accounts/claim-gas'
        || path === '/api/contracts/deploy'
        || path === '/api/contracts/invoke/write'
      )) || path.match(/^\/api\/write-intents\/[^/]+(?:\/approve)?$/);
      if (isWriteRoute && !this.options.writesEnabled) {
        req.resume();
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'State-changing operations are disabled' }));
        return;
      }

      if (path === '/live' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'alive',
          timestamp: new Date().toISOString()
        }));
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

      let body: Record<string, unknown> = {};
      if (method === 'POST' || method === 'PUT') {
        body = await this.parseRequestBody(req);
      }

      let result: unknown;
      let statusCode = 200;
      const decodePathSegment = (index: number) => {
        try {
          return decodeURIComponent(path.split('/')[index] || '');
        } catch {
          throw new HttpRequestError(400, 'Invalid encoded path segment');
        }
      };

      if (path === '/api/blockchain/info' && method === 'GET') {
        result = await this.neoService.getBlockchainInfo();
      } else if (path === '/api/blockchain/height' && method === 'GET') {
        const blockCount = await this.neoService.getBlockCount();
        result = { blockCount, height: Math.max(0, blockCount - 1) };
      } else if (path.match(/^\/api\/blocks\/[^/]+$/) && method === 'GET') {
        const rawBlockRef = path.split('/').pop() || '';
        const blockRef = /^\d+$/.test(rawBlockRef)
          ? validateInteger(rawBlockRef)
          : validateHash(rawBlockRef);
        result = await this.neoService.getBlock(blockRef);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+$/) && method === 'GET') {
        const txid = validateHash(path.split('/').pop() || '');
        result = await this.neoService.getTransaction(txid);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+\/application-log$/) && method === 'GET') {
        const txid = validateHash(path.split('/')[3] || '');
        result = await this.neoService.getApplicationLog(txid);
      } else if (path.match(/^\/api\/transactions\/(?:0x)?[0-9a-fA-F]+\/wait$/) && method === 'GET') {
        const txid = validateHash(path.split('/')[3] || '');
        const timeoutMs = this.parsePositiveIntegerQuery(
          parsedUrl.searchParams.get('timeoutMs'),
          'timeoutMs'
        );
        const pollIntervalMs = this.parsePositiveIntegerQuery(
          parsedUrl.searchParams.get('pollIntervalMs'),
          'pollIntervalMs'
        );
        const includeApplicationLog = this.parseBooleanQuery(
          parsedUrl.searchParams.get('includeApplicationLog'),
          'includeApplicationLog'
        );
        if (timeoutMs !== undefined && timeoutMs > MAX_TRANSACTION_WAIT_TIMEOUT_MS) {
          throw new HttpRequestError(400, `timeoutMs must not exceed ${MAX_TRANSACTION_WAIT_TIMEOUT_MS}`);
        }
        if (pollIntervalMs !== undefined && pollIntervalMs < MIN_TRANSACTION_POLL_INTERVAL_MS) {
          throw new HttpRequestError(400, `pollIntervalMs must be at least ${MIN_TRANSACTION_POLL_INTERVAL_MS}`);
        }
        const controller = new AbortController();
        const abortWait = () => controller.abort();
        this.activeWaitControllers.add(controller);
        req.once('aborted', abortWait);
        res.once('close', abortWait);
        try {
          result = await this.neoService.waitForTransaction(txid, {
            timeoutMs,
            pollIntervalMs,
            includeApplicationLog: includeApplicationLog ?? false,
            signal: controller.signal,
          });
        } finally {
          req.removeListener('aborted', abortWait);
          res.removeListener('close', abortWait);
          this.activeWaitControllers.delete(controller);
        }
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/balance$/) && method === 'GET') {
        const address = validateAddress(path.split('/')[3] || '');
        result = await this.neoService.getBalance(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/unclaimed-gas$/) && method === 'GET') {
        const address = validateAddress(path.split('/')[3] || '');
        result = await this.neoService.getUnclaimedGas(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep17-transfers$/) && method === 'GET') {
        const address = validateAddress(path.split('/')[3] || '');
        const fromTimestampMs = parsedUrl.searchParams.get('fromTimestampMs');
        const toTimestampMs = parsedUrl.searchParams.get('toTimestampMs');
        const parsedFromTimestampMs = this.parseNonNegativeIntegerQuery(fromTimestampMs, 'fromTimestampMs');
        const parsedToTimestampMs = this.parseNonNegativeIntegerQuery(toTimestampMs, 'toTimestampMs');

        result = await this.neoService.getNep17Transfers(address, {
          ...(parsedFromTimestampMs !== undefined ? { fromTimestampMs: parsedFromTimestampMs } : {}),
          ...(parsedToTimestampMs !== undefined ? { toTimestampMs: parsedToTimestampMs } : {}),
        });
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep11-balances$/) && method === 'GET') {
        const address = validateAddress(path.split('/')[3] || '');
        result = await this.neoService.getNep11Balances(address);
      } else if (path.match(/^\/api\/accounts\/[A-Za-z0-9]+\/nep11-transfers$/) && method === 'GET') {
        const address = validateAddress(path.split('/')[3] || '');
        const fromTimestampMs = parsedUrl.searchParams.get('fromTimestampMs');
        const toTimestampMs = parsedUrl.searchParams.get('toTimestampMs');
        const parsedFromTimestampMs = this.parseNonNegativeIntegerQuery(fromTimestampMs, 'fromTimestampMs');
        const parsedToTimestampMs = this.parseNonNegativeIntegerQuery(toTimestampMs, 'toTimestampMs');

        result = await this.neoService.getNep11Transfers(address, {
          ...(parsedFromTimestampMs !== undefined ? { fromTimestampMs: parsedFromTimestampMs } : {}),
          ...(parsedToTimestampMs !== undefined ? { toTimestampMs: parsedToTimestampMs } : {}),
        });
      } else if (path === '/api/wallets' && method === 'POST') {
        if (!body.password) {
          statusCode = 400;
          result = { error: 'Missing required parameter: password' };
        } else {
          const wallet = await this.walletService.createWallet(
            this.requireNonEmptyString(body.password, 'password')
          );
          result = sanitizeWalletMetadata(wallet);
        }
      } else if (path.match(/^\/api\/wallets\/[A-Za-z0-9]+$/) && method === 'GET') {
        const address = path.split('/').pop() || '';
        const wallet = await this.walletService.getWallet(address);
        result = sanitizeWalletMetadata(wallet);
      } else if (path === '/api/wallets/import' && method === 'POST') {
        const key = body.key || body.privateKeyOrWIF;
        if (!key) {
          statusCode = 400;
          result = { error: 'Missing required parameter: key (WIF or private key)' };
        } else {
          const password = body.password === undefined
            ? undefined
            : this.requireNonEmptyString(body.password, 'password');
          const wallet = await this.walletService.importWallet(
            this.requireNonEmptyString(key, 'key'),
            password
          );
          result = sanitizeWalletMetadata(wallet);
        }
      } else if (path === '/api/transfers' && method === 'POST') {
        this.rejectSecretWriteFields(body);
        result = this.reserveWriteIntent(req, 'transfer_assets', body, {
          toAddress: validateAddress(this.requireNonEmptyString(body.toAddress, 'toAddress')),
          asset: this.requireNonEmptyString(body.asset, 'asset'),
          amount: this.requireAmount(body.amount),
        });
        statusCode = 202;
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
          result = await this.neoService.calculateTransferFee(
            this.requireNonEmptyString(body.fromAddress, 'fromAddress'),
            this.requireNonEmptyString(body.toAddress, 'toAddress'),
            this.requireNonEmptyString(body.asset, 'asset'),
            this.requireAmount(body.amount)
          );
        }
      } else if (path === '/api/accounts/claim-gas' && method === 'POST') {
        this.rejectSecretWriteFields(body);
        result = this.reserveWriteIntent(req, 'claim_gas', body, {});
        statusCode = 202;
      } else if (path === '/api/network/mode' && method === 'GET') {
        const network = this.neoService.getNetwork();
        result = { mode: network === NeoNetwork.MAINNET ? 'mainnet' : 'testnet' };
      } else if (path.match(/^\/api\/contracts\/[^/]+\/status$/) && method === 'GET') {
        const contractReference = decodePathSegment(3);
        result = await this.contractService.getContractStatus(contractReference);
      } else if (path.match(/^\/api\/contracts\/[^/]+$/) && method === 'GET') {
        const contractReference = decodePathSegment(3);
        result = await this.contractService.getContractInfo(contractReference);
      } else if (path === '/api/contracts/invoke/estimate-fees' && method === 'POST') {
        const contractReference = typeof body.contract === 'string' && body.contract.trim().length > 0
          ? body.contract.trim()
          : typeof body.contractName === 'string' && body.contractName.trim().length > 0
            ? body.contractName.trim()
            : '';
        const hasNamedContract = Boolean(contractReference) && !body.scriptHash;
        if (hasNamedContract) {
          await this.contractService.assertContractDeployed(contractReference);
        }
        const scriptHash = body.scriptHash || (contractReference
          ? await this.contractService.resolveContractScriptHash(contractReference)
          : '');
        const operation = body.operation || '';
        const args = body.args === undefined ? [] : body.args;
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
          result = await this.neoService.calculateInvokeFee(
            this.requireNonEmptyString(body.signerAddress, 'signerAddress'),
            this.requireNonEmptyString(scriptHash, 'scriptHash'),
            this.requireNonEmptyString(operation, 'operation'),
            this.requireArray(args, 'args')
          );
        }
      } else if (path === '/api/contracts/invoke' && method === 'POST') {
        const scriptHash = body.scriptHash || '';
        const contractReference = typeof body.contract === 'string' && body.contract.trim().length > 0
          ? body.contract.trim()
          : typeof body.contractName === 'string'
            ? body.contractName.trim()
            : '';
        const operation = body.operation || '';
        const args = body.args === undefined ? [] : body.args;
        const useNamedContract = !scriptHash && Boolean(contractReference);
        const writeRequested = this.hasSecretWriteField(body) || Object.prototype.hasOwnProperty.call(body, 'confirm');
        if (!scriptHash && !contractReference) {
          statusCode = 400;
          result = { error: 'Missing required parameter: scriptHash or contract' };
        } else if (!operation) {
          statusCode = 400;
          result = { error: 'Missing required parameter: operation' };
        } else {
          if (useNamedContract) {
            await this.contractService.assertContractDeployed(contractReference);
          }
          if (writeRequested) {
            throw new HttpRequestError(
              400,
              'State-changing contract calls must use /api/contracts/invoke/write without private key or confirm fields'
            );
          } else {
            result = useNamedContract
              ? await this.contractService.invokeReadContract(
                  contractReference,
                  this.requireNonEmptyString(operation, 'operation'),
                  this.requireArray(args, 'args')
                )
              : await this.neoService.invokeReadContract(
                  this.requireNonEmptyString(scriptHash, 'scriptHash'),
                  this.requireNonEmptyString(operation, 'operation'),
                  this.requireArray(args, 'args')
                );
          }
        }
      } else if (path === '/api/contracts/invoke/write' && method === 'POST') {
        this.rejectSecretWriteFields(body);
        const scriptHash = this.resolveExplicitWriteScriptHash(
          this.requireNonEmptyString(body.scriptHash, 'scriptHash')
        );
        await this.contractService.assertContractDeployed(scriptHash);
        result = this.reserveWriteIntent(req, 'invoke_contract_write', body, {
          scriptHash,
          operation: this.requireNonEmptyString(body.operation, 'operation'),
          args: this.requireArray(body.args, 'args'),
        });
        statusCode = 202;
      } else if (path.match(/^\/api\/contracts\/[^/]+\/invoke$/) && method === 'POST') {
        const contractName = decodePathSegment(3);
        const operation = body.operation || '';
        const args = body.args === undefined ? [] : body.args;
        await this.contractService.assertContractDeployed(contractName);
        result = await this.contractService.invokeReadContract(
          contractName,
          this.requireNonEmptyString(operation, 'operation'),
          this.requireArray(args, 'args')
        );
      } else if (path === '/api/contracts/deploy' && method === 'POST') {
        this.rejectSecretWriteFields(body);
        const nef = this.requireEncodedNef(body.nef);
        const manifest = this.requireRecord(body.manifest, 'manifest');
        this.contractService.validateDeploymentArtifacts(nef, manifest);
        result = this.reserveWriteIntent(req, 'deploy_contract', body, {
          nef,
          manifest,
        });
        statusCode = 202;
      } else if (path.match(/^\/api\/write-intents\/[0-9a-f]{64}$/) && method === 'GET') {
        result = this.publicWriteRecord(this.requireWriteCoordinator().get(path.split('/')[3]));
      } else if (path.match(/^\/api\/write-intents\/[0-9a-f]{64}\/approve$/) && method === 'POST') {
        const intentId = path.split('/')[3];
        const fingerprint = this.requireNonEmptyString(body.fingerprint, 'fingerprint');
        this.requireWriteCoordinator().approve(intentId, fingerprint);
        result = await this.requireWriteCoordinator().execute(
          intentId,
          this.neoService,
          this.contractService,
        );
      } else {
        statusCode = 404;
        result = { error: 'Not found' };
      }

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      logger.info('HTTP response', { method, path, statusCode });
    } catch (error) {
      if (res.destroyed || res.writableEnded) {
        return;
      }
      if (error instanceof HttpRequestError) {
        logger.warn('Rejected HTTP request', {
          method,
          path,
          statusCode: error.statusCode,
          reason: error.message,
        });
        res.writeHead(error.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      logger.error('Error handling HTTP request', {
        method,
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      let statusCode = 500;
      let errorMessage = 'Internal server error';
      let errorDetails = null;
      let exposeErrorDetails = false;

      if (error instanceof ValidationError) {
        statusCode = 400;
        errorMessage = 'Bad request';
        errorDetails = error.message;
      } else if (error instanceof RateLimitError) {
        statusCode = 429;
        errorMessage = 'Too many requests';
        errorDetails = error.message;
      } else if (error instanceof SubmissionOutcomeUnknownError) {
        statusCode = 504;
        errorMessage = 'Transaction submission outcome unknown';
        errorDetails = error.message;
        exposeErrorDetails = true;
      } else if (error instanceof Error) {
        if (
          /(?:Neo RPC returned|RPC network mismatch|(?:Neo RPC|N3Index) response exceeds|N3Index request failed|ECONNREFUSED|ENOTFOUND)/i
            .test(error.message)
        ) {
          statusCode = 502;
          errorMessage = 'Bad gateway';
        } else if (
          /(?:not found|not deployed|unknown transaction|unknown block|unknown contract|unable to resolve contract reference)/i
            .test(error.message)
        ) {
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
        } else if (/tim(?:eout|ed out)/i.test(error.message)) {
          statusCode = 504;
          errorMessage = 'Gateway timeout';
        }

        errorDetails = error.message;
      }

      const errorResponse = {
        error: errorMessage,
        ...((statusCode < 500 || exposeErrorDetails) && errorDetails ? { details: errorDetails } : {}),
        path,
        method
      };
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse));
    }
  }

  private getHealthStatus(): Promise<Record<string, unknown>> {
    const now = Date.now();
    if (this.healthStatusCache && this.healthStatusCache.expiresAt > now) {
      return Promise.resolve(this.healthStatusCache.value);
    }
    if (this.healthStatusRequest) {
      return this.healthStatusRequest;
    }

    const request = this.fetchHealthStatus()
      .then((value) => {
        this.healthStatusCache = {
          expiresAt: Date.now() + this.options.healthCacheTtlMs,
          value,
        };
        return value;
      })
      .finally(() => {
        if (this.healthStatusRequest === request) {
          this.healthStatusRequest = null;
        }
      });
    this.healthStatusRequest = request;
    return request;
  }

  private async fetchHealthStatus(): Promise<Record<string, unknown>> {
    try {
      const blockCount = await this.neoService.getBlockCount();
      return {
        status: 'healthy',
        network: this.neoService.getNetwork(),
        blockCount,
        height: Math.max(0, blockCount - 1),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Neo RPC readiness check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        status: 'unhealthy',
        network: this.neoService.getNetwork(),
        error: 'Neo RPC unavailable',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async buildMetrics(): Promise<string> {
    let blockHeight = -1;

    try {
      const blockCount = await this.neoService.getBlockCount();
      blockHeight = Math.max(0, blockCount - 1);
    } catch {
      blockHeight = -1;
    }

    const labels = `network="${this.neoService.getNetwork()}"`;
    return [
      '# HELP neo_mcp_uptime_seconds Process uptime in seconds.',
      '# TYPE neo_mcp_uptime_seconds gauge',
      `neo_mcp_uptime_seconds ${process.uptime().toFixed(3)}`,
      '# HELP neo_mcp_network_info Current network mode marker.',
      '# TYPE neo_mcp_network_info gauge',
      `neo_mcp_network_info{${labels}} 1`,
      '# HELP neo_mcp_block_height Latest observed block height.',
      '# TYPE neo_mcp_block_height gauge',
      `neo_mcp_block_height{${labels}} ${blockHeight}`,
      ''
    ].join('\n');
  }

  private requireNonEmptyString(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new HttpRequestError(400, `${name} must be a non-empty string`);
    }
    return value;
  }

  private requireAmount(value: unknown): string {
    try {
      return validateTokenAmount(value);
    } catch (error) {
      throw new HttpRequestError(
        400,
        error instanceof Error ? error.message : 'amount must be a positive decimal string'
      );
    }
  }

  private requireArray(value: unknown, name: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new HttpRequestError(400, `${name} must be an array`);
    }
    return value;
  }

  private requireRecord(value: unknown, name: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpRequestError(400, `${name} must be an object`);
    }
    return value as Record<string, unknown>;
  }

  private requireEncodedNef(value: unknown): EncodedNef {
    const nef = this.requireRecord(value, 'nef');
    if (nef.encoding !== 'hex' && nef.encoding !== 'base64') {
      throw new HttpRequestError(400, 'nef.encoding must be "hex" or "base64"');
    }
    return {
      encoding: nef.encoding,
      data: this.requireNonEmptyString(nef.data, 'nef.data'),
    };
  }

  private parsePositiveIntegerQuery(value: string | null, name: string): number | undefined {
    if (value === null) {
      return undefined;
    }

    if (!/^\d+$/.test(value)) {
      throw new HttpRequestError(400, `${name} must be a positive integer`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new HttpRequestError(400, `${name} must be a positive integer`);
    }

    return parsed;
  }

  private parseNonNegativeIntegerQuery(value: string | null, name: string): number | undefined {
    if (value === null) {
      return undefined;
    }
    if (!/^\d+$/.test(value)) {
      throw new HttpRequestError(400, `${name} must be a non-negative integer`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new HttpRequestError(400, `${name} must be a non-negative safe integer`);
    }
    return parsed;
  }

  private requirePositiveInteger(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive safe integer`);
    }
  }

  private parseBooleanQuery(value: string | null, name: string): boolean | undefined {
    if (value === null) {
      return undefined;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    throw new HttpRequestError(400, `${name} must be true or false`);
  }

  private resolveExplicitWriteScriptHash(reference: string): string {
    const normalizedHash = normalizeScriptHash(reference);
    if (normalizedHash) {
      return normalizedHash;
    }

    try {
      const addressScriptHash = tryGetScriptHashFromAddress(reference);
      if (addressScriptHash) {
        return addressScriptHash;
      }
    } catch {
      // The user-facing error below intentionally covers both names and invalid addresses.
    }

    throw new HttpRequestError(
      400,
      'Signed contract writes require an explicit script hash or Neo address; name-based resolution is read-only.'
    );
  }

  private parseRequestBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const contentTypeHeader = req.headers['content-type'];
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
      const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
      const declaredLength = Number(req.headers['content-length'] || 0);
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      if (contentType && mediaType !== 'application/json') {
        req.resume();
        fail(new HttpRequestError(415, 'Content-Type must be application/json'));
        return;
      }

      if (Number.isFinite(declaredLength) && declaredLength > this.options.maxBodyBytes) {
        req.resume();
        fail(new HttpRequestError(413, `Request body exceeds ${this.options.maxBodyBytes} bytes`));
        return;
      }

      const onData = (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;

        if (receivedBytes > this.options.maxBodyBytes) {
          req.removeListener('data', onData);
          req.resume();
          fail(new HttpRequestError(413, `Request body exceeds ${this.options.maxBodyBytes} bytes`));
          return;
        }

        chunks.push(buffer);
      };

      req.on('data', onData);
      req.on('end', () => {
        if (settled) return;
        settled = true;
        const body = Buffer.concat(chunks).toString('utf8');

        if (!body) {
          resolve({});
          return;
        }

        if (!contentType) {
          reject(new HttpRequestError(415, 'Content-Type must be application/json'));
          return;
        }

        try {
          const parsed: unknown = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            reject(new HttpRequestError(400, 'Request body must be a JSON object'));
            return;
          }
          resolve(parsed as Record<string, unknown>);
        } catch (error) {
          reject(error instanceof HttpRequestError
            ? error
            : new HttpRequestError(400, 'Request body must contain valid JSON'));
        }
      });
      req.on('error', (error) => {
        fail(error);
      });
    });
  }

  private reserveWriteIntent(
    req: http.IncomingMessage,
    operation: WriteOperationName,
    body: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const network = this.requireWriteNetwork(body.network);
    const idempotencyHeader = req.headers['idempotency-key'];
    if (Array.isArray(idempotencyHeader)) {
      throw new HttpRequestError(400, 'Idempotency-Key must be provided exactly once');
    }
    const idempotencyKey = this.requireNonEmptyString(idempotencyHeader, 'Idempotency-Key');
    const record = this.requireWriteCoordinator().reserve(idempotencyKey, {
      operation,
      network,
      payload,
    });
    return this.publicWriteRecord(record);
  }

  private requireWriteNetwork(value: unknown): NeoNetwork {
    const network = this.requireNonEmptyString(value, 'network');
    if (network !== NeoNetwork.MAINNET && network !== NeoNetwork.TESTNET) {
      throw new HttpRequestError(400, 'network must be mainnet or testnet');
    }
    if (network !== this.neoService.getNetwork()) {
      throw new HttpRequestError(
        400,
        `network must match the configured HTTP network ${this.neoService.getNetwork()}`
      );
    }
    return network;
  }

  private requireWriteCoordinator(): WriteCoordinator {
    if (!this.options.writesEnabled || !this.writeCoordinator) {
      throw new HttpRequestError(403, 'State-changing operations are disabled');
    }
    return this.writeCoordinator;
  }

  private hasSecretWriteField(body: Record<string, unknown>): boolean {
    return [
      'fromWIF',
      'wif',
      'privateKey',
      'privateKeyOrWIF',
      'password',
      'key',
    ].some((field) => Object.prototype.hasOwnProperty.call(body, field));
  }

  private rejectSecretWriteFields(body: Record<string, unknown>): void {
    if (this.hasSecretWriteField(body) || Object.prototype.hasOwnProperty.call(body, 'confirm')) {
      throw new HttpRequestError(
        400,
        'Write requests must not contain private key, wallet credential, password, or legacy confirm fields'
      );
    }
  }

  private publicWriteRecord(record: WriteOperationRecord): Record<string, unknown> {
    return {
      intentId: record.intentId,
      fingerprint: record.fingerprint,
      state: record.state,
      operation: record.operation,
      network: record.network,
      signerAddress: record.signerAddress,
      payload: record.payload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.txid ? { txid: record.txid } : {}),
      ...(record.validUntilBlock ? { validUntilBlock: record.validUntilBlock } : {}),
      ...(record.result ? { result: record.result } : {}),
      ...(record.error ? { error: record.error } : {}),
    };
  }

  private applyResponseHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (origin && this.options.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
      res.setHeader('Vary', 'Origin');
    }
  }

  private isAuthorized(req: http.IncomingMessage, path: string): boolean {
    const isPublicProbe = req.method === 'GET' && (path === '/health' || path === '/live');
    if (isPublicProbe) {
      return true;
    }

    const isApprovalRoute = req.method === 'POST'
      && /^\/api\/write-intents\/[0-9a-f]{64}\/approve$/.test(path);
    const expectedKey = isApprovalRoute
      ? this.options.writeApprovalApiKey
      : this.options.apiKey;
    if (!expectedKey) return !isApprovalRoute;

    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string'
      ? /^Bearer (.+)$/i.exec(authorization)
      : null;
    if (!match) {
      return false;
    }

    const expected = createHash('sha256').update(expectedKey, 'utf8').digest();
    const provided = createHash('sha256').update(match[1], 'utf8').digest();
    return timingSafeEqual(expected, provided);
  }

  private getClientAddress(req: http.IncomingMessage): string {
    const remoteAddress = req.socket.remoteAddress || 'unknown';
    const forwardedHeader = req.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader;
    return resolveForwardedClientAddress(
      remoteAddress,
      forwardedValue,
      this.trustedProxyBlockList,
    );
  }

  public getAddress(): string | AddressInfo | null {
    return this.server.address();
  }

  public getPort(): number | null {
    const address = this.server.address();
    return typeof address === 'object' && address ? address.port : null;
  }

  public ready(): Promise<void> {
    return this.startup;
  }

  public async stop(): Promise<void> {
    for (const controller of this.activeWaitControllers) {
      controller.abort();
    }
    this.activeWaitControllers.clear();

    try {
      await this.startup;
    } catch {
      return;
    }

    if (!this.server.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const forceCloseTimer = setTimeout(() => {
        this.server.closeAllConnections();
      }, this.options.shutdownGraceMs);
      forceCloseTimer.unref?.();

      this.server.close((error) => {
        clearTimeout(forceCloseTimer);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
      this.server.closeIdleConnections();
    });
  }
}
