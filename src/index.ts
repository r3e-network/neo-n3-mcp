#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { NeoService, NeoNetwork } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { ContractService } from './contracts/contract-service';
import { callTool } from './handlers/tool-handler';
import { setupResourceHandlers } from './handlers/resource-handler';
import { renderN3EndpointSignatures } from './indexer/n3-rest-catalog';
import { X_ENDPOINT_CATALOG } from './indexer/blockscout-catalog';
import { COLLECTION_CATALOG } from './indexer/indexer-collections';
import {
  MAX_GRAPHQL_QUERY_LENGTH,
  MAX_GRAPHQL_DEPTH,
  MAX_GRAPHQL_FIELDS,
} from './indexer/blockscout-graphql-guard';
import { listPublicTools, resolveRoute, PublicToolSpec } from './registry/tool-registry';
import { config, NetworkMode, validateConfig } from './config';
import { SERVER_NAME, SERVER_VERSION } from './version';
import { logger } from './utils/logger';
import {
  chargeSessionRateLimit,
  bindRateLimitSessionId as bindScopeRateLimitSessionId,
} from './utils/session-rate-limit';
import { SignerProvider } from './services/signer-provider';
import { WriteCoordinator, WriteOperationName } from './services/write-coordinator';
import { WriteOperationService } from './services/write-operation-service';
import { validateNetwork } from './utils/validation';

/** `key(param, ...)` signatures so callers see each n3index endpoint's exact param allowlist. */
const N3_REST_ENDPOINT_SIGNATURES: string = renderN3EndpointSignatures();
/** Vetted Neo X Blockscout endpoint keys advertised in the query_explorer tool description. */
const X_ENDPOINT_NAMES: readonly string[] = [...X_ENDPOINT_CATALOG.keys()];
/** Vetted indexer collection keys advertised in the query_explorer_find tool description. */
const INDEXER_COLLECTION_NAMES: readonly string[] = [...COLLECTION_CATALOG.keys()];

/**
 * Catalog detail appended to a public tool's registry description, keyed by tool
 * name. The registry stays free of indexer internals; the concrete allowlists
 * that callers need in order to author a valid query are rendered here, at
 * registration time, from the same catalogs the guards enforce.
 */
const TOOL_DESCRIPTION_SUPPLEMENTS: Readonly<Record<string, () => string>> = Object.freeze({
  query_explorer: () =>
    `Neo N3 endpoints (chain "n3"): ${N3_REST_ENDPOINT_SIGNATURES}. `
    + `Neo X endpoints (chain "neox"): ${X_ENDPOINT_NAMES.join(', ')}.`,
  query_explorer_find: () =>
    `Collections: ${INDEXER_COLLECTION_NAMES.join(', ')}.`,
  query_explorer_graphql: () =>
    `Limits: query <= ${MAX_GRAPHQL_QUERY_LENGTH} chars, depth <= ${MAX_GRAPHQL_DEPTH}, `
    + `fields <= ${MAX_GRAPHQL_FIELDS}.`,
});

/** Registry description plus any catalog allowlist detail for that tool. */
function describePublicTool(spec: PublicToolSpec): string {
  const supplement = TOOL_DESCRIPTION_SUPPLEMENTS[spec.name];
  return supplement ? `${spec.description} ${supplement()}` : spec.description;
}



/**
 * Neo MCP Server - Modern MCP SDK Implementation
 * Using the high-level McpServer API
 */
export class NeoMcpServer {
  private server: McpServer;
  private neoServices: Map<NeoNetwork, NeoService>;
  private contractServices: Map<NeoNetwork, ContractService>;
  private walletService: WalletService;
  private writeCoordinator?: WriteCoordinator;
  private servicesInitialized = false;

