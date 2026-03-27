#!/usr/bin/env node

import { config, NetworkMode, validateConfig } from './config';
validateConfig();
import { ContractService } from './contracts/contract-service';
import { HttpServer } from './http-server';
import { NeoNetwork, NeoService } from './services/neo-service';
import { WalletService } from './services/wallet-service';
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

function getRpcUrl(network: NeoNetwork): string {
  return network === NeoNetwork.TESTNET ? config.testnetRpcUrl : config.mainnetRpcUrl;
}

function parsePort(value: string | undefined): number {
  const port = Number.parseInt(value || '3000', 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
}

async function main() {
  const network = resolveHttpNetwork(config.networkMode);
  const rpcUrl = getRpcUrl(network);
  const port = parsePort(process.env.PORT);

  const neoService = new NeoService(rpcUrl, network);
  const walletService = new WalletService();
  const contractService = new ContractService(rpcUrl, network);
  const server = new HttpServer(neoService, walletService, contractService, port);

  logger.info('HTTP entrypoint started', {
    port,
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
  main().catch((error) => {
    logger.error('Failed to start HTTP entrypoint', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
