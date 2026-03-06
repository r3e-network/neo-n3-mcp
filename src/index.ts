#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { NeoService, NeoNetwork } from './services/neo-service';
import { WalletService } from './services/wallet-service';
import { ContractService } from './contracts/contract-service';
import { callTool } from './handlers/tool-handler';
import { setupResourceHandlers } from './handlers/resource-handler';
import { config, NetworkMode } from './config';
import { SERVER_NAME, SERVER_VERSION } from './version';
import { logger } from './utils/logger';
import {
  validateAddress,
  validateHash,
  validateAmount,

  validateScriptHash,
  validateNetwork
} from './utils/validation';


/**
 * Neo N3 MCP Server - Modern MCP SDK Implementation
 * Using the high-level McpServer API
 */
class NeoN3McpServer {
  private server: McpServer;
  private neoServices: Map<NeoNetwork, NeoService>;
  private contractServices: Map<NeoNetwork, ContractService>;
  private walletService: WalletService;
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
    this.walletService = new WalletService();

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
        
        const mainnetNeoService = new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        const mainnetContractService = new ContractService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        
        this.neoServices.set(NeoNetwork.MAINNET, mainnetNeoService);
        this.contractServices.set(NeoNetwork.MAINNET, mainnetContractService);
        
        logger.info('Mainnet services initialized');
      }

      // Initialize testnet services if enabled
      if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        logger.info('Initializing testnet services...');
        
        const testnetNeoService = new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        const testnetContractService = new ContractService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        
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

    // Network mode tool
    this.server.tool(
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
    this.server.tool(
      'get_blockchain_info',
      'Get blockchain height, validator info, and the active network.',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ network }) => {
        const neoService = await this.getNeoService(network);
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
    this.server.tool(
      'get_block_count',
      'Get the current block height for the selected network.',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ network }) => {
        const neoService = await this.getNeoService(network);
        const info = await neoService.getBlockchainInfo();
        const result = {
          height: info.height,
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
    this.server.tool(
      'get_balance',
      'Get NEO, GAS, and NEP-17 balances for an address.',
      {
        address: z.string().describe('Neo N3 address'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ address, network }) => {
        const validatedAddress = validateAddress(address);
        const neoService = await this.getNeoService(network);
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

    this.server.tool(
      'get_unclaimed_gas',
      'Get the amount of GAS claimable by an address.',
      {
        address: z.string().describe('Neo N3 address'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ address, network }) => {
        const validatedAddress = validateAddress(address);
        const neoService = await this.getNeoService(network);
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

    this.server.tool(
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    // List famous contracts tool
    this.server.tool(
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    // Contract info tool
    this.server.tool(
      'get_contract_info',
      'Get metadata and operations for a supported contract by name or script hash.',
      {
        contractName: z.string().optional().describe('Supported contract name'),
        nameOrHash: z.string().optional().describe('Supported contract name or script hash'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_contract_info', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    // Create wallet tool
    this.server.tool(
      'create_wallet',
      'Create a Neo N3 wallet, persist it locally, and return a NEP-2 encrypted private key.',
      {
        password: z.string().describe('Password to encrypt the wallet WIF'),
      },
      async (args) => {
        try {
          const result = await callTool('create_wallet', args, this.neoServices, this.contractServices, this.walletService);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'get_wallet',
      'Get sanitized metadata for a locally stored wallet by address.',
      {
        address: z.string().describe('Neo N3 address'),
      },
      async (args) => {
        try {
          const result = await callTool('get_wallet', args, this.neoServices, this.contractServices, this.walletService);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );
    this.server.tool(
      'set_network_mode',
      'Set the configured network mode. Restart may be required.',
      { mode: z.enum(['mainnet', 'testnet', 'mainnet_only', 'testnet_only', 'both']).describe('Network mode to set') },
      async (args) => {
        try {
          const result = await callTool('set_network_mode', args, this.neoServices, this.contractServices);
          if (!(result && typeof result === 'object' && 'error' in result)) {
            this.neoServices.clear();
            this.contractServices.clear();
            this.servicesInitialized = false;
          }
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'get_block',
      'Get block details by height or hash.',
      { hashOrHeight: z.union([z.string(), z.number()]).describe('Block hash or height'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_block', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'get_transaction',
      'Get transaction details by hash.',
      { txid: z.string().describe('Transaction hash'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_transaction', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'get_application_log',
      'Get the application log for a transaction hash.',
      { txid: z.string().describe('Transaction hash'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_application_log', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'wait_for_transaction',
      'Wait for a transaction to be confirmed on-chain.',
      {
        txid: z.string().describe('Transaction hash'),
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'transfer_assets',
      'Transfer NEP-17 assets using a sender WIF.',
      { 
      network: z.string().optional().describe('Optional: Network'),
      fromWIF: z.string().describe('Sender WIF'),
      toAddress: z.string().describe('Recipient address'),
      asset: z.string().describe('Asset hash (e.g. NEO or GAS hash)'),
      amount: z.string().describe('Amount to transfer'),
      confirm: z.boolean().optional().describe('Must be true to execute')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('transfer_assets', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'invoke_contract',
      'Invoke a contract read method or prepare/send a write invocation by script hash or supported contract name.',
      { 
      network: z.string().optional().describe('Optional: Network'),
      fromWIF: z.string().optional().describe('Optional: Sender WIF for write operations'),
      scriptHash: z.string().optional().describe('Contract script hash'),
      contractName: z.string().optional().describe('Supported contract name'),
      operation: z.string().describe('Method name'),
      args: z.array(z.any()).optional().describe('Optional: Method arguments'),
      signers: z.array(z.any()).optional().describe('Optional: Signer scopes'),
      confirm: z.boolean().optional().describe('Must be true to execute write operations')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('invoke_contract', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'import_wallet',
      'Import a wallet from a private key or WIF.',
      {
        key: z.string().optional().describe('Private key or WIF'),
        privateKeyOrWIF: z.string().optional().describe('Legacy alias for private key or WIF'),
        password: z.string().optional().describe('Optional password to encrypt the imported WIF')
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('import_wallet', args, this.neoServices, this.contractServices, this.walletService);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
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
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'estimate_invoke_fees',
      'Estimate network and system fees for a contract invocation by script hash or supported contract name.',
      { 
      network: z.string().optional().describe('Optional: Network'),
      signerAddress: z.string().describe('Signer address'),
      scriptHash: z.string().optional().describe('Contract script hash'),
      contractName: z.string().optional().describe('Supported contract name'),
      operation: z.string().describe('Method name'),
      args: z.array(z.any()).optional().describe('Optional: Method arguments'),
      signers: z.array(z.any()).optional().describe('Optional: Signer scopes')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('estimate_invoke_fees', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'claim_gas',
      'Claim available GAS for an account.',
      { network: z.string().optional().describe('Optional: Network'), fromWIF: z.string().describe('Account WIF'), confirm: z.boolean().optional().describe('Must be true to execute') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('claim_gas', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'deploy_contract',
      'Deploy a compiled Neo N3 contract. Requires explicit confirmation.',
      {
        network: z.string().optional().describe('Optional: Network'),
        fromWIF: z.string().describe('Deployer account WIF'),
        script: z.string().describe('NEF script as hex or base64'),
        manifest: z.record(z.any()).describe('Contract manifest JSON object'),
        confirm: z.boolean().optional().describe('Must be true to execute')
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('deploy_contract', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'neofs_create_container',
      'Create a NeoFS container.',
      {
        network: z.string().optional().describe('Optional: Network'),
        fromWIF: z.string().optional().describe('Owner account WIF'),
        wif: z.string().optional().describe('Legacy alias for the owner account WIF'),
        ownerId: z.string().describe('Owner identifier for the container'),
        rules: z.array(z.any()).optional().describe('Optional: Container placement rules'),
        confirm: z.boolean().optional().describe('Must be true to execute')
      },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('neofs_create_container', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

    this.server.tool(
      'neofs_get_containers',
      'List NeoFS containers for an owner.',
      { network: z.string().optional().describe('Optional: Network'), ownerAddress: z.string().describe('Address of the owner') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('neofs_get_containers', args, this.neoServices, this.contractServices);
          return this.formatDelegatedToolResponse(result);
        } catch (error: any) {
          return this.createErrorResponse(error);
        }
      }
    );

  }

  /**
   * Setup resources using modern McpServer API
   */
  private setupResources() {
    logger.info('Setting up resources with modern API...');

    setupResourceHandlers(this.server, {
      networkMode: config.networkMode,
      getNeoService: (networkParam?: string) => this.getNeoService(networkParam),
    });
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
}

// Start the server if run directly
if (require.main === module) {
  const server = new NeoN3McpServer();
  server.run().catch((error) => {
    logger.error('Fatal error starting server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
} 