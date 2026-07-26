#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { NeoService, NeoNetwork } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { ContractService } from './contracts/contract-service';
import { callTool } from './handlers/tool-handler';
import { setupResourceHandlers } from './handlers/resource-handler';
import { N3_REST_CATALOG } from './indexer/n3-rest-catalog';
import { X_ENDPOINT_CATALOG } from './indexer/blockscout-catalog';
import { COLLECTION_CATALOG } from './indexer/indexer-collections';
import {
  MAX_GRAPHQL_QUERY_LENGTH,
  MAX_GRAPHQL_DEPTH,
  MAX_GRAPHQL_FIELDS,
} from './indexer/blockscout-graphql-guard';

/** Vetted n3index REST endpoint keys advertised in the query_indexer tool description. */
const N3_REST_ENDPOINT_NAMES: readonly string[] = [...N3_REST_CATALOG.keys()];
/** Vetted Neo X Blockscout endpoint keys advertised in the x_query tool description. */
const X_ENDPOINT_NAMES: readonly string[] = [...X_ENDPOINT_CATALOG.keys()];
/** Vetted indexer collection keys advertised in the query_indexer_find tool description. */
const INDEXER_COLLECTION_NAMES: readonly string[] = [...COLLECTION_CATALOG.keys()];
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
import {
  validateAddress,
  validateNetwork
} from './utils/validation';


/**
 * Neo N3 MCP Server - Modern MCP SDK Implementation
 * Using the high-level McpServer API
 */
export class NeoN3McpServer {
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
    logger.info('Initializing Neo N3 MCP Server (Modern API)...');
    
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
    
