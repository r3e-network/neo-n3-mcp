#!/usr/bin/env node

/**
 * CLI entrypoint for the MCP Streamable HTTP transport.
 *
 * `npm start` still serves MCP over stdio (src/index.ts). This entrypoint serves
 * the same MCP server over HTTP so remote MCP clients can connect:
 *
 *   MCP_HTTP_PORT             TCP port (default 3001)
 *   MCP_HTTP_HOST             bind address (default 127.0.0.1)
 *   MCP_HTTP_PATH             MCP endpoint path (default /mcp)
 *   MCP_HTTP_BEARER           bearer token; required unless the host is loopback
 *   MCP_HTTP_ALLOWED_ORIGINS  comma-separated browser origins (optional)
 *   MCP_HTTP_ALLOWED_HOSTS    comma-separated Host allowlist (optional; DNS-rebinding defense)
 *   MCP_HTTP_MAX_SESSIONS     concurrent session cap (default 128)
 *   MCP_HTTP_SESSION_TTL_MS   idle session eviction window (default 1800000)
 *
 * The remote HTTP surface is READ-ONLY by design (non-custodial): it never
 * exposes signing/broadcast tools, regardless of NEO_ENABLE_WRITES.
 */

import { config, validateConfig } from './config';
import { McpHttpServer, resolveMcpHttpOptionsFromEnv } from './mcp-http-server';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  if (config.writes.enabled) {
    logger.warn(
      'NEO_ENABLE_WRITES is set, but the MCP HTTP transport is read-only by design; ' +
      'signing and broadcast tools will NOT be exposed over the network.'
    );
  }
  const options = resolveMcpHttpOptionsFromEnv();
  const server = new McpHttpServer(options);
  const port = await server.start();

  logger.info('MCP HTTP entrypoint started', {
    port,
    host: options.host,
    path: options.path,
    maxSessions: options.maxSessions,
    sessionTtlMs: options.sessionTtlMs,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('MCP HTTP entrypoint stopping', { signal });
    try {
      await server.stop();
    } finally {
      logger.close();
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });
}

if (require.main === module) {
  validateConfig();
  main().catch((error) => {
    logger.error('Failed to start MCP HTTP entrypoint', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
