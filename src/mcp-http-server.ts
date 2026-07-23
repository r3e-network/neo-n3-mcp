/**
 * MCP Streamable HTTP transport for the Neo N3 MCP server.
 *
 * This serves the SAME MCP server that `src/index.ts` serves over stdio, but on
 * the MCP Streamable HTTP transport, so remote MCP clients can reach it over the
 * network. It is unrelated to `src/http-server.ts`, which is a custom REST API.
 *
 * Non-custodial boundary: the remote HTTP surface is READ-ONLY by design. It
 * builds a `NeoN3McpServer` per session (which does construct a wallet store),
 * but it hard-disables writes for every session (see `createReadOnlyNeoServer`),
 * so the signing/broadcast tools (`transfer_assets`, `invoke_contract_write`,
 * `claim_gas`, `deploy_contract`) are never registered on the network surface,
 * regardless of NEO_ENABLE_WRITES. The AI never holds keys and never signs.
 *
 * One MCP server instance is created per session so per-session protocol state
 * (negotiated capabilities, subscriptions) never bleeds between clients. Both
 * the transport and its MCP server are closed when a session ends, expires, or
 * the process shuts down.
 */

import * as http from 'http';
import { AddressInfo } from 'net';
import { randomUUID, timingSafeEqual } from 'crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { NeoN3McpServer } from './index';
import { config } from './config';
import { SERVER_VERSION } from './version';
import { logger } from './utils/logger';

export const DEFAULT_MCP_HTTP_PORT = 3001;
export const DEFAULT_MCP_HTTP_HOST = '127.0.0.1';
export const DEFAULT_MCP_HTTP_PATH = '/mcp';
export const DEFAULT_MCP_HTTP_MAX_SESSIONS = 128;
export const DEFAULT_MCP_HTTP_SESSION_TTL_MS = 1_800_000;
export const DEFAULT_MCP_HTTP_MAX_BODY_BYTES = 4 * 1024 * 1024;

const DEFAULT_BODY_TIMEOUT_MS = 30_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 30_000;
// Finite backstop for receiving a COMPLETE request (headers + body). A GET SSE
// carries no body, so it completes immediately and this deadline never fires on
// an established stream; it only bounds slow/partial requests that would
// otherwise pin a socket forever (server.requestTimeout = 0 disabled this).
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;
// Floor for the concurrent-connection ceiling so a bounded value is always set
// even when maxSessions is tiny.
const MIN_MAX_CONNECTIONS = 256;
const MIN_REMOTE_BEARER_BYTES = 32;
const MIN_SWEEP_INTERVAL_MS = 50;
const MAX_SWEEP_INTERVAL_MS = 30_000;
const HEALTH_PATH = '/healthz';
const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOWED_REQUEST_HEADERS =
  'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID';
const EXPOSED_RESPONSE_HEADERS = 'Mcp-Session-Id';
const PREFLIGHT_MAX_AGE_SECONDS = 600;

// JSON-RPC error codes used by the transport envelope.
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_SERVER_ERROR = -32000;
const JSON_RPC_SESSION_NOT_FOUND = -32001;

/**
 * Options for {@link McpHttpServer}. Every value has a production default; the
 * CLI entrypoint (`src/mcp-http.ts`) fills them from the documented env vars via
 * {@link resolveMcpHttpOptionsFromEnv}.
 */
export interface McpHttpServerOptions {
  /** TCP port to bind. Use 0 to let the OS pick a free port (tests). */
  port?: number;
  /** Bind address. A non-loopback address requires a bearer token. */
  host?: string;
  /** Path that serves the MCP endpoint (POST/GET/DELETE). */
  path?: string;
  /** Bearer token required on every MCP request. */
  bearerToken?: string;
  /** Browser origins allowed to call the endpoint. A request without an Origin header is always allowed. */
  allowedOrigins?: string[];
  /** Optional Host header allowlist (defense in depth against DNS rebinding). Empty means unrestricted. */
  allowedHosts?: string[];
  /** Maximum number of concurrent sessions. */
  maxSessions?: number;
  /** Maximum number of concurrent TCP connections the listener will accept. */
  maxConnections?: number;
  /** Idle time after which a session is evicted. */
  sessionTtlMs?: number;
  /** Hard cap on a POST body in bytes. */
  maxBodyBytes?: number;
  /** Deadline for reading a POST body. */
  bodyTimeoutMs?: number;
  /** Deadline for receiving complete request headers. */
  headersTimeoutMs?: number;
  /** Finite deadline for receiving a complete request; bounds slow-request socket pinning. */
  requestTimeoutMs?: number;
  /** Factory for the per-session MCP server. Defaults to a real `NeoN3McpServer`. */
  createMcpServer?: () => NeoN3McpServer;
}

