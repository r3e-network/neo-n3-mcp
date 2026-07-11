#!/usr/bin/env node

import { config, NetworkMode, validateConfig } from './config';
import { ContractService } from './contracts/contract-service';
import { HttpServer } from './http-server';
import { NeoNetwork, NeoService } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { SignerProvider } from './services/signer-provider';
import { WriteCoordinator } from './services/write-coordinator';
import { WriteOperationService } from './services/write-operation-service';
import { logger } from './utils/logger';

export function resolveHttpNetwork(networkMode: NetworkMode): NeoNetwork {
  switch (networkMode) {
    case NetworkMode.MAINNET_ONLY:
      return NeoNetwork.MAINNET;
    case NetworkMode.TESTNET_ONLY:
      return NeoNetwork.TESTNET;
    case NetworkMode.BOTH:
    default:
      throw new Error('HTTP entrypoint requires NEO_NETWORK=mainnet or NEO_NETWORK=testnet');
  }
}

export function resolveHttpSecurity(host: string, apiKey: string | undefined): string | undefined {
  const normalizedHost = host.trim().toLowerCase();
  const isLoopback = normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '::1' ||
    normalizedHost === '[::1]';

  if (!isLoopback && !apiKey) {
    throw new Error('HTTP_API_KEY is required when HTTP_HOST is not a loopback address');
  }

  return apiKey;
}

function getRpcUrl(network: NeoNetwork): string {
  return network === NeoNetwork.TESTNET ? config.testnetRpcUrl : config.mainnetRpcUrl;
}

export function parsePort(value: string | undefined): number {
  const rawPort = value ?? '3000';
  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
}

async function main() {
  const network = resolveHttpNetwork(config.networkMode);
  const rpcUrl = getRpcUrl(network);
  const port = parsePort(process.env.PORT);

  const neoService = new NeoService(rpcUrl, network);
  const apiKey = resolveHttpSecurity(config.http.host, config.http.apiKey);
  const walletService = new WalletService(config.wallets.directory);
  const contractService = new ContractService(rpcUrl, network);
  const writeCoordinator = config.writes.enabled
    ? new WriteCoordinator(
        new SignerProvider(config.writes.signerWifFile as string),
        new WriteOperationService(config.writes.stateDirectory),
      )
    : undefined;
  const server = new HttpServer(neoService, walletService, contractService, port, {
    ...config.http,
    apiKey,
    writesEnabled: config.writes.enabled,
    walletAdministrationEnabled: config.wallets.administrationEnabled,
    writeApprovalApiKey: config.writes.httpApprovalApiKey,
    writeCoordinator,
  });
  await server.ready();

  logger.info('HTTP entrypoint started', {
    port,
    host: config.http.host,
    network,
    rpcUrl,
    networkMode: config.networkMode
  });

  const shutdown = async (signal: string) => {
    logger.info('HTTP entrypoint stopping', { signal });
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
    logger.error('Failed to start HTTP entrypoint', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
