import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NeoService } from '../services/neo-service';
import { NetworkMode } from '../config';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';
import { validateInteger } from '../utils/validation';

type ResourceServer = Pick<McpServer, 'resource'>;
type ResourceNeoService = Pick<NeoService, 'getBlockchainInfo' | 'getBlock'>;

export interface ResourceHandlerDependencies {
  networkMode: NetworkMode;
  getNeoService(networkParam?: string): Promise<ResourceNeoService>;
}

function createJsonResponse(uri: URL, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function limitResourceRequest(): void {
  rateLimiter.checkLimit('mcp-client');
}

export function setupResourceHandlers(
  server: ResourceServer,
  { networkMode, getNeoService }: ResourceHandlerDependencies,
) {
  logger.debug('Setting up resource handlers...');

  server.resource(
    'neo-network-status',
    'neo://network/status',
    { description: 'Network status for the default configured Neo network.' },
    async (uri) => {
      limitResourceRequest();
      const neoService = await getNeoService();
      const info = await neoService.getBlockchainInfo();
      return createJsonResponse(uri, info);
    },
  );

  if (networkMode === NetworkMode.MAINNET_ONLY || networkMode === NetworkMode.BOTH) {
    server.resource(
      'neo-mainnet-status',
      'neo://mainnet/status',
      { description: 'Network status snapshot for Neo mainnet.' },
      async (uri) => {
        limitResourceRequest();
        const neoService = await getNeoService('mainnet');
        const info = await neoService.getBlockchainInfo();
        return createJsonResponse(uri, info);
      },
    );
  }

  if (networkMode === NetworkMode.TESTNET_ONLY || networkMode === NetworkMode.BOTH) {
    server.resource(
      'neo-testnet-status',
      'neo://testnet/status',
      { description: 'Network status snapshot for Neo testnet.' },
      async (uri) => {
        limitResourceRequest();
        const neoService = await getNeoService('testnet');
        const info = await neoService.getBlockchainInfo();
        return createJsonResponse(uri, info);
      },
    );
  }

  server.resource(
    'neo-block',
    new ResourceTemplate('neo://block/{height}', { list: undefined }),
    { description: 'Read block details by height on the default configured network.' },
    async (uri, { height }) => {
      limitResourceRequest();
      const neoService = await getNeoService();
      const parsedHeight = Array.isArray(height) ? height[0] : height;
      const blockHeight = validateInteger(parsedHeight as string | number);
      const block = await neoService.getBlock(blockHeight);
      return createJsonResponse(uri, block);
    },
  );

  logger.info('Resources set up successfully');
}