interface McpHttpSession {
  readonly id: string;
  readonly transport: StreamableHTTPServerTransport;
  readonly neoServer: NeoN3McpServer;
  readonly mcpServer: McpServer;
  lastSeenMs: number;
  /** Number of open long-lived SSE streams; a session with any is never idle. */
  activeStreams: number;
  closing: boolean;
}

class BodyReadError extends Error {
  constructor(
    readonly statusCode: number,
    readonly jsonRpcCode: number,
    message: string
  ) {
    super(message);
    this.name = 'BodyReadError';
  }
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '[::1]';
}

/**
 * Mirrors `resolveHttpSecurity` in src/http.ts: a bearer token is mandatory
 * unless the server binds to a loopback address. A token that guards a remote
 * listener must also carry enough entropy to be worth guarding with.
 */
export function resolveMcpHttpBearer(host: string, bearerToken: string | undefined): string | undefined {
  if (isLoopbackHost(host)) {
    return bearerToken;
  }

  if (!bearerToken) {
    throw new Error('MCP_HTTP_BEARER is required when MCP_HTTP_HOST is not a loopback address');
  }
  if (Buffer.byteLength(bearerToken, 'utf8') < MIN_REMOTE_BEARER_BYTES) {
    throw new Error(
      `MCP_HTTP_BEARER must contain at least ${MIN_REMOTE_BEARER_BYTES} bytes when MCP_HTTP_HOST is not a loopback address`
    );
  }

  return bearerToken;
}