    logger.info('Neo N3 MCP Server initialized successfully');
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
    const registerTool = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
      handler: ToolHandler,
      rateLimitOwner: 'registration' | 'callTool' = 'registration',
    ) => {
      sdkRegisterTool(name, description, inputSchema, async (args) => {
        if (rateLimitOwner === 'registration') {
          // Charge this server instance's per-session bucket (its `neoServices`
          // Map identity), the same bucket callTool and the resource reads use,
          // so all of a session's charges share one bucket and distinct HTTP
          // sessions get independent ones.
          chargeSessionRateLimit(this.neoServices);
        }
        return handler(args);
      });
    };
    const registerDelegatedTool: ToolRegistrar = (name, description, inputSchema, handler) => {
      registerTool(name, description, inputSchema, handler, 'callTool');
    };
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

    // Network mode tool
    registerTool(
      'get_network_mode',
      'Get the active network mode and available Neo networks.',
      {},
      async () => {
        const availableNetworks = [];

        if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
          availableNetworks.push(NeoNetwork.MAINNET);
        }

        if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
          availableNetworks.push(NeoNetwork.TESTNET);
        }

        const result = {
          mode: config.networkMode,
          availableNetworks,
          defaultNetwork: config.networkMode === NetworkMode.TESTNET_ONLY ?
            NeoNetwork.TESTNET : NeoNetwork.MAINNET
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Blockchain info tool
    registerTool(
      'get_blockchain_info',
      'Get blockchain height, validator info, and the active network.',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ network }) => {
        const neoService = await this.getNeoService(network as string | undefined);
        const info = await neoService.getBlockchainInfo();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }
    );

    // Block count tool
    registerTool(
      'get_block_count',
      'Get the block count and latest block height for the selected network.',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ network }) => {
        const neoService = await this.getNeoService(network as string | undefined);
        const blockCount = await neoService.getBlockCount();
        const result = {
          blockCount,
          height: Math.max(0, blockCount - 1),
          network: neoService.getNetwork()
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Balance tool
    registerTool(
      'get_balance',
      'Get NEO, GAS, and NEP-17 balances for an address.',
      {
        address: z.string().describe('Neo N3 address'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ address, network }) => {
        const validatedAddress = validateAddress(address as string);
        const neoService = await this.getNeoService(network as string | undefined);
        const balance = await neoService.getBalance(validatedAddress);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(balance, null, 2),
            },
          ],
        };
      }
    );

    registerTool(
      'get_unclaimed_gas',
      'Get the amount of GAS claimable by an address.',
      {
        address: z.string().describe('Neo N3 address'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ address, network }) => {
        const validatedAddress = validateAddress(address as string);
        const neoService = await this.getNeoService(network as string | undefined);
        const result = await neoService.getUnclaimedGas(validatedAddress);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    registerDelegatedTool(
      'get_nep17_transfers',
      'Get NEP-17 transfer history for an address.',
      {
        address: z.string().describe('Neo N3 address'),
        fromTimestampMs: z.number().int().nonnegative().optional().describe('Optional start timestamp in Unix epoch milliseconds'),
        toTimestampMs: z.number().int().nonnegative().optional().describe('Optional end timestamp in Unix epoch milliseconds'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_nep17_transfers', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_nep11_balances',
      'Get NEP-11 balances for an address.',
      {
        address: z.string().describe('Neo N3 address'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_nep11_balances', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_nep11_transfers',
      'Get NEP-11 transfer history for an address.',
      {
        address: z.string().describe('Neo N3 address'),
        fromTimestampMs: z.number().int().nonnegative().optional().describe('Optional start timestamp in Unix epoch milliseconds'),
        toTimestampMs: z.number().int().nonnegative().optional().describe('Optional end timestamp in Unix epoch milliseconds'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_nep11_transfers', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    // List famous contracts tool
    registerDelegatedTool(
      'list_famous_contracts',
      'List supported well-known contracts for the selected network.',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('list_famous_contracts', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    // Contract info tool
    registerDelegatedTool(
      'get_contract_info',
      'Get metadata and operations for a contract by known name, script hash, or Neo address.',
      {
        contract: z.string().optional().describe('Generic contract reference: known name, script hash, or Neo address'),
        contractName: z.string().optional().describe('Supported contract name'),
        nameOrHash: z.string().optional().describe('Backward-compatible alias for contract name or script hash'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_contract_info', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_contract_status',
      'Check whether a contract is deployed and inspect its current on-chain status by known name, script hash, or Neo address.',
      {
        contract: z.string().optional().describe('Generic contract reference: known name, script hash, or Neo address'),
        contractName: z.string().optional().describe('Supported contract name'),
        nameOrHash: z.string().optional().describe('Backward-compatible alias for contract name or script hash'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_contract_status', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_wallet',
      'Get sanitized metadata for a locally stored wallet by address.',
      {
        address: z.string().describe('Neo N3 address'),
      },
      async (args) => {
        try {
          const result = await callTool('get_wallet', args, this.neoServices, this.contractServices, this.walletService);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );
    registerDelegatedTool(
      'get_block',
      'Get block details by height or hash.',
      { hashOrHeight: z.union([z.string(), z.number()]).describe('Block hash (64 hex chars) or block height (number)'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_block', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_transaction',
      'Get transaction details by hash.',
      { txid: z.string().describe('Transaction hash (64 hex chars, optional 0x prefix)'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_transaction', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'get_application_log',
      'Get the application log for a transaction hash.',
      { txid: z.string().describe('Transaction hash (64 hex chars, optional 0x prefix)'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_application_log', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'wait_for_transaction',
      'Wait for a transaction to be confirmed on-chain.',
      {
        txid: z.string().describe('Transaction hash (64 hex chars, optional 0x prefix)'),
        timeoutMs: z.number().int().positive().optional().describe('Optional timeout in milliseconds'),
        pollIntervalMs: z.number().int().positive().optional().describe('Optional polling interval in milliseconds'),
        includeApplicationLog: z.boolean().optional().describe('Include the application log once the transaction confirms'),
        network: z.string().optional().describe('Optional: Network')
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('wait_for_transaction', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'invoke_contract',
      'Run a read-only smart contract invocation without signing or broadcasting a transaction.',
      {
      network: z.enum(['mainnet', 'testnet']).optional().describe('Network to query'),
      contract: z.string().optional().describe('Contract reference: script hash, Neo address, exact N3Index name, or a previously discovered manifest name'),
      scriptHash: z.string().optional().describe('Contract script hash (40 hex chars, optional 0x prefix)'),
      contractName: z.string().optional().describe('Exact contract name resolved through N3Index or a live manifest'),
      nameOrHash: z.string().optional().describe('Contract name or script hash (alias for contract)'),
      operation: z.string().describe('Contract method name to invoke'),
      args: z.array(z.unknown()).optional().describe('Method arguments as an array of values')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('invoke_contract', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'estimate_transfer_fees',
      'Estimate network and system fees for a transfer.',
      { 
      network: z.string().optional().describe('Optional: Network'),
      fromAddress: z.string().describe('Sender address'),
      toAddress: z.string().describe('Recipient address'),
      asset: z.string().describe('Asset hash'),
      amount: z.string().describe('Amount')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('estimate_transfer_fees', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    registerDelegatedTool(
      'estimate_invoke_fees',
      'Estimate network and system fees for a contract invocation by script hash or a generic contract reference.',
      { 
      network: z.string().optional().describe('Optional: Network'),
      signerAddress: z.string().describe('Signer address'),
      contract: z.string().optional().describe('Generic contract reference: known name, script hash, or Neo address'),
      scriptHash: z.string().optional().describe('Contract script hash'),
      contractName: z.string().optional().describe('Exact contract name resolved through N3Index or a live manifest'),
      nameOrHash: z.string().optional().describe('Backward-compatible alias for contract name or script hash'),
      operation: z.string().describe('Method name'),
      args: z.array(z.unknown()).optional().describe('Optional: Method arguments')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('estimate_invoke_fees', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      }
    );

    // --- Analytical indexer (neo3fura) read tools ---
    // These delegate to callTool, which routes them straight to the indexer /
    // Blockscout HTTP clients without initializing NeoService/ContractService.
    const registerAnalyticalTool = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
    ) => {
      registerDelegatedTool(name, description, inputSchema, async (args) => {
        try {
          const result = await callTool(name, args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      });
    };

    const n3NetworkField = {
      network: z.enum(['mainnet', 'testnet']).optional().describe('Neo N3 network (default mainnet)'),
    };
    const n3PaginationFields = {
      limit: z.number().int().min(1).max(100).optional().describe('Max rows to return (1-100, default 20)'),
      skip: z.number().int().nonnegative().optional().describe('Rows to skip for pagination (default 0)'),
    };

    registerAnalyticalTool(
      'n3_get_address',
      'Neo N3 analytics: get indexer account summary (first-seen, etc.) for an address.',
      {
        address: z.string().describe('Neo N3 address (base58) or 0x script hash'),
        ...n3NetworkField,
      },
    );

    registerAnalyticalTool(
      'n3_list_transactions_by_address',
      'Neo N3 analytics: list transactions involving an address (paginated).',
      {
        address: z.string().describe('Neo N3 address (base58) or 0x script hash'),
        ...n3PaginationFields,
        ...n3NetworkField,
      },
    );

    registerAnalyticalTool(
      'n3_list_transfers_by_address',
      'Neo N3 analytics: list NEP-17 token transfers for an address (paginated).',
      {
        address: z.string().describe('Neo N3 address (base58) or 0x script hash'),
        ...n3PaginationFields,
        ...n3NetworkField,
      },
    );

    registerAnalyticalTool(
      'n3_asset_holders',
      'Neo N3 analytics: list holders of a NEP-17 asset by contract hash, with balance share (paginated).',
      {
        contractHash: z.string().describe('Asset contract script hash (40 hex chars, optional 0x prefix)'),
        ...n3PaginationFields,
        ...n3NetworkField,
      },
    );

    registerAnalyticalTool(
      'n3_assets_held_by_address',
      'Neo N3 analytics: list assets (with balances) held by an address (paginated).',
      {
        address: z.string().describe('Neo N3 address (base58) or 0x script hash'),
        ...n3PaginationFields,
        ...n3NetworkField,
      },
    );

    // n3_application_log has no n3index REST endpoint (the deployed indexer exposes no
    // per-transaction application log). It is therefore backed by the working, NeoService-based
    // get_application_log path (live RPC) — a thin alias that keeps the tool name + schema
    // stable. It initializes services (like the other NeoService-delegated tools) before
    // dispatch, then delegates to callTool('get_application_log', ...).
    registerDelegatedTool(
      'n3_application_log',
      'Neo N3 analytics: get the application log (executions + notifications) for a transaction hash.',
      {
        txid: z.string().describe('Transaction hash (64 hex chars, optional 0x prefix)'),
        ...n3NetworkField,
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_application_log', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      },
    );

    registerAnalyticalTool(
      'n3_contract_by_name',
      'Neo N3 analytics: search deployed contracts by (case-insensitive) name (paginated).',
      {
        name: z.string().describe('Contract name or substring to search for'),
        ...n3PaginationFields,
        ...n3NetworkField,
      },
    );

    // --- Generic catalog-driven indexer query (n3index REST, Neo N3 MAINNET only) ---
    // query_indexer answers arbitrary on-chain questions by dispatching a VETTED, read-only
    // n3index REST endpoint with typed params. The concrete path is built by substituting only
    // a validated typed segment (address/scriptHash/txid/blockRef) into a fixed template, and
    // only allowlisted query keys (limit/offset/candidate/q) are forwarded — no model-authored
    // path or query string ever reaches the network (SSRF/traversal-proof). `method` is a REST
    // endpoint KEY (not a JSON-RPC method); the { method, params } interface is unchanged. No
    // network field: mainnet only.
    registerAnalyticalTool(
      'query_indexer',
      'Neo N3 (mainnet) generic indexer query over the live n3index REST API. Answer an on-chain '
        + 'question by choosing a vetted read-only endpoint and passing its typed params. '
        + 'Categories: chain summary, blocks, transactions, accounts/addresses, tokens, contracts, '
        + 'governance (candidate voters), analytics, and search. Example: '
        + '{"method":"list_token_holders","params":{"hash":"0x...","limit":20}}. '
        + 'Unknown endpoints, unknown params, and unsafe path values are rejected before any '
        + 'network call; limit/offset are capped.',
      {
        method: z.string().describe(
          'One of the vetted n3index REST endpoints: ' + N3_REST_ENDPOINT_NAMES.join(', '),
        ),
        params: z.record(z.unknown()).optional().describe(
          'Typed params for the chosen endpoint (e.g. { address }, { hash, limit }, '
            + '{ blockRef }, { q }). Only the endpoint\'s declared params are accepted.',
        ),
      },
    );

    // Curated ergonomic wrappers over query_indexer (fixed method, friendly params).
    registerAnalyticalTool(
      'n3_list_blocks',
      'Neo N3 (mainnet) analytics: list recent blocks, newest first (paginated).',
      { ...n3PaginationFields },
    );
    registerAnalyticalTool(
      'n3_list_transactions',
      'Neo N3 (mainnet) analytics: list recent transactions, newest first (paginated).',
      { ...n3PaginationFields },
    );
    registerAnalyticalTool(
      'n3_get_transaction',
      'Neo N3 (mainnet) analytics: get a single transaction by its hash.',
      { transactionHash: z.string().describe('Transaction hash (0x + 64 hex)') },
    );
    registerAnalyticalTool(
      'n3_get_block',
      'Neo N3 (mainnet) analytics: get a full block by its hash or height.',
      { block: z.string().describe('Block hash (0x + 64 hex) or block height (integer)') },
    );
    registerAnalyticalTool(
      'n3_list_nep17_transfers_by_contract',
      'Neo N3 (mainnet) analytics: list NEP-17 transfers for a token contract (paginated).',
      {
        contractHash: z.string().describe('Token contract script hash (0x + 40 hex)'),
        ...n3PaginationFields,
      },
    );
    registerAnalyticalTool(
      'n3_list_assets',
      'Neo N3 (mainnet) analytics: list the token/asset registry, optionally by standard.',
      {
        standard: z.enum(['NEP17', 'NEP11']).optional().describe('Filter by token standard'),
        ...n3PaginationFields,
      },
    );

    // --- Constrained-filter indexer query (Phase 2, GATED OFF by default) ---
    // query_indexer_find answers arbitrary-filter questions by authoring a SMALL, vetted
    // Mongo-shaped filter over one allowlisted collection. It is always ADVERTISED, but
    // EXECUTION is gated behind N3INDEX_FIND_ENABLED (default off): until the flag is set
    // the tool returns a clear "disabled" error before any network call. When enabled, the
    // guard rebuilds the whole { Filter, Sort, Limit, Skip } request field-by-field from the
    // collection's indexed-field allowlist (injection/DoS-proof). No network field: mainnet only.
    registerAnalyticalTool(
      'query_indexer_find',
      'Neo N3 (mainnet) constrained-filter indexer query. Targets the neo3fura JSON-RPC gateway, '
        + 'which is currently UNREACHABLE, so this tool stays GATED OFF by default — enable with '
        + 'N3INDEX_FIND_ENABLED; while disabled it returns a "disabled" error. (The other N3 '
        + 'analytical tools use the live n3index REST API instead.) Author a small, '
        + 'vetted filter over ONE allowlisted collection: ' + INDEXER_COLLECTION_NAMES.join(', ')
        + '. Only that collection\'s indexed fields may be filtered/sorted; a value is a scalar '
        + '(equality), { $in: [...] }, a range ($gt/$gte/$lt/$lte), or { $exists }. Unknown '
        + 'collections, fields, and operators (e.g. $where/$or) are rejected; limit/skip are '
        + 'capped. Example: {"collection":"transactions","filter":{"sender":"N..."},'
        + '"sort":{"blockIndex":-1},"limit":20}.',
      {
        collection: z.string().describe(
          'One of the vetted indexer collections: ' + INDEXER_COLLECTION_NAMES.join(', '),
        ),
        filter: z.record(z.unknown()).optional().describe(
          'Small Mongo-shaped filter over the collection\'s indexed fields only. Each value is '
            + 'a scalar (equality), { "$in": [...] }, a range ({ "$gte": .., "$lte": .. }), or '
            + '{ "$exists": bool }. Disallowed fields/operators are rejected before any query.',
        ),
        sort: z.record(z.unknown()).optional().describe(
          'Optional sort spec over sortable fields: { field: 1 | -1 | "asc" | "desc" }.',
        ),
        limit: z.number().int().min(1).max(100).optional().describe('Max rows (capped per collection, default 20)'),
        skip: z.number().int().nonnegative().optional().describe('Rows to skip for pagination (default 0, capped)'),
      },
    );

    // --- Neo X (EVM sidechain, Blockscout v2) read tools ---
    const neoxNetworkField = {
      network: z.enum(['neox-mainnet', 'neox-testnet']).optional().describe('Neo X network (default neox-mainnet)'),
    };

    registerAnalyticalTool(
      'x_search',
      'Neo X (EVM) explorer: full-text search for addresses, tokens, blocks, and transactions.',
      {
        q: z.string().describe('Search query (address, token name/symbol, block, or tx hash)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_get_address',
      'Neo X (EVM) explorer: get address details (balance, type, tags).',
      {
        address: z.string().describe('Neo X 0x address (40 hex chars)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_list_transactions_by_address',
      'Neo X (EVM) explorer: list transactions for an address.',
      {
        address: z.string().describe('Neo X 0x address (40 hex chars)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_list_token_transfers',
      'Neo X (EVM) explorer: list ERC-20/721/1155 token transfers for an address.',
      {
        address: z.string().describe('Neo X 0x address (40 hex chars)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_token_info',
      'Neo X (EVM) explorer: get token metadata (name, symbol, decimals, supply) by token contract address.',
      {
        address: z.string().describe('Neo X 0x token contract address (40 hex chars)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_token_holders',
      'Neo X (EVM) explorer: list holders of a token by token contract address.',
      {
        address: z.string().describe('Neo X 0x token contract address (40 hex chars)'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_block',
      'Neo X (EVM) explorer: get block details by block number or hash.',
      {
        blockNumberOrHash: z.union([z.string(), z.number()]).describe('Block number or 0x block hash'),
        ...neoxNetworkField,
      },
    );

    registerAnalyticalTool(
      'x_transaction',
      'Neo X (EVM) explorer: get transaction details by hash.',
      {
        hash: z.string().describe('Neo X 0x transaction hash (64 hex chars)'),
        ...neoxNetworkField,
      },
    );

    // --- Generic catalog-driven Neo X query (Blockscout v2, Neo X MAINNET only) ---
    // x_query answers arbitrary Neo X on-chain questions by dispatching a VETTED,
    // read-only Blockscout v2 REST endpoint with typed params. The concrete path is
    // built by substituting only a validated typed segment (evmAddress/evmHash/blockRef)
    // into a fixed template, and only allowlisted query keys are forwarded — no
    // model-authored path or query string ever reaches the network (SSRF/traversal-proof
    // by construction). No network field: Neo X mainnet only.
    registerAnalyticalTool(
      'x_query',
      'Neo X (mainnet) generic explorer query over Blockscout. Answer an on-chain question '
        + 'by choosing a vetted read-only endpoint and passing its typed params. Categories: '
        + 'chain-wide lists (blocks/transactions/token-transfers/tokens/contracts/search/stats), '
        + 'address, token, transaction, block, and smart contract. Example: '
        + '{"endpoint":"get_address","params":{"address":"0x..."}}. Unknown endpoints, unknown '
        + 'params, and unsafe path values are rejected before any network call.',
      {
        endpoint: z.string().describe(
          'One of the vetted Neo X Blockscout endpoints: ' + X_ENDPOINT_NAMES.join(', '),
        ),
        params: z.record(z.unknown()).optional().describe(
          'Typed params for the chosen endpoint (e.g. { address }, { hash }, { blockRef }, '
            + 'plus any allowlisted query keys such as { q } or { filter }). Only the '
            + 'endpoint\'s declared params are accepted.',
        ),
      },
    );

    // --- Arbitrary Neo X GraphQL query (Blockscout, Phase 2, GATED OFF by default) ---
    // x_graphql posts a caller-authored — but guard-vetted — GraphQL read query to the Neo X
    // Blockscout GraphQL endpoint. It is always ADVERTISED, but EXECUTION is gated behind
    // NEOX_GRAPHQL_ENABLED (default off): until the flag is set the tool returns a clear
    // "disabled" error before any network call. When enabled, the guard enforces a read-only
    // envelope — no mutation/subscription, no introspection (__schema/__type), no directives
    // (@…), bounded depth/complexity/length, JSON-only bounded variables. The URL is a fixed
    // constant (no caller-supplied path → no SSRF). No network field: Neo X mainnet only.
    registerAnalyticalTool(
      'x_graphql',
      'Neo X (mainnet) arbitrary Blockscout GraphQL query. GATED OFF by default — enable with '
        + 'NEOX_GRAPHQL_ENABLED; while disabled it returns a "disabled" error. Author a read-only '
        + 'GraphQL "query" (or anonymous) document; mutation/subscription operations, introspection '
        + '(__schema/__type), directives (@…), and oversized/deeply-nested documents are rejected. '
        + 'Limits: ' + MAX_GRAPHQL_QUERY_LENGTH + ' chars, nesting depth ' + MAX_GRAPHQL_DEPTH
        + ', ' + MAX_GRAPHQL_FIELDS + ' selection tokens. Example: '
        + '{"query":"{ block(number: 1) { hash } }"}.',
      {
        query: z.string().describe(
          'A read-only GraphQL query document (max ' + MAX_GRAPHQL_QUERY_LENGTH + ' chars; '
            + 'no mutation/subscription, introspection, or directives).',
        ),
        variables: z.record(z.unknown()).optional().describe(
          'Optional GraphQL variables as a plain, bounded JSON object.',
        ),
      },
    );

    // --- Non-custodial WRITE layer: SIMULATE + CONSTRUCT (unsigned) tools ---
    // These tools NEVER sign or broadcast. Construct tools return an UNSIGNED
    // proposal the user must sign in their own wallet (NeoLine/WalletConnect for
    // Neo N3, MetaMask for Neo X). Simulate tools run read-only previews.

    // Neo N3 proposal/simulate tools need the read-only NeoService RPC path, so
    // they initialize services (like the other N3 delegated tools) before dispatch.
    const registerN3ProposalTool = (
      name: string,
      description: string,
      inputSchema: Record<string, z.ZodTypeAny>,
    ) => {
      registerDelegatedTool(name, description, inputSchema, async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool(name, args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: unknown) {
          return this.createErrorResponse(error);
        }
      });
    };

    registerN3ProposalTool(
      'n3_test_invoke',
      'Neo N3 SIMULATE: run a contract call through invokefunction in TEST mode. '
      + 'Read-only preview only (state, gasConsumed, exception, stack). The server '
      + 'NEVER signs or broadcasts.',
      {
        network: z.enum(['mainnet', 'testnet']).optional().describe('Neo N3 network (default mainnet)'),
        scriptHash: z.string().describe('Contract script hash (40 hex chars, optional 0x prefix)'),
        operation: z.string().describe('Contract method name to simulate'),
        args: z.array(z.unknown()).optional().describe('Method arguments (raw values or {type,value} params)'),
        signers: z.array(z.object({
          account: z.string().describe('Neo N3 address or 0x script hash'),
          scopes: z.string().optional().describe('Witness scope (default CalledByEntry)'),
        })).optional().describe('Optional witness signers for CheckWitness-gated methods'),
      },
    );

    registerN3ProposalTool(
      'n3_build_transfer',
      'Neo N3 CONSTRUCT: build an UNSIGNED NEP-17 transfer proposal (NeoLine dapi '
      + 'invoke params) plus a test-invoke simulation. The server NEVER signs or '
      + 'broadcasts — the user signs and sends this in their own wallet.',
      {
        network: z.enum(['mainnet', 'testnet']).optional().describe('Neo N3 network (default mainnet)'),
        from: z.string().describe('Sender Neo N3 address'),
        to: z.string().describe('Recipient Neo N3 address'),
        asset: z.string().describe('"NEO", "GAS", or a NEP-17 contract script hash'),
        amount: z.string().describe('Human-readable decimal amount (e.g. "1.5")'),
        decimals: z.number().int().min(0).max(255).optional().describe('Token decimals (auto-detected for NEO/GAS and known tokens)'),
      },
    );

    registerN3ProposalTool(
      'n3_build_invoke',
      'Neo N3 CONSTRUCT: build an UNSIGNED contract-invoke proposal (NeoLine dapi '
      + 'invoke params) plus a test-invoke simulation. The server NEVER signs or '
      + 'broadcasts — the user signs and sends this in their own wallet.',
      {
        network: z.enum(['mainnet', 'testnet']).optional().describe('Neo N3 network (default mainnet)'),
        scriptHash: z.string().describe('Contract script hash (40 hex chars, optional 0x prefix)'),
        operation: z.string().describe('Contract method name'),
        args: z.array(z.unknown()).optional().describe('Method arguments (raw values or {type,value} params)'),
        from: z.string().describe('Signer Neo N3 address (default CalledByEntry signer)'),
        signers: z.array(z.object({
          account: z.string().describe('Neo N3 address or 0x script hash'),
          scopes: z.string().optional().describe('Witness scope (default CalledByEntry)'),
        })).optional().describe('Optional explicit witness signers'),
      },
    );

    registerAnalyticalTool(
      'x_simulate_call',
      'Neo X (EVM) SIMULATE: run eth_call plus eth_estimateGas and eth_gasPrice for '
      + 'a call. Read-only preview (gasEstimate, gasPrice, callResult or revertReason). '
      + 'The server NEVER signs or broadcasts.',
      {
        network: z.enum(['neox-mainnet', 'neox-testnet']).optional().describe('Neo X network (default neox-mainnet)'),
        to: z.string().describe('Target contract/account 0x address'),
        data: z.string().optional().describe('0x-hex calldata (optional)'),
        from: z.string().optional().describe('Caller 0x address (optional)'),
        value: z.string().optional().describe('Wei value as a decimal string (optional)'),
      },
    );

    registerAnalyticalTool(
      'x_build_transfer',
      'Neo X (EVM) CONSTRUCT: build an UNSIGNED native-value transfer transaction '
      + '(with gas from eth_estimateGas and eth_gasPrice, no nonce). The server NEVER '
      + 'signs or broadcasts — the user signs and sends this in MetaMask.',
      {
        network: z.enum(['neox-mainnet', 'neox-testnet']).optional().describe('Neo X network (default neox-mainnet)'),
        from: z.string().describe('Sender 0x address'),
        to: z.string().describe('Recipient 0x address'),
        amountWei: z.string().describe('Amount in wei as a decimal string'),
      },
    );

    registerAnalyticalTool(
      'x_build_contract_call',
      'Neo X (EVM) CONSTRUCT: build an UNSIGNED contract-call transaction from '
      + 'pre-encoded calldata OR a functionSignature + args (ABI-encoded here), with '
      + 'gas from eth_estimateGas and eth_gasPrice, no nonce. The server NEVER signs '
      + 'or broadcasts — the user signs and sends this in MetaMask.',
      {
        network: z.enum(['neox-mainnet', 'neox-testnet']).optional().describe('Neo X network (default neox-mainnet)'),
        from: z.string().describe('Sender 0x address'),
        to: z.string().describe('Target contract 0x address'),
        data: z.string().optional().describe('Pre-encoded 0x-hex calldata (use this OR functionSignature)'),
        functionSignature: z.string().optional().describe('Canonical signature to ABI-encode, e.g. "transfer(address,uint256)"'),
        args: z.array(z.unknown()).optional().describe('Arguments for functionSignature'),
        valueWei: z.string().optional().describe('Wei value to attach as a decimal string (optional)'),
      },
    );

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
      logger.info('Starting Neo N3 MCP Server...');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Neo N3 MCP Server started and connected successfully');
    } catch (error) {
      logger.error('Failed to start Neo N3 MCP Server', {
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
  const server = new NeoN3McpServer();
  server.run().catch((error) => {
    logger.error('Fatal error starting server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
} 