  private createTextResponse(payload: unknown) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }

  private createErrorResponse(error: unknown) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: message,
        },
      ],
    };
  }

  private formatDelegatedToolResponse(result: unknown) {
    if (result && typeof result === 'object' && 'error' in result) {
      const errorResult = result as { error: unknown };
      return this.createErrorResponse(errorResult.error);
    }

    if (result && typeof result === 'object' && 'result' in result) {
      const successResult = result as { result: unknown };
      return this.createTextResponse(successResult.result);
    }

    return this.createTextResponse(result);
  }

  constructor() {
    logger.info('Initializing Neo MCP Server (Modern API)...');
    
    // Create McpServer with high-level API
    this.server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    // Initialize service maps
    this.neoServices = new Map();
    this.contractServices = new Map();
    this.walletService = new WalletService(config.wallets.directory);
    if (config.writes.enabled) {
      this.writeCoordinator = new WriteCoordinator(
        new SignerProvider(config.writes.signerWifFile as string),
        new WriteOperationService(config.writes.stateDirectory),
      );
    }

    // Setup tools and resources using modern API
    this.setupTools();
    this.setupResources();
    
    logger.info('Neo MCP Server initialized successfully');
  }

  /**
   * Lazy initialize Neo services only when needed
   */
  private async ensureServicesInitialized() {
    if (this.servicesInitialized) {
      return;
    }

    try {
      logger.info('Lazy-initializing Neo services...');
      logger.info('Neo service initialization context', { networkMode: config.networkMode });

      // Initialize mainnet services if enabled
      if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        logger.info('Initializing mainnet services...');
        
        const mainnetNeoService = new NeoService(config.mainnetRpcUrls, NeoNetwork.MAINNET);
        const mainnetContractService = new ContractService(config.mainnetRpcUrls, NeoNetwork.MAINNET);
        
        this.neoServices.set(NeoNetwork.MAINNET, mainnetNeoService);
        this.contractServices.set(NeoNetwork.MAINNET, mainnetContractService);
        
        logger.info('Mainnet services initialized');
      }

      // Initialize testnet services if enabled
      if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        logger.info('Initializing testnet services...');
        
        const testnetNeoService = new NeoService(config.testnetRpcUrls, NeoNetwork.TESTNET);
        const testnetContractService = new ContractService(config.testnetRpcUrls, NeoNetwork.TESTNET);
        
        this.neoServices.set(NeoNetwork.TESTNET, testnetNeoService);
        this.contractServices.set(NeoNetwork.TESTNET, testnetContractService);
        
        logger.info('Testnet services initialized');
      }

      this.servicesInitialized = true;
      logger.info('All Neo services initialized successfully');
    } catch (error) {
      logger.error('Error initializing Neo services', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get the appropriate Neo service for the requested network
   */
  private async getNeoService(networkParam?: string): Promise<NeoService> {
    await this.ensureServicesInitialized();
    
    // If no network specified, use default based on network mode
    if (!networkParam) {
      if (config.networkMode === NetworkMode.TESTNET_ONLY) {
        const service = this.neoServices.get(NeoNetwork.TESTNET);
        if (!service) throw new Error('Testnet service not available');
        return service;
      }
      const service = this.neoServices.get(NeoNetwork.MAINNET);
      if (!service) throw new Error('Mainnet service not available');
      return service;
    }

    // Validate the requested network
    const network = validateNetwork(networkParam);

    // Check if the requested network is enabled
    if (
      (network === NeoNetwork.MAINNET && config.networkMode === NetworkMode.TESTNET_ONLY) ||
      (network === NeoNetwork.TESTNET && config.networkMode === NetworkMode.MAINNET_ONLY)
    ) {
      throw new Error(`Network ${network} is not enabled in the current mode (${config.networkMode})`);
    }

    const service = this.neoServices.get(network);
    if (!service) {
      throw new Error(`Unsupported network: ${network}`);
    }

    return service;
  }

  /**
   * Get the appropriate Contract service for the requested network
   */
  private async getContractService(networkParam?: string): Promise<ContractService> {
    await this.ensureServicesInitialized();
    
    // If no network specified, use default based on network mode
    if (!networkParam) {
      if (config.networkMode === NetworkMode.TESTNET_ONLY) {
        const service = this.contractServices.get(NeoNetwork.TESTNET);
        if (!service) throw new Error('Testnet contract service not available');
        return service;
      }
      const service = this.contractServices.get(NeoNetwork.MAINNET);
      if (!service) throw new Error('Mainnet contract service not available');
      return service;
    }

    // Validate the requested network
    const network = validateNetwork(networkParam);

    const service = this.contractServices.get(network);
    if (!service) {
      throw new Error(`Unsupported network: ${network}`);
    }

    return service;
  }

  /**
   * Setup tools using modern McpServer API
   */
  private setupTools() {
    logger.info('Setting up tools with modern API...');
    type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
    type ToolRegistrar = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
      handler: ToolHandler,
    ) => void;
    type WriteToolRegistrar = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
      annotations: {
        readOnlyHint: false;
        destructiveHint: true;
        idempotentHint: true;
      },
      handler: ToolHandler,
    ) => void;

    const sdkRegisterTool = this.server.tool.bind(this.server) as ToolRegistrar;
    const sdkRegisterWriteTool = this.server.tool.bind(this.server) as unknown as WriteToolRegistrar;
    // Every read tool delegates to `callTool`, which charges this server
    // instance's per-session bucket (its `neoServices` Map identity) on entry —
    // the same bucket the resource reads use, so all of a session's charges
    // share one bucket and distinct HTTP sessions get independent ones.
    // Charging again in the registration wrapper would double-charge each read.
    const registerDelegatedTool: ToolRegistrar = sdkRegisterTool;
    const registerWriteTool: ToolRegistrar = (name, description, inputSchema, handler) => {
      sdkRegisterWriteTool(name, description, inputSchema, {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      }, async (args) => {
        chargeSessionRateLimit(this.neoServices);
        return handler(args);
      });
    };

    // ---------------------------------------------------------------------
    // Unified public tool surface, driven by src/registry/tool-registry.ts.
    //
    // Every read tool is declared exactly once there, carrying a
    // `chain: 'n3' | 'neox'` argument wherever both chains implement the same
    // operation. Here each public tool is registered through a single path that
    // resolves the requested chain to an internal handler, so adding a chain or
    // an endpoint never duplicates a registration.
    // ---------------------------------------------------------------------
    for (const spec of listPublicTools()) {
      registerDelegatedTool(
        spec.name,
        describePublicTool(spec),
        spec.inputSchema,
        async (args) => {
          try {
            const route = resolveRoute(spec.name, (args ?? {}) as Record<string, unknown>);
            if (route.requiresServices) {
              await this.ensureServicesInitialized();
            }
            const result = await callTool(
              route.internalName,
              route.args,
              this.neoServices,
              this.contractServices,
              route.requiresWallet ? this.walletService : undefined,
            );
            return this.formatDelegatedToolResponse(result);
          } catch (error: unknown) {
            return this.createErrorResponse(error);
          }
        },
      );
    }

    if (config.writes.enabled) {
      registerWriteTool(
        'transfer_assets',
        'Create, approve, sign, and submit an idempotent asset transfer using the configured server signer.',
        {
          idempotencyKey: z.string().min(8).max(128).describe('Stable unique key reused only for this exact transfer'),
          network: z.enum(['mainnet', 'testnet']).describe('Explicit transaction network'),
          toAddress: z.string().describe('Recipient Neo N3 address'),
          asset: z.string().describe('NEO, GAS, or an NEP-17 script hash'),
          amount: z.string().describe('Decimal token amount'),
        },
        async (args) => await this.handleMcpWrite('transfer_assets', args, {
          toAddress: args.toAddress,
          asset: args.asset,
          amount: args.amount,
        }),
      );

      registerWriteTool(
        'invoke_contract_write',
        'Create, approve, sign, and submit an idempotent contract write using an explicit script hash.',
        {
          idempotencyKey: z.string().min(8).max(128).describe('Stable unique key reused only for this exact invocation'),
          network: z.enum(['mainnet', 'testnet']).describe('Explicit transaction network'),
          scriptHash: z.string().describe('Contract script hash; name-based write resolution is not allowed'),
          operation: z.string().min(1).describe('Contract method name'),
          args: z.array(z.unknown()).optional().describe('Contract method arguments'),
        },
        async (args) => await this.handleMcpWrite('invoke_contract_write', args, {
          scriptHash: args.scriptHash,
          operation: args.operation,
          args: args.args ?? [],
        }),
      );

      registerWriteTool(
        'claim_gas',
        'Create, approve, sign, and submit an idempotent GAS claim for the configured server signer.',
        {
          idempotencyKey: z.string().min(8).max(128).describe('Stable unique key reused only for this exact GAS claim'),
          network: z.enum(['mainnet', 'testnet']).describe('Explicit transaction network'),
        },
        async (args) => await this.handleMcpWrite('claim_gas', args, {}),
      );

      registerWriteTool(
        'deploy_contract',
        'Create, approve, sign, and submit an idempotent contract deployment using the configured server signer.',
        {
          idempotencyKey: z.string().min(8).max(128).describe('Stable unique key reused only for this exact deployment'),
          network: z.enum(['mainnet', 'testnet']).describe('Explicit transaction network'),
          nef: z.object({
            encoding: z.enum(['hex', 'base64']),
            data: z.string().min(1),
          }).describe('Complete serialized NEF artifact and encoding'),
          manifest: z.record(z.unknown()).describe('Neo N3 contract manifest'),
        },
        async (args) => await this.handleMcpWrite('deploy_contract', args, {
          nef: args.nef,
          manifest: args.manifest,
        }),
      );
    }

  }

  private async handleMcpWrite(
    operation: WriteOperationName,
    args: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) {
    try {
      const coordinator = this.writeCoordinator;
      if (!coordinator) {
        throw new Error('State-changing tools are disabled');
      }
      const capabilities = this.server.server.getClientCapabilities();
      if (!capabilities?.elicitation?.form) {
        throw new Error('This write requires an MCP client with form elicitation support');
      }

      const network = validateNetwork(args.network as string);
      const neoService = await this.getNeoService(network);
      const contractService = await this.getContractService(network);
      if (operation === 'deploy_contract') {
        contractService.validateDeploymentArtifacts(
          payload.nef as { encoding: 'hex' | 'base64'; data: string },
          payload.manifest as Record<string, unknown>,
        );
      }
      const record = coordinator.reserve(args.idempotencyKey as string, {
        operation,
        network,
        payload,
      });
      const canonicalPayload = JSON.stringify(record.payload, null, 2);
      const elicitation = await this.server.server.elicitInput({
        mode: 'form',
        message: `Approve ${operation} on ${network} from ${record.signerAddress}.\n\n`
          + `Payload:\n${canonicalPayload}\n\nFingerprint: ${record.fingerprint}`,
        requestedSchema: {
          type: 'object',
          properties: {
            fingerprint: {
              type: 'string',
              title: 'Intent fingerprint',
              description: record.fingerprint,
              minLength: 64,
              maxLength: 64,
            },
            approve: {
              type: 'boolean',
              title: 'Approve transaction',
              default: false,
            },
          },
          required: ['fingerprint', 'approve'],
        },
      });

      const approved = elicitation.action === 'accept'
        && elicitation.content?.approve === true
        && elicitation.content.fingerprint === record.fingerprint;
      if (!approved) {
        if (record.state === 'awaiting_approval') coordinator.decline(record.intentId);
        throw new Error('Write intent was not approved with its exact fingerprint');
      }

      coordinator.approve(record.intentId, record.fingerprint);
      return this.createTextResponse(
        await coordinator.execute(record.intentId, neoService, contractService)
      );
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  /**
   * Setup resources using modern McpServer API
   */
  private setupResources() {
    logger.info('Setting up resources with modern API...');

    setupResourceHandlers(this.server, {
      networkMode: config.networkMode,
      getNeoService: (networkParam?: string) => this.getNeoService(networkParam),
      rateLimitScope: this.neoServices,
    });
  }

  /**
   * Bind the transport's MCP session id to this server's rate-limit bucket so
   * every per-session charge (registration-inlined tools, delegated tools, and
   * resource reads) is billed under a bucket named by the session id. The
   * Streamable HTTP transport (src/mcp-http-server.ts) calls this once the
   * session id is known; the stdio entrypoint never calls it and keeps its
   * single implicit bucket.
   */
  bindRateLimitSessionId(sessionId: string): void {
    bindScopeRateLimitSessionId(this.neoServices, sessionId);
  }

  /**
   * Run the server
   */
  async run() {
    try {
      logger.info('Starting Neo MCP Server...');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Neo MCP Server started and connected successfully');
    } catch (error) {
      logger.error('Failed to start Neo MCP Server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.server.close();
    } finally {
      logger.close();
    }
  }
}

export {
  NeoService,
  NeoNetwork,
  WalletService,
  ContractService,
  config,
  NetworkMode,
  validateConfig,
};
export { HttpServer } from './http-server';
export type { HttpServerOptions } from './http-server';
export type { EncodedNef } from './contracts/contract-service';
export type { FeeEstimate } from './services/neo-service';
export { SERVER_NAME, SERVER_VERSION } from './version';

// Start the server if run directly
if (require.main === module) {
  validateConfig();
  const server = new NeoMcpServer();
  server.run().catch((error) => {
    logger.error('Fatal error starting server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
} 