function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`Invalid origin: ${origin}`);
  }
  return parsed.origin;
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function readHeader(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads the MCP server instance that `NeoN3McpServer` (src/index.ts) builds and,
 * over stdio, connects inside `run()`. The field is TypeScript-`private`, which
 * is a compile-time marker only; reading it here keeps the published type
 * surface of `dist/index.d.ts` unchanged and leaves the stdio entrypoint
 * untouched. The guard turns an upstream rename into an immediate, explicit
 * startup failure instead of a confusing runtime TypeError.
 */
function getMcpServer(instance: NeoN3McpServer): McpServer {
  const candidate = (instance as unknown as { server?: unknown }).server as McpServer | undefined;
  if (!candidate || typeof candidate.connect !== 'function' || typeof candidate.close !== 'function') {
    throw new Error('NeoN3McpServer does not expose an MCP server instance to bind to a transport');
  }
  return candidate;
}

/**
 * Serves the Neo N3 MCP server over the MCP Streamable HTTP transport.
 *
 * Endpoints:
 * - `POST|GET|DELETE {path}` - the Streamable HTTP MCP endpoint (bearer protected)
 * - `GET /healthz` - liveness probe (no authentication, so a load balancer can poll it)
 */
export class McpHttpServer {
  private readonly port: number;
  private readonly host: string;
  private readonly path: string;
  private readonly bearerToken?: string;
  private readonly allowedOrigins: string[];
  private readonly allowedHosts: string[];
  private readonly maxSessions: number;
  private readonly maxConnections: number;
  private readonly sessionTtlMs: number;
  private readonly maxBodyBytes: number;
  private readonly bodyTimeoutMs: number;
  private readonly headersTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly createMcpServer: () => NeoN3McpServer;

  private readonly sessions = new Map<string, McpHttpSession>();
  private httpServer: http.Server | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private pendingSessions = 0;
  private boundPort: number | null = null;

  constructor(options: McpHttpServerOptions = {}) {
    const port = options.port ?? DEFAULT_MCP_HTTP_PORT;
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid MCP HTTP port: ${options.port}`);
    }
    const host = options.host?.trim() || DEFAULT_MCP_HTTP_HOST;
    const path = options.path?.trim() || DEFAULT_MCP_HTTP_PATH;
    if (!path.startsWith('/') || (path.length > 1 && path.endsWith('/'))) {
      throw new Error(`Invalid MCP HTTP path: ${path}. Use an absolute path without a trailing slash.`);
    }
    if (path === HEALTH_PATH) {
      throw new Error(`Invalid MCP HTTP path: ${path} is reserved for the health endpoint.`);
    }

    this.port = port;
    this.host = host;
    this.path = path;
    this.bearerToken = resolveMcpHttpBearer(host, options.bearerToken);
    this.allowedOrigins = (options.allowedOrigins ?? []).map((origin) => {
      try {
        return normalizeOrigin(origin);
      } catch {
        throw new Error(
          `Invalid MCP_HTTP_ALLOWED_ORIGINS entry "${origin}". Use comma-separated HTTP/HTTPS origins.`
        );
      }
    });
    this.allowedHosts = (options.allowedHosts ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
    this.maxSessions = requirePositiveInteger(
      options.maxSessions ?? DEFAULT_MCP_HTTP_MAX_SESSIONS,
      'maxSessions'
    );
    this.maxConnections = requirePositiveInteger(
      options.maxConnections ?? Math.max(MIN_MAX_CONNECTIONS, this.maxSessions * 4),
      'maxConnections'
    );
    this.sessionTtlMs = requirePositiveInteger(
      options.sessionTtlMs ?? DEFAULT_MCP_HTTP_SESSION_TTL_MS,
      'sessionTtlMs'
    );
    this.maxBodyBytes = requirePositiveInteger(
      options.maxBodyBytes ?? DEFAULT_MCP_HTTP_MAX_BODY_BYTES,
      'maxBodyBytes'
    );
    this.bodyTimeoutMs = requirePositiveInteger(
      options.bodyTimeoutMs ?? DEFAULT_BODY_TIMEOUT_MS,
      'bodyTimeoutMs'
    );
    this.headersTimeoutMs = requirePositiveInteger(
      options.headersTimeoutMs ?? DEFAULT_HEADERS_TIMEOUT_MS,
      'headersTimeoutMs'
    );
    this.requestTimeoutMs = requirePositiveInteger(
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      'requestTimeoutMs'
    );
    this.createMcpServer = options.createMcpServer ?? createReadOnlyNeoServer;
  }

  /** Number of live MCP sessions. */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /** Port the server is bound to, or null when it is not listening. */
  get address(): number | null {
    return this.boundPort;
  }

  /** The MCP endpoint path. */
  get endpointPath(): string {
    return this.path;
  }

  /**
   * Binds the HTTP listener and starts the idle-session sweeper.
   * @returns the bound port (resolved, so port 0 yields the real port).
   */
  async start(): Promise<number> {
    if (this.httpServer) {
      throw new Error('The MCP HTTP server is already started');
    }

    const server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
    // A finite request deadline bounds slow/partial requests so an unauthenticated
    // client cannot pin a socket forever (requestTimeout = 0 used to allow exactly
    // that). It measures time to receive the COMPLETE request; a GET SSE has no
    // body and completes immediately, so it never aborts an established stream -
    // and handleSessionRequest additionally clears the per-socket deadline for the
    // GET branch. A bounded maxConnections caps total sockets so a flood of cheap
    // half-open connections cannot exhaust file descriptors.
    server.requestTimeout = this.requestTimeoutMs;
    server.headersTimeout = this.headersTimeoutMs;
    server.maxConnections = this.maxConnections;

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(this.port, this.host);
      });
    } catch (error) {
      server.close();
      throw error;
    }

    server.on('error', (error) => {
      logger.error('MCP HTTP server error', { error: errorMessage(error) });
    });

    this.httpServer = server;
    this.boundPort = (server.address() as AddressInfo).port;

    const sweepIntervalMs = Math.min(
      MAX_SWEEP_INTERVAL_MS,
      Math.max(MIN_SWEEP_INTERVAL_MS, this.sessionTtlMs)
    );
    this.sweepTimer = setInterval(() => this.sweepExpiredSessions(), sweepIntervalMs);
    this.sweepTimer.unref();

    logger.info('MCP Streamable HTTP transport listening', {
      port: this.boundPort,
      host: this.host,
      path: this.path,
      authenticated: Boolean(this.bearerToken),
      maxSessions: this.maxSessions,
      sessionTtlMs: this.sessionTtlMs,
    });

    return this.boundPort;
  }

  /** Closes every session and the HTTP listener. Safe to call when not started. */
  async stop(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }

    // Reset the in-flight-handshake counter so a stopped/restarted instance can
    // never inherit a stale pending count that would falsely report capacity.
    this.pendingSessions = 0;

    await Promise.all(
      [...this.sessions.keys()].map((sessionId) => this.destroySession(sessionId, 'server_stopping'))
    );

    const server = this.httpServer;
    this.httpServer = null;
    this.boundPort = null;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Long-lived SSE responses would otherwise keep close() pending forever.
      server.closeAllConnections();
    });

    logger.info('MCP Streamable HTTP transport stopped');
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const requestPath = new URL(req.url ?? '/', 'http://mcp.invalid').pathname;
      const origin = readHeader(req, 'origin');

      if (!this.isHostAllowed(readHeader(req, 'host'))) {
        this.sendJsonRpcError(res, 403, JSON_RPC_SERVER_ERROR, 'Forbidden: host not allowed', true);
        return;
      }
      if (!this.isOriginAllowed(origin)) {
        this.sendJsonRpcError(res, 403, JSON_RPC_SERVER_ERROR, 'Forbidden: origin not allowed', true);
        return;
      }
      this.applyCorsHeaders(res, origin);

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          Allow: ALLOWED_METHODS,
          'Access-Control-Allow-Methods': ALLOWED_METHODS,
          'Access-Control-Allow-Headers': ALLOWED_REQUEST_HEADERS,
          'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
        });
        res.end();
        return;
      }

      if (requestPath === HEALTH_PATH) {
        if (method !== 'GET') {
          this.sendMethodNotAllowed(res, 'GET, OPTIONS');
          return;
        }
        this.sendJson(res, 200, {
          status: 'ok',
          sessions: this.sessions.size,
          version: SERVER_VERSION,
        });
        return;
      }

      if (requestPath !== this.path) {
        this.sendJsonRpcError(res, 404, JSON_RPC_SERVER_ERROR, 'Not Found', true);
        return;
      }

      if (!this.isAuthorized(readHeader(req, 'authorization'))) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="neo-n3-mcp"');
        this.sendJsonRpcError(res, 401, JSON_RPC_SERVER_ERROR, 'Unauthorized', true);
        return;
      }

      switch (method) {
        case 'POST':
          await this.handlePost(req, res);
          return;
        case 'GET':
        case 'DELETE':
          await this.handleSessionRequest(req, res);
          return;
        default:
          this.sendMethodNotAllowed(res, ALLOWED_METHODS);
          return;
      }
    } catch (error) {
      logger.error('MCP HTTP request failed', { error: errorMessage(error) });
      this.sendJsonRpcError(res, 500, JSON_RPC_SERVER_ERROR, 'Internal server error');
    }
  }

  private async handlePost(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: unknown;
    try {
      body = await this.readJsonBody(req);
    } catch (error) {
      if (error instanceof BodyReadError) {
        this.sendJsonRpcError(res, error.statusCode, error.jsonRpcCode, error.message);
        return;
      }
      throw error;
    }

    const sessionId = readHeader(req, 'mcp-session-id');
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        this.sendJsonRpcError(res, 404, JSON_RPC_SESSION_NOT_FOUND, 'Session not found');
        return;
      }
      session.lastSeenMs = Date.now();
      await session.transport.handleRequest(req, res, body);
      return;
    }

    if (isInitializeRequest(body)) {
      await this.startSession(req, res, body);
      return;
    }

    this.sendJsonRpcError(
      res,
      400,
      JSON_RPC_SERVER_ERROR,
      'Bad Request: Mcp-Session-Id header is required'
    );
  }

  private async handleSessionRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const sessionId = readHeader(req, 'mcp-session-id');
    if (!sessionId) {
      this.sendJsonRpcError(
        res,
        400,
        JSON_RPC_SERVER_ERROR,
        'Bad Request: Mcp-Session-Id header is required'
      );
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendJsonRpcError(res, 404, JSON_RPC_SESSION_NOT_FOUND, 'Session not found');
      return;
    }

    session.lastSeenMs = Date.now();

    if ((req.method ?? 'GET').toUpperCase() === 'GET') {
      // A standalone GET opens a long-lived SSE RESPONSE that the SDK client
      // keeps open for the whole session while sending no further traffic. Clear
      // the per-socket deadline so the stream is not aborted, and count it as an
      // active stream so the idle sweeper never evicts a connected-but-quiet
      // client. When the stream ends, restart the idle clock from that moment.
      req.setTimeout(0);
      res.setTimeout(0);
      session.activeStreams += 1;
      const onStreamClosed = () => {
        session.activeStreams = Math.max(0, session.activeStreams - 1);
        session.lastSeenMs = Date.now();
      };
      res.once('close', onStreamClosed);
    }

    await session.transport.handleRequest(req, res);
  }

  private async startSession(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: unknown
  ): Promise<void> {
    this.evictExpiredSessions();
    if (this.sessions.size + this.pendingSessions >= this.maxSessions) {
      logger.warn('MCP HTTP session capacity reached', {
        sessions: this.sessions.size,
        pending: this.pendingSessions,
        maxSessions: this.maxSessions,
      });
      this.sendJsonRpcError(res, 503, JSON_RPC_SERVER_ERROR, 'Server session capacity reached');
      return;
    }

    // The increment and ALL construction (createMcpServer, getMcpServer, the
    // transport) live inside the try so the finally's decrement always runs. If
    // any of them throws (e.g. a wallets-directory fs fault in the NeoN3McpServer
    // constructor), pendingSessions is still released - otherwise N such throws
    // would latch the capacity guard and 503 every future initialize forever.
    this.pendingSessions += 1;
    let transport: StreamableHTTPServerTransport | undefined;
    let mcpServer: McpServer | undefined;
    try {
      const neoServer = this.createMcpServer();
      const boundMcpServer = getMcpServer(neoServer);
      mcpServer = boundMcpServer;
      const sessionTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          this.sessions.set(sessionId, {
            id: sessionId,
            transport: sessionTransport,
            neoServer,
            mcpServer: boundMcpServer,
            lastSeenMs: Date.now(),
            activeStreams: 0,
            closing: false,
          });
          logger.info('MCP HTTP session initialized', {
            sessionId,
            sessions: this.sessions.size,
          });
        },
        onsessionclosed: (sessionId) => this.destroySession(sessionId, 'client_terminated'),
      });
      transport = sessionTransport;
      sessionTransport.onclose = () => {
        const sessionId = sessionTransport.sessionId;
        if (sessionId) {
          void this.destroySession(sessionId, 'transport_closed');
        }
      };
      sessionTransport.onerror = (error) => {
        logger.debug('MCP HTTP transport reported an error', { error: errorMessage(error) });
      };

      await boundMcpServer.connect(sessionTransport);
      await sessionTransport.handleRequest(req, res, body);
    } finally {
      this.pendingSessions -= 1;
      const sessionId = transport?.sessionId;
      // A throw during construction/connect, or a rejected initialize, never
      // registers a session; close whatever was built so a failed handshake
      // cannot leak a transport or an MCP server instance.
      if (!sessionId || !this.sessions.has(sessionId)) {
        await closeSessionResources(transport, mcpServer);
      }
    }
  }

  private async destroySession(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.closing) {
      return;
    }

    session.closing = true;
    this.sessions.delete(sessionId);
    logger.info('MCP HTTP session closed', {
      sessionId,
      reason,
      sessions: this.sessions.size,
    });

    await closeSessionResources(session.transport, session.mcpServer);
  }

  private sweepExpiredSessions(): void {
    const expired = this.evictExpiredSessions();
    if (expired.length > 0) {
      logger.debug('MCP HTTP idle sessions evicted', { count: expired.length });
    }
  }

  private evictExpiredSessions(): string[] {
    const now = Date.now();
    const expired: string[] = [];
    for (const session of this.sessions.values()) {
      // A session with an open SSE stream is actively connected even when it
      // sends no requests, so it must never be classified as idle.
      if (session.activeStreams > 0) {
        continue;
      }
      if (now - session.lastSeenMs >= this.sessionTtlMs) {
        expired.push(session.id);
      }
    }
    for (const sessionId of expired) {
      void this.destroySession(sessionId, 'idle_timeout');
    }
    return expired;
  }

  /**
   * Constant-time bearer comparison. The length check runs first because
   * timingSafeEqual throws on buffers of different lengths.
   */
  private isAuthorized(authorization: string | undefined): boolean {
    if (!this.bearerToken) {
      return true;
    }
    if (!authorization) {
      return false;
    }

    const match = /^Bearer[ \t]+(\S+)$/i.exec(authorization.trim());
    if (!match) {
      return false;
    }

    const provided = Buffer.from(match[1], 'utf8');
    const expected = Buffer.from(this.bearerToken, 'utf8');
    if (provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(provided, expected);
  }

  /**
   * A request without an Origin header comes from a non-browser client (the Neo
   * Explorer agent runs server side) and is allowed. A browser-supplied Origin
   * must appear in the allowlist, which is empty by default.
   */
  private isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
      return true;
    }
    try {
      return this.allowedOrigins.includes(normalizeOrigin(origin));
    } catch {
      return false;
    }
  }

  /** Optional Host allowlist. Empty means unrestricted (reverse proxies rewrite Host). */
  private isHostAllowed(host: string | undefined): boolean {
    if (this.allowedHosts.length === 0) {
      return true;
    }
    if (!host) {
      return false;
    }
    return this.allowedHosts.includes(host.trim().toLowerCase());
  }

  private applyCorsHeaders(res: http.ServerResponse, origin: string | undefined): void {
    res.setHeader('Vary', 'Origin');
    if (!origin || this.allowedOrigins.length === 0) {
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Expose-Headers', EXPOSED_RESPONSE_HEADERS);
  }

  /**
   * Reads and parses the JSON body with a hard byte cap and a read deadline.
   * The parsed value is handed to `handleRequest`, so the SDK never re-reads the
   * consumed request stream.
   */
  private readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const declaredLength = Number(readHeader(req, 'content-length'));
      if (Number.isSafeInteger(declaredLength) && declaredLength > this.maxBodyBytes) {
        reject(new BodyReadError(413, JSON_RPC_SERVER_ERROR, 'Payload Too Large'));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;

      const timer = setTimeout(() => {
        fail(new BodyReadError(408, JSON_RPC_SERVER_ERROR, 'Request Timeout: body was not received in time'));
      }, this.bodyTimeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
      };

      const fail = (error: BodyReadError) => {
        if (settled) return;
        settled = true;
        cleanup();
        req.pause();
        reject(error);
      };

      const onData = (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          fail(new BodyReadError(413, JSON_RPC_SERVER_ERROR, 'Payload Too Large'));
          return;
        }
        chunks.push(chunk);
      };

      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new BodyReadError(400, JSON_RPC_PARSE_ERROR, 'Parse error: Invalid JSON'));
        }
      };

      const onError = (error: Error) => {
        fail(new BodyReadError(400, JSON_RPC_SERVER_ERROR, `Bad Request: ${error.message}`));
      };

      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
    });
  }

  private sendMethodNotAllowed(res: http.ServerResponse, allow: string): void {
    res.setHeader('Allow', allow);
    // A rejected non-GET method may carry an unread body; close the connection.
    this.sendJsonRpcError(res, 405, JSON_RPC_SERVER_ERROR, 'Method Not Allowed', true);
  }

  private sendJsonRpcError(
    res: http.ServerResponse,
    statusCode: number,
    code: number,
    message: string,
    closeConnection = false
  ): void {
    this.sendJson(res, statusCode, {
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    }, closeConnection);
  }

  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    payload: unknown,
    closeConnection = false
  ): void {
    if (res.writableEnded || res.headersSent) {
      return;
    }
    const body = JSON.stringify(payload);
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    };
    if (closeConnection) {
      // The request was rejected before its body was read. Tearing the
      // connection down (rather than draining an unbounded body for keep-alive
      // reuse) is what stops a slow/partial body from pinning the socket.
      headers.Connection = 'close';
    }
    res.writeHead(statusCode, headers);
    res.end(body);
    if (closeConnection) {
      // Connection: close makes Node destroy the socket once the response
      // flushes; this belt-and-braces end() guarantees the pending request body
      // cannot hold the socket open even if the client never sends it.
      res.socket?.end();
    }
  }
}

/**
 * Closes a session's transport and its MCP server. Both halves are closed
 * because each session owns a dedicated MCP server instance; dropping either
 * one alone leaks memory. Either half may be undefined when construction threw
 * partway through, in which case only what exists is closed.
 */
async function closeSessionResources(
  transport: StreamableHTTPServerTransport | undefined,
  mcpServer: McpServer | undefined
): Promise<void> {
  if (transport) {
    try {
      await transport.close();
    } catch (error) {
      logger.warn('Failed to close MCP HTTP transport', { error: errorMessage(error) });
    }
  }
  if (mcpServer) {
    try {
      await mcpServer.close();
    } catch (error) {
      logger.warn('Failed to close MCP server instance', { error: errorMessage(error) });
    }
  }
}

/**
 * Runs a synchronous construction with `config.writes.enabled` pinned to false,
 * restoring the previous value afterwards. The remote HTTP surface is read-only
 * by design (non-custodial): the AI never holds keys and never signs, so the
 * signing/broadcast tools must never be registered here. `NeoN3McpServer` reads
 * `config.writes.enabled` synchronously in its constructor, so this pin is only
 * held for the (synchronous) duration of `construct`.
 */
export function withWritesDisabled<T>(construct: () => T): T {
  const previousWritesEnabled = config.writes.enabled;
  config.writes.enabled = false;
  try {
    return construct();
  } finally {
    config.writes.enabled = previousWritesEnabled;
  }
}

/**
 * The per-session factory for the remote HTTP surface. Forces writes off so the
 * signing/broadcast tools (`transfer_assets`, `invoke_contract_write`,
 * `claim_gas`, `deploy_contract`) are never registered over the network,
 * regardless of NEO_ENABLE_WRITES.
 */
function createReadOnlyNeoServer(): NeoN3McpServer {
  return withWritesDisabled(() => new NeoN3McpServer());
}

function readIntEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${key} "${raw}". Must be a positive integer.`);
  }
  return value;
}

/**
 * Builds server options from the documented environment variables:
 * MCP_HTTP_PORT, MCP_HTTP_HOST, MCP_HTTP_PATH, MCP_HTTP_BEARER,
 * MCP_HTTP_ALLOWED_ORIGINS, MCP_HTTP_ALLOWED_HOSTS, MCP_HTTP_MAX_SESSIONS,
 * MCP_HTTP_SESSION_TTL_MS.
 */
export function resolveMcpHttpOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): McpHttpServerOptions {
  const rawPort = env.MCP_HTTP_PORT?.trim();
  let port = DEFAULT_MCP_HTTP_PORT;
  if (rawPort) {
    const parsed = Number(rawPort);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65535) {
      throw new Error(`Invalid MCP_HTTP_PORT "${rawPort}". Must be an integer between 0 and 65535.`);
    }
    port = parsed;
  }

  return {
    port,
    host: env.MCP_HTTP_HOST?.trim() || DEFAULT_MCP_HTTP_HOST,
    path: env.MCP_HTTP_PATH?.trim() || DEFAULT_MCP_HTTP_PATH,
    bearerToken: env.MCP_HTTP_BEARER?.trim() || undefined,
    allowedOrigins: (env.MCP_HTTP_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    allowedHosts: (env.MCP_HTTP_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    maxSessions: readIntEnv(env, 'MCP_HTTP_MAX_SESSIONS', DEFAULT_MCP_HTTP_MAX_SESSIONS),
    sessionTtlMs: readIntEnv(env, 'MCP_HTTP_SESSION_TTL_MS', DEFAULT_MCP_HTTP_SESSION_TTL_MS),
  };
}
