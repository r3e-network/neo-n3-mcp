#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { NeoService, NeoNetwork } from './services/neo-service';
import { ContractService } from './contracts/contract-service';
// Import FAMOUS_CONTRACTS for contract definitions
import { FAMOUS_CONTRACTS } from './contracts/contracts';
import { config, NetworkMode } from './config';
import {
  validateAddress,
  validateHash,
  validateAmount,
  validatePassword,
  validateScriptHash,
  validateNetwork
} from './utils/validation';
import {
  handleError,
  createSuccessResponse,
  createErrorResponse
} from './utils/error-handler';

/**
 * Neo N3 MCP Server
 * Exposes Neo N3 blockchain functionality as MCP tools and resources
 */
export class NeoMcpServer {
  private server: Server;
  private neoServices: Map<NeoNetwork, NeoService>;
  private contractServices: Map<NeoNetwork, ContractService>;

  constructor() {
    this.server = new Server(
      {
        name: 'neo-n3-mcp-server',
        version: '1.2.1',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize Neo services based on network mode
    this.neoServices = new Map();
    this.contractServices = new Map();

    // Initialize mainnet services if mainnet is enabled
    if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
      console.log('Initializing mainnet services...');

      // Initialize mainnet service
      this.neoServices.set(
        NeoNetwork.MAINNET,
        new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET)
      );

      // Initialize mainnet contract service
      this.contractServices.set(
        NeoNetwork.MAINNET,
        new ContractService(config.mainnetRpcUrl, NeoNetwork.MAINNET)
      );
    }

    // Initialize testnet services if testnet is enabled
    if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
      console.log('Initializing testnet services...');

      // Initialize testnet service
      this.neoServices.set(
        NeoNetwork.TESTNET,
        new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET)
      );

      // Initialize testnet contract service
      this.contractServices.set(
        NeoNetwork.TESTNET,
        new ContractService(config.testnetRpcUrl, NeoNetwork.TESTNET)
      );
    }

    // Log the active network mode
    console.log(`Network mode: ${config.networkMode}`);

    this.setupToolHandlers();
    this.setupResourceHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  /**
   * Get the appropriate Neo service for the requested network
   * @param networkParam Optional network parameter
   * @returns Neo service for the requested network
   */
  private getNeoService(networkParam?: string): NeoService {
    // If no network specified, use default based on network mode
    if (!networkParam) {
      // For testnet_only mode, return testnet service
      if (config.networkMode === NetworkMode.TESTNET_ONLY) {
        return this.neoServices.get(NeoNetwork.TESTNET)!;
      }
      // For all other modes, return mainnet service (if available)
      return this.neoServices.get(NeoNetwork.MAINNET)!;
    }

    // Validate the requested network
    const network = validateNetwork(networkParam);

    // Check if the requested network is enabled in the current mode
    if (
      (network === NeoNetwork.MAINNET &&
       config.networkMode === NetworkMode.TESTNET_ONLY) ||
      (network === NeoNetwork.TESTNET &&
       config.networkMode === NetworkMode.MAINNET_ONLY)
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Network ${network} is not enabled in the current mode (${config.networkMode})`
      );
    }

    const service = this.neoServices.get(network);

    if (!service) {
      throw new McpError(ErrorCode.InvalidParams, `Unsupported network: ${network}`);
    }

    return service;
  }

  /**
   * Get the appropriate Contract service for the requested network
   * @param networkParam Optional network parameter
   * @returns Contract service for the requested network
   */
  private getContractService(networkParam?: string): ContractService {
    // If no network specified, use default based on network mode
    if (!networkParam) {
      // For testnet_only mode, return testnet service
      if (config.networkMode === NetworkMode.TESTNET_ONLY) {
        return this.contractServices.get(NeoNetwork.TESTNET)!;
      }
      // For all other modes, return mainnet service (if available)
      return this.contractServices.get(NeoNetwork.MAINNET)!;
    }

    // Validate the requested network
    const network = validateNetwork(networkParam);

    // Check if the requested network is enabled in the current mode
    if (
      (network === NeoNetwork.MAINNET &&
       config.networkMode === NetworkMode.TESTNET_ONLY) ||
      (network === NeoNetwork.TESTNET &&
       config.networkMode === NetworkMode.MAINNET_ONLY)
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Network ${network} is not enabled in the current mode (${config.networkMode})`
      );
    }

    const service = this.contractServices.get(network);

    if (!service) {
      throw new McpError(ErrorCode.InvalidParams, `Unsupported network: ${network}`);
    }

    return service;
  }

  /**
   * Set up tool handlers
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_blockchain_info',
          description: 'Get general Neo N3 blockchain information',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: [],
          },
        },
        {
          name: 'get_block_count',
          description: 'Get the current block height of the Neo N3 blockchain',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: [],
          },
        },
        {
          name: 'get_block',
          description: 'Get block details by height or hash',
          inputSchema: {
            type: 'object',
            properties: {
              hashOrHeight: {
                oneOf: [
                  { type: 'string', description: 'Block hash' },
                  { type: 'number', description: 'Block height' },
                ],
                description: 'Block hash or height',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['hashOrHeight'],
          },
        },
        {
          name: 'get_transaction',
          description: 'Get transaction details by hash',
          inputSchema: {
            type: 'object',
            properties: {
              txid: {
                type: 'string',
                description: 'Transaction hash',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['txid'],
          },
        },
        {
          name: 'get_balance',
          description: 'Get account balance for a specific address',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'Neo N3 address',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['address'],
          },
        },
        {
          name: 'transfer_assets',
          description: 'Transfer assets between addresses',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the sender account',
              },
              toAddress: {
                type: 'string',
                description: 'Recipient address',
              },
              asset: {
                type: 'string',
                description: 'Asset hash or symbol (e.g., "NEO", "GAS")',
              },
              amount: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                ],
                description: 'Amount to transfer',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental transfers',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'toAddress', 'asset', 'amount', 'confirm'],
          },
        },
        {
          name: 'invoke_contract',
          description: 'Invoke a smart contract method',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              scriptHash: {
                type: 'string',
                description: 'Contract script hash',
              },
              operation: {
                type: 'string',
                description: 'Method name',
              },
              args: {
                type: 'array',
                items: {
                  type: 'object',
                },
                description: 'Method arguments',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'scriptHash', 'operation', 'confirm'],
          },
        },
        {
          name: 'create_wallet',
          description: 'Create a new Neo N3 wallet',
          inputSchema: {
            type: 'object',
            properties: {
              password: {
                type: 'string',
                description: 'Password to encrypt the wallet',
              },
            },
            required: ['password'],
          },
        },
        {
          name: 'import_wallet',
          description: 'Import a Neo N3 wallet from private key or WIF',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Private key or WIF',
              },
              password: {
                type: 'string',
                description: 'Password to encrypt the wallet',
              },
            },
            required: ['key'],
          },
        },
        {
          name: 'estimate_transfer_fees',
          description: 'Estimate fees for a transfer transaction',
          inputSchema: {
            type: 'object',
            properties: {
              fromAddress: {
                type: 'string',
                description: 'Sender address',
              },
              toAddress: {
                type: 'string',
                description: 'Recipient address',
              },
              asset: {
                type: 'string',
                description: 'Asset hash or symbol (e.g., "NEO", "GAS")',
              },
              amount: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                ],
                description: 'Amount to transfer',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromAddress', 'toAddress', 'asset', 'amount'],
          },
        },
        {
          name: 'check_transaction_status',
          description: 'Check the status of a transaction',
          inputSchema: {
            type: 'object',
            properties: {
              txid: {
                type: 'string',
                description: 'Transaction hash',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['txid'],
          },
        },
        {
          name: 'list_famous_contracts',
          description: 'List famous Neo N3 contracts supported by the server',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: [],
          },
        },
        {
          name: 'get_contract_info',
          description: 'Get details about a famous Neo N3 contract',
          inputSchema: {
            type: 'object',
            properties: {
              contractName: {
                type: 'string',
                description: 'Contract name',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['contractName'],
          },
        },
        {
          name: 'get_network_mode',
          description: 'Get the current network mode configuration',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'set_network_mode',
          description: 'Set the active network mode',
          inputSchema: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                description: 'Network mode to set: "mainnet_only", "testnet_only", or "both"',
                enum: [NetworkMode.MAINNET_ONLY, NetworkMode.TESTNET_ONLY, NetworkMode.BOTH],
              },
            },
            required: ['mode'],
          },
        },
        // NeoFS specific tools
        {
          name: 'neofs_create_container',
          description: 'Create a NeoFS storage container',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              ownerId: {
                type: 'string',
                description: 'Owner ID of the container',
              },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                },
                description: 'Container rules',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'ownerId', 'confirm'],
          },
        },
        {
          name: 'neofs_get_containers',
          description: 'Get containers owned by an address in NeoFS',
          inputSchema: {
            type: 'object',
            properties: {
              ownerId: {
                type: 'string',
                description: 'Owner ID to query containers for',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['ownerId'],
          },
        },
        // NeoBurger specific tools
        {
          name: 'neoburger_deposit',
          description: 'Deposit NEO to NeoBurger to receive bNEO tokens',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'confirm'],
          },
        },
        {
          name: 'neoburger_withdraw',
          description: 'Withdraw NEO from NeoBurger by returning bNEO tokens',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              amount: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                ],
                description: 'Amount of bNEO to exchange',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'amount', 'confirm'],
          },
        },
        {
          name: 'neoburger_get_balance',
          description: 'Get bNEO balance of an account',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'Neo N3 address',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['address'],
          },
        },
        {
          name: 'neoburger_claim_gas',
          description: 'Claim accumulated GAS rewards from NeoBurger',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'confirm'],
          },
        },
        // Flamingo specific tools
        {
          name: 'flamingo_stake',
          description: 'Stake FLM tokens on Flamingo',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              amount: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                ],
                description: 'Amount to stake',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'amount', 'confirm'],
          },
        },
        {
          name: 'flamingo_unstake',
          description: 'Unstake FLM tokens from Flamingo',
          inputSchema: {
            type: 'object',
            properties: {
              fromWIF: {
                type: 'string',
                description: 'WIF of the account to sign the transaction',
              },
              amount: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                ],
                description: 'Amount to unstake',
              },
              confirm: {
                type: 'boolean',
                description: 'Confirmation flag to prevent accidental invocations',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['fromWIF', 'amount', 'confirm'],
          },
        },
        {
          name: 'flamingo_get_balance',
          description: 'Get FLM token balance',
          inputSchema: {
            type: 'object',
            properties: {
              address: {
                type: 'string',
                description: 'Neo N3 address',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['address'],
          },
        },
        // NeoCompound tools
        {
          name: 'neocompound_deposit',
          description: 'Deposit assets into NeoCompound',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              assetId: {
                type: 'string',
                description: 'Script hash of the asset to deposit',
              },
              amount: {
                type: ['string', 'number'],
                description: 'Amount to deposit',
              },
            },
            required: ['walletPath', 'walletPassword', 'assetId', 'amount'],
          },
        },
        {
          name: 'neocompound_withdraw',
          description: 'Withdraw assets from NeoCompound',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              assetId: {
                type: 'string',
                description: 'Script hash of the asset to withdraw',
              },
              amount: {
                type: ['string', 'number'],
                description: 'Amount to withdraw',
              },
            },
            required: ['walletPath', 'walletPassword', 'assetId', 'amount'],
          },
        },
        {
          name: 'neocompound_get_balance',
          description: 'Get balance of deposited assets in NeoCompound',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              address: {
                type: 'string',
                description: 'Address to check balance for',
              },
              assetId: {
                type: 'string',
                description: 'Script hash of the asset to check balance for',
              },
            },
            required: ['address', 'assetId'],
          },
        },
        // GrandShare tools
        {
          name: 'grandshare_deposit',
          description: 'Deposit assets into GrandShare pool',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              poolId: {
                type: 'number',
                description: 'ID of the pool to deposit into',
              },
              amount: {
                type: ['string', 'number'],
                description: 'Amount to deposit',
              },
            },
            required: ['walletPath', 'walletPassword', 'poolId', 'amount'],
          },
        },
        {
          name: 'grandshare_withdraw',
          description: 'Withdraw assets from GrandShare pool',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              poolId: {
                type: 'number',
                description: 'ID of the pool to withdraw from',
              },
              amount: {
                type: ['string', 'number'],
                description: 'Amount to withdraw',
              },
            },
            required: ['walletPath', 'walletPassword', 'poolId', 'amount'],
          },
        },
        {
          name: 'grandshare_get_pool_details',
          description: 'Get details about a GrandShare pool',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              poolId: {
                type: 'number',
                description: 'ID of the pool to query',
              },
            },
            required: ['poolId'],
          },
        },
        // GhostMarket tools
        {
          name: 'ghostmarket_create_nft',
          description: 'Create a new NFT on GhostMarket',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              tokenURI: {
                type: 'string',
                description: 'URI for token metadata',
              },
              properties: {
                type: 'array',
                description: 'Array of property objects for the NFT',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' }
                  }
                }
              },
            },
            required: ['walletPath', 'walletPassword', 'tokenURI'],
          },
        },
        {
          name: 'ghostmarket_list_nft',
          description: 'List an NFT for sale on GhostMarket',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              tokenId: {
                type: 'number',
                description: 'ID of the token to list',
              },
              price: {
                type: ['string', 'number'],
                description: 'Price of the token',
              },
              paymentToken: {
                type: 'string',
                description: 'Script hash of token accepted as payment',
              },
            },
            required: ['walletPath', 'walletPassword', 'tokenId', 'price', 'paymentToken'],
          },
        },
        {
          name: 'ghostmarket_buy_nft',
          description: 'Buy a listed NFT on GhostMarket',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              walletPath: {
                type: 'string',
                description: 'Path to the wallet file',
              },
              walletPassword: {
                type: 'string',
                description: 'Password for the wallet',
              },
              tokenId: {
                type: 'number',
                description: 'ID of the token to buy',
              },
            },
            required: ['walletPath', 'walletPassword', 'tokenId'],
          },
        },
        {
          name: 'ghostmarket_get_token_info',
          description: 'Get information about an NFT on GhostMarket',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
              tokenId: {
                type: 'number',
                description: 'ID of the token to query',
              },
            },
            required: ['tokenId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: input = {} } = request.params;

      switch (name) {
        case 'get_blockchain_info':
          return await this.handleGetBlockchainInfo(input);
        case 'get_block_count':
          return await this.handleGetBlockCount(input);
        case 'get_block':
          return await this.handleGetBlock(input);
        case 'get_transaction':
          return await this.handleGetTransaction(input);
        case 'get_balance':
          return await this.handleGetBalance(input);
        case 'transfer_assets':
          return await this.handleTransferAssets(input);
        case 'invoke_contract':
          return await this.handleInvokeContract(input);
        case 'create_wallet':
          return await this.handleCreateWallet(input);
        case 'import_wallet':
          return await this.handleImportWallet(input);
        case 'estimate_transfer_fees':
          return await this.handleEstimateTransferFees(input);
        case 'check_transaction_status':
          return await this.handleCheckTransactionStatus(input);
        // New famous contract handlers
        case 'list_famous_contracts':
          return await this.handleListFamousContracts(input);
        case 'get_contract_info':
          return await this.handleGetContractInfo(input);
        case 'get_network_mode':
          return await this.handleGetNetworkMode();
        case 'set_network_mode':
          return await this.handleSetNetworkMode(input);
        // NeoFS handlers
        case 'neofs_create_container':
          return await this.handleNeoFSCreateContainer(input);
        case 'neofs_get_containers':
          return await this.handleNeoFSGetContainers(input);
        // NeoBurger handlers
        case 'neoburger_deposit':
          return await this.handleNeoBurgerDeposit(input);
        case 'neoburger_withdraw':
          return await this.handleNeoBurgerWithdraw(input);
        case 'neoburger_get_balance':
          return await this.handleNeoBurgerGetBalance(input);
        case 'neoburger_claim_gas':
          return await this.handleNeoBurgerClaimGas(input);
        // Flamingo handlers
        case 'flamingo_stake':
          return await this.handleFlamingoStake(input);
        case 'flamingo_unstake':
          return await this.handleFlamingoUnstake(input);
        case 'flamingo_get_balance':
          return await this.handleFlamingoGetBalance(input);
        // NeoCompound handlers
        case 'neocompound_deposit':
          return await this.handleNeoCompoundDeposit(input);
        case 'neocompound_withdraw':
          return await this.handleNeoCompoundWithdraw(input);
        case 'neocompound_get_balance':
          return await this.handleNeoCompoundGetBalance(input);
        // GrandShare handlers
        case 'grandshare_deposit':
          return await this.handleGrandShareDeposit(input);
        case 'grandshare_withdraw':
          return await this.handleGrandShareWithdraw(input);
        case 'grandshare_get_pool_details':
          return await this.handleGrandShareGetPoolDetails(input);
        // GhostMarket handlers
        case 'ghostmarket_create_nft':
          return await this.handleGhostMarketCreateNFT(input);
        case 'ghostmarket_list_nft':
          return await this.handleGhostMarketListNFT(input);
        case 'ghostmarket_buy_nft':
          return await this.handleGhostMarketBuyNFT(input);
        case 'ghostmarket_get_token_info':
          return await this.handleGhostMarketGetTokenInfo(input);
        default:
          throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
      }
    });
  }

  /**
   * Set up resource handlers
   */
  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          name: 'neo://network/status',
          description: 'Get the current status of the Neo N3 network',
        },
        {
          name: 'neo://mainnet/status',
          description: 'Get the current status of the Neo N3 mainnet',
        },
        {
          name: 'neo://testnet/status',
          description: 'Get the current status of the Neo N3 testnet',
        },
        {
          name: 'neo://block/{height}',
          description: 'Get a block by height',
        },
        {
          name: 'neo://mainnet/block/{height}',
          description: 'Get a block by height from mainnet',
        },
        {
          name: 'neo://testnet/block/{height}',
          description: 'Get a block by height from testnet',
        },
        {
          name: 'neo://address/{address}/balance',
          description: 'Get the balance of a Neo N3 address',
        },
        {
          name: 'neo://mainnet/address/{address}/balance',
          description: 'Get the balance of a Neo N3 address on mainnet',
        },
        {
          name: 'neo://testnet/address/{address}/balance',
          description: 'Get the balance of a Neo N3 address on testnet',
        },
      ],
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          template: 'neo://network/status',
          description: 'Get the current status of the Neo N3 network (defaults to mainnet)',
        },
        {
          template: 'neo://mainnet/status',
          description: 'Get the current status of the Neo N3 mainnet',
        },
        {
          template: 'neo://testnet/status',
          description: 'Get the current status of the Neo N3 testnet',
        },
        {
          template: 'neo://block/{height}',
          description: 'Get a block by height (defaults to mainnet)',
          parameters: [
            {
              name: 'height',
              description: 'The height of the block',
            },
          ],
        },
        {
          template: 'neo://mainnet/block/{height}',
          description: 'Get a block by height from mainnet',
          parameters: [
            {
              name: 'height',
              description: 'The height of the block',
            },
          ],
        },
        {
          template: 'neo://testnet/block/{height}',
          description: 'Get a block by height from testnet',
          parameters: [
            {
              name: 'height',
              description: 'The height of the block',
            },
          ],
        },
        {
          template: 'neo://address/{address}/balance',
          description: 'Get the balance of a Neo N3 address (defaults to mainnet)',
          parameters: [
            {
              name: 'address',
              description: 'The Neo N3 address',
            },
          ],
        },
        {
          template: 'neo://mainnet/address/{address}/balance',
          description: 'Get the balance of a Neo N3 address on mainnet',
          parameters: [
            {
              name: 'address',
              description: 'The Neo N3 address',
            },
          ],
        },
        {
          template: 'neo://testnet/address/{address}/balance',
          description: 'Get the balance of a Neo N3 address on testnet',
          parameters: [
            {
              name: 'address',
              description: 'The Neo N3 address',
            },
          ],
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        if (typeof request.params.name !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Resource name must be a string');
        }

        const url = new URL(request.params.name);
        const pathParts = url.pathname.split('/').filter(Boolean);

        // Check if the first part is a network specifier
        let network = NeoNetwork.MAINNET;
        let startIndex = 0;

        if (pathParts[0] === 'mainnet') {
          network = NeoNetwork.MAINNET;
          startIndex = 1;
        } else if (pathParts[0] === 'testnet') {
          network = NeoNetwork.TESTNET;
          startIndex = 1;
        }

        const neoService = this.getNeoService(network);

        // Handle resources
        if (pathParts[startIndex] === 'network' && pathParts[startIndex + 1] === 'status') {
          const info = await neoService.getBlockchainInfo();
          return createSuccessResponse(info);
        }

        if (pathParts[startIndex] === 'block' && pathParts[startIndex + 1]) {
          const height = parseInt(pathParts[startIndex + 1], 10);
          if (isNaN(height)) {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid block height');
          }
          const block = await neoService.getBlock(height);
          return createSuccessResponse(block);
        }

        if (pathParts[startIndex] === 'address' && pathParts[startIndex + 2] === 'balance') {
          const address = pathParts[startIndex + 1];
          validateAddress(address);
          const balance = await neoService.getBalance(address);
          return createSuccessResponse(balance);
        }

        throw new McpError(
          ErrorCode.InvalidParams,
          `Resource not found: ${request.params.name}`
        );
      } catch (error) {
        return handleError(error);
      }
    });
  }

  /**
   * Handle get_blockchain_info tool
   */
  private async handleGetBlockchainInfo(args: any) {
    try {
      const neoService = this.getNeoService(args?.network);
      const info = await neoService.getBlockchainInfo();
      return createSuccessResponse(info);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle get_block_count tool
   */
  private async handleGetBlockCount(args: any) {
    try {
      const neoService = this.getNeoService(args?.network);
      const count = await neoService.getBlockCount();
      return createSuccessResponse(count);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle get_block tool
   */
  private async handleGetBlock(args: any) {
    try {
      if (typeof args.hashOrHeight === 'string') {
        validateHash(args.hashOrHeight);
      } else if (typeof args.hashOrHeight !== 'number') {
        throw new McpError(ErrorCode.InvalidParams, 'hashOrHeight must be a string or number');
      }

      const neoService = this.getNeoService(args?.network);
      const block = await neoService.getBlock(args.hashOrHeight);
      return createSuccessResponse(block);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle get_transaction tool
   */
  private async handleGetTransaction(args: any) {
    try {
      const txid = validateHash(args.txid);
      const neoService = this.getNeoService(args?.network);
      const tx = await neoService.getTransaction(txid);
      return createSuccessResponse(tx);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle get_balance tool
   */
  private async handleGetBalance(args: any) {
    try {
      const address = validateAddress(args.address);
      const neoService = this.getNeoService(args?.network);
      const balance = await neoService.getBalance(address);
      return createSuccessResponse(balance);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle transfer_assets tool
   */
  private async handleTransferAssets(args: any) {
    try {
      if (!args.confirm) {
        return createErrorResponse('Transfer not confirmed. Please set confirm=true to proceed with the transfer.');
      }

      const toAddress = validateAddress(args.toAddress);
      const amount = validateAmount(args.amount);

      if (typeof args.fromWIF !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'fromWIF must be a string');
      }

      if (typeof args.asset !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'asset must be a string');
      }

      // Import the wallet from WIF
      const account = new (await import('@cityofzion/neon-js')).wallet.Account(args.fromWIF);

      // Get the right service for the requested network
      const neoService = this.getNeoService(args?.network);

      // Transfer assets
      const result = await neoService.transferAssets(
        account,
        toAddress,
        args.asset,
        amount
      );

      return createSuccessResponse({
        txid: result.txid,
        message: 'Transfer successful',
        network: neoService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle invoke_contract tool
   */
  private async handleInvokeContract(args: any) {
    try {
      if (!args.confirm) {
        return createErrorResponse('Contract invocation not confirmed. Please set confirm=true to proceed with the invocation.');
      }

      const scriptHash = validateScriptHash(args.scriptHash);

      if (typeof args.fromWIF !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'fromWIF must be a string');
      }

      if (typeof args.operation !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'operation must be a string');
      }

      // Import the wallet from WIF
      const account = new (await import('@cityofzion/neon-js')).wallet.Account(args.fromWIF);

      // Get the right service for the requested network
      const neoService = this.getNeoService(args?.network);

      // Invoke contract
      const result = await neoService.invokeContract(
        account,
        scriptHash,
        args.operation,
        args.args || []
      );

      return createSuccessResponse({
        txid: result.txid,
        message: 'Contract invocation successful',
        network: neoService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle create_wallet tool
   */
  private async handleCreateWallet(args: any) {
    try {
      const password = validatePassword(args.password);

      // Network doesn't actually matter for wallet creation,
      // but we'll include it in the response
      const neoService = this.getNeoService(args?.network);

      const wallet = neoService.createWallet(password);
      return createSuccessResponse({
        ...wallet,
        network: neoService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle import_wallet tool
   */
  private async handleImportWallet(args: any) {
    try {
      if (typeof args.key !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'key must be a string');
      }

      let password: string | undefined;
      if (args.password) {
        password = validatePassword(args.password);
      }

      // Network doesn't actually matter for wallet import,
      // but we'll include it in the response
      const neoService = this.getNeoService(args?.network);

      const wallet = neoService.importWallet(args.key, password);
      return createSuccessResponse({
        ...wallet,
        network: neoService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle estimate_transfer_fees tool
   */
  private async handleEstimateTransferFees(args: any) {
    try {
      const fromAddress = validateAddress(args.fromAddress);
      const toAddress = validateAddress(args.toAddress);
      const asset = validateScriptHash(args.asset);
      const amount = validateAmount(args.amount);

      if (typeof args.network !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'network must be a string');
      }

      const network = validateNetwork(args.network);
      const neoService = this.getNeoService(network);

      const fees = await neoService.estimateTransferFees(fromAddress, toAddress, asset, amount);
      return createSuccessResponse(fees);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle check_transaction_status tool
   */
  private async handleCheckTransactionStatus(args: any) {
    try {
      const txid = validateHash(args.txid);
      const neoService = this.getNeoService(args?.network);
      const status = await neoService.checkTransactionStatus(txid);
      return createSuccessResponse(status);
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * List all famous Neo N3 contracts
   * @param args Input arguments
   * @returns List of contracts with descriptions
   */
  private async handleListFamousContracts(args: any) {
    try {
      const { network } = args;
      const contractService = this.getContractService(network);

      const contracts = contractService.listSupportedContracts();
      const availableContracts = contracts.filter(contract => {
        return contractService.isContractAvailable(contract.name);
      });

      return createSuccessResponse({
        contracts: availableContracts,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Get details about a famous Neo N3 contract
   * @param args Input arguments
   * @returns Contract details
   */
  private async handleGetContractInfo(args: any) {
    try {
      const { contractName, network } = args;

      if (!contractName) {
        throw new McpError(ErrorCode.InvalidParams, 'Contract name is required');
      }

      const contractService = this.getContractService(network);

      try {
        const contract = contractService.getContract(contractName);
        const operations = contractService.getContractOperations(contractName);
        const scriptHash = contractService.getContractScriptHash(contractName);

        return createSuccessResponse({
          name: contract.name,
          description: contract.description,
          scriptHash,
          operations,
          network: contractService.getNetwork()
        });
      } catch (error) {
        throw new McpError(ErrorCode.InvalidParams, `Contract ${contractName} not found or not available on this network`);
      }
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Create a NeoFS storage container
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleNeoFSCreateContainer(args: any) {
    try {
      const { fromWIF, ownerId, rules, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!ownerId) {
        throw new McpError(ErrorCode.InvalidParams, 'Owner ID is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Create container
      const txid = await contractService.createNeoFSContainer(
        account,
        ownerId,
        rules || []
      );

      return createSuccessResponse({
        txid,
        message: 'NeoFS container creation transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Get NeoFS containers owned by an address
   * @param args Input arguments
   * @returns Containers information
   */
  private async handleNeoFSGetContainers(args: any) {
    try {
      const { ownerId, network } = args;

      if (!ownerId) {
        throw new McpError(ErrorCode.InvalidParams, 'Owner ID is required');
      }

      const contractService = this.getContractService(network);

      const result = await contractService.getNeoFSContainers(ownerId);

      return createSuccessResponse({
        result,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Deposit NEO to NeoBurger
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleNeoBurgerDeposit(args: any) {
    try {
      const { fromWIF, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Deposit to NeoBurger
      const txid = await contractService.depositNeoToNeoBurger(account);

      return createSuccessResponse({
        txid,
        message: 'NEO deposit to NeoBurger transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Withdraw NEO from NeoBurger
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleNeoBurgerWithdraw(args: any) {
    try {
      const { fromWIF, amount, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!amount) {
        throw new McpError(ErrorCode.InvalidParams, 'Amount is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Validate amount
      validateAmount(amount);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Withdraw from NeoBurger
      const txid = await contractService.withdrawNeoFromNeoBurger(account, amount);

      return createSuccessResponse({
        txid,
        message: 'NEO withdrawal from NeoBurger transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Get bNEO balance from NeoBurger
   * @param args Input arguments
   * @returns Balance information
   */
  private async handleNeoBurgerGetBalance(args: any) {
    try {
      const { address, network } = args;

      if (!address) {
        throw new McpError(ErrorCode.InvalidParams, 'Address is required');
      }

      // Validate address
      validateAddress(address);

      const contractService = this.getContractService(network);

      const result = await contractService.getNeoBurgerBalance(address);

      return createSuccessResponse({
        result,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Claim GAS rewards from NeoBurger
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleNeoBurgerClaimGas(args: any) {
    try {
      const { fromWIF, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Claim GAS from NeoBurger
      const txid = await contractService.claimNeoBurgerGas(account);

      return createSuccessResponse({
        txid,
        message: 'GAS claim from NeoBurger transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Stake FLM tokens on Flamingo
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleFlamingoStake(args: any) {
    try {
      const { fromWIF, amount, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!amount) {
        throw new McpError(ErrorCode.InvalidParams, 'Amount is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Validate amount
      validateAmount(amount);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Stake on Flamingo
      const txid = await contractService.stakeFlamingo(account, amount);

      return createSuccessResponse({
        txid,
        message: 'FLM staking transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Unstake FLM tokens from Flamingo
   * @param args Input arguments
   * @returns Transaction hash
   */
  private async handleFlamingoUnstake(args: any) {
    try {
      const { fromWIF, amount, confirm, network } = args;

      if (!fromWIF) {
        throw new McpError(ErrorCode.InvalidParams, 'WIF is required');
      }

      if (!amount) {
        throw new McpError(ErrorCode.InvalidParams, 'Amount is required');
      }

      if (!confirm) {
        throw new McpError(ErrorCode.InvalidParams, 'Confirmation is required');
      }

      const contractService = this.getContractService(network);
      const neoService = this.getNeoService(network);

      // Validate amount
      validateAmount(amount);

      // Import wallet
      const account = neoService.importWallet(fromWIF);

      // Unstake from Flamingo
      const txid = await contractService.unstakeFlamingo(account, amount);

      return createSuccessResponse({
        txid,
        message: 'FLM unstaking transaction sent'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Get FLM token balance
   * @param args Input arguments
   * @returns Balance information
   */
  private async handleFlamingoGetBalance(args: any) {
    try {
      const { address, network } = args;

      if (!address) {
        throw new McpError(ErrorCode.InvalidParams, 'Address is required');
      }

      // Validate address
      validateAddress(address);

      const contractService = this.getContractService(network);

      const result = await contractService.getFlamingoBalance(address);

      return createSuccessResponse({
        result,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleNeoCompoundDeposit(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        assetId,
        amount
      } = args;

      // Validate asset ID
      const validAssetId = validateScriptHash(assetId);

      // Validate amount
      const validAmount = validateAmount(amount);

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Deposit assets to NeoCompound
      const txid = await contractService.depositToNeoCompound(account, validAssetId, validAmount);

      return createSuccessResponse({
        txid,
        address: account.address,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleNeoCompoundWithdraw(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        assetId,
        amount
      } = args;

      // Validate asset ID
      const validAssetId = validateScriptHash(assetId);

      // Validate amount
      const validAmount = validateAmount(amount);

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Withdraw assets from NeoCompound
      const txid = await contractService.withdrawFromNeoCompound(account, validAssetId, validAmount);

      return createSuccessResponse({
        txid,
        address: account.address,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleNeoCompoundGetBalance(args: any) {
    try {
      const { network, address, assetId } = args;

      // Validate address
      const validAddress = validateAddress(address);

      // Validate asset ID
      const validAssetId = validateScriptHash(assetId);

      // Get the appropriate contract service
      const contractService = this.getContractService(network);

      // Get balance from NeoCompound
      const result = await contractService.getNeoCompoundBalance(validAddress, validAssetId);

      return createSuccessResponse({
        balance: result,
        address: validAddress,
        assetId: validAssetId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGrandShareDeposit(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        poolId,
        amount
      } = args;

      // Validate pool ID and amount
      if (typeof poolId !== 'number' || poolId < 0) {
        throw new Error('Invalid pool ID');
      }

      const validAmount = validateAmount(amount);

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Deposit assets to GrandShare
      const txid = await contractService.depositToGrandShare(account, poolId, validAmount);

      return createSuccessResponse({
        txid,
        address: account.address,
        poolId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGrandShareWithdraw(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        poolId,
        amount
      } = args;

      // Validate pool ID and amount
      if (typeof poolId !== 'number' || poolId < 0) {
        throw new Error('Invalid pool ID');
      }

      const validAmount = validateAmount(amount);

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Withdraw assets from GrandShare
      const txid = await contractService.withdrawFromGrandShare(account, poolId, validAmount);

      return createSuccessResponse({
        txid,
        address: account.address,
        poolId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGrandShareGetPoolDetails(args: any) {
    try {
      const { network, poolId } = args;

      // Validate pool ID
      if (typeof poolId !== 'number' || poolId < 0) {
        throw new Error('Invalid pool ID');
      }

      // Get the appropriate contract service
      const contractService = this.getContractService(network);

      // Get pool details from GrandShare
      const result = await contractService.getGrandSharePoolDetails(poolId);

      return createSuccessResponse({
        poolDetails: result,
        poolId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGhostMarketCreateNFT(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        tokenURI,
        properties = []
      } = args;

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Create NFT on GhostMarket
      const txid = await contractService.createGhostMarketNFT(account, tokenURI, properties);

      return createSuccessResponse({
        txid,
        address: account.address,
        tokenURI,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGhostMarketListNFT(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        tokenId,
        price,
        paymentToken
      } = args;

      // Validate token ID
      if (typeof tokenId !== 'number' || tokenId < 0) {
        throw new Error('Invalid token ID');
      }

      // Validate price and payment token
      const validPrice = validateAmount(price);
      const validPaymentToken = validateScriptHash(paymentToken);

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // List NFT on GhostMarket
      const txid = await contractService.listGhostMarketNFT(account, tokenId, validPrice, validPaymentToken);

      return createSuccessResponse({
        txid,
        address: account.address,
        tokenId,
        price: validPrice,
        paymentToken: validPaymentToken,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGhostMarketBuyNFT(args: any) {
    try {
      const {
        network,
        walletPath,
        walletPassword,
        tokenId
      } = args;

      // Validate token ID
      if (typeof tokenId !== 'number' || tokenId < 0) {
        throw new Error('Invalid token ID');
      }

      // Get the appropriate services
      const neoService = this.getNeoService(network);
      const contractService = this.getContractService(network);

      // Import the wallet
      const account = neoService.importWallet(walletPath, walletPassword);

      // Buy NFT on GhostMarket
      const txid = await contractService.buyGhostMarketNFT(account, tokenId);

      return createSuccessResponse({
        txid,
        address: account.address,
        tokenId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  private async handleGhostMarketGetTokenInfo(args: any) {
    try {
      const { network, tokenId } = args;

      // Validate token ID
      if (typeof tokenId !== 'number' || tokenId < 0) {
        throw new Error('Invalid token ID');
      }

      // Get the appropriate contract service
      const contractService = this.getContractService(network);

      // Get token info from GhostMarket
      const result = await contractService.getGhostMarketTokenInfo(tokenId);

      return createSuccessResponse({
        tokenInfo: result,
        tokenId,
        network: contractService.getNetwork()
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle get_network_mode tool
   * @returns Current network mode configuration
   */
  private async handleGetNetworkMode() {
    try {
      // Get the available networks based on the current mode
      const availableNetworks = [];

      if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        availableNetworks.push(NeoNetwork.MAINNET);
      }

      if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        availableNetworks.push(NeoNetwork.TESTNET);
      }

      return createSuccessResponse({
        mode: config.networkMode,
        availableNetworks,
        defaultNetwork: config.networkMode === NetworkMode.TESTNET_ONLY ?
          NeoNetwork.TESTNET : NeoNetwork.MAINNET
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Handle set_network_mode tool
   * @param args Input arguments
   * @returns Updated network mode configuration
   */
  private async handleSetNetworkMode(args: any) {
    try {
      const { mode } = args;

      if (!mode) {
        throw new McpError(ErrorCode.InvalidParams, 'Mode is required');
      }

      // Validate the mode
      if (![NetworkMode.MAINNET_ONLY, NetworkMode.TESTNET_ONLY, NetworkMode.BOTH].includes(mode)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid mode: ${mode}. Must be one of: ${NetworkMode.MAINNET_ONLY}, ${NetworkMode.TESTNET_ONLY}, ${NetworkMode.BOTH}`
        );
      }

      // Update the network mode
      (config as any).networkMode = mode;

      console.log(`Network mode updated to: ${mode}`);

      // Reinitialize services based on the new mode
      this.neoServices.clear();
      this.contractServices.clear();

      // Initialize mainnet services if mainnet is enabled
      if (mode === NetworkMode.MAINNET_ONLY || mode === NetworkMode.BOTH) {
        console.log('Initializing mainnet services...');

        // Initialize mainnet service
        this.neoServices.set(
          NeoNetwork.MAINNET,
          new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET)
        );

        // Initialize mainnet contract service
        this.contractServices.set(
          NeoNetwork.MAINNET,
          new ContractService(config.mainnetRpcUrl, NeoNetwork.MAINNET)
        );
      }

      // Initialize testnet services if testnet is enabled
      if (mode === NetworkMode.TESTNET_ONLY || mode === NetworkMode.BOTH) {
        console.log('Initializing testnet services...');

        // Initialize testnet service
        this.neoServices.set(
          NeoNetwork.TESTNET,
          new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET)
        );

        // Initialize testnet contract service
        this.contractServices.set(
          NeoNetwork.TESTNET,
          new ContractService(config.testnetRpcUrl, NeoNetwork.TESTNET)
        );
      }

      // Get the available networks based on the new mode
      const availableNetworks = [];

      if (mode === NetworkMode.MAINNET_ONLY || mode === NetworkMode.BOTH) {
        availableNetworks.push(NeoNetwork.MAINNET);
      }

      if (mode === NetworkMode.TESTNET_ONLY || mode === NetworkMode.BOTH) {
        availableNetworks.push(NeoNetwork.TESTNET);
      }

      return createSuccessResponse({
        mode,
        availableNetworks,
        defaultNetwork: mode === NetworkMode.TESTNET_ONLY ?
          NeoNetwork.TESTNET : NeoNetwork.MAINNET,
        message: 'Network mode updated successfully'
      });
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * Run the server
   */
  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('Neo N3 MCP Server started');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

/**
 * Handle MCP request
 * This function is used for testing purposes
 * @param request MCP request
 * @returns MCP response
 */
export async function handleMcpRequest(request: any) {
  const testServer = new NeoMcpServer();

  // Create a mock handler function that simulates the MCP server's request handling
  const mockHandler = async (req: any) => {
    try {
      // Get the appropriate service based on the network parameter
      const networkParam = req.arguments?.network;

      switch (req.name) {
        case 'get_blockchain_info':
          const neoService = testServer['getNeoService'](networkParam);
          const blockchainInfo = await neoService.getBlockchainInfo();
          return createSuccessResponse(blockchainInfo);

        case 'get_block':
          if (!req.arguments?.hashOrHeight) {
            return createErrorResponse('Missing required parameter: hashOrHeight', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getNeoService'](networkParam).getBlock(req.arguments.hashOrHeight)
          );

        case 'get_transaction':
          if (!req.arguments?.txid) {
            return createErrorResponse('Missing required parameter: txid', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getNeoService'](networkParam).getTransaction(req.arguments.txid)
          );

        case 'get_balance':
          if (!req.arguments?.address) {
            return createErrorResponse('Missing required parameter: address', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getNeoService'](networkParam).getBalance(req.arguments.address)
          );

        case 'transfer_assets':
          if (!req.arguments?.fromWIF || !req.arguments?.toAddress ||
              !req.arguments?.asset || !req.arguments?.amount || req.arguments?.confirm !== true) {
            return createErrorResponse('Missing required parameters for transfer_assets', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getNeoService'](networkParam).transferAssets(
              req.arguments.fromWIF,
              req.arguments.toAddress,
              req.arguments.asset,
              req.arguments.amount
            )
          );

        case 'create_wallet':
          if (!req.arguments?.password) {
            return createErrorResponse('Missing required parameter: password', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            testServer['getNeoService'](networkParam).createWallet(req.arguments.password)
          );

        case 'import_wallet':
          if (!req.arguments?.key) {
            return createErrorResponse('Missing required parameter: key', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            testServer['getNeoService'](networkParam).importWallet(req.arguments.key, req.arguments.password)
          );

        case 'list_famous_contracts':
          const contracts = testServer['getContractService'](networkParam).listSupportedContracts();
          return createSuccessResponse({ contracts });

        case 'get_contract_info':
          if (!req.arguments?.contractName) {
            return createErrorResponse('Missing required parameter: contractName', ErrorCode.InvalidParams);
          }
          const contractInfo = testServer['getContractService'](networkParam).getContract(req.arguments.contractName);
          return createSuccessResponse(contractInfo);

        case 'invoke_read_contract':
          if (!req.arguments?.contractName || !req.arguments?.operation) {
            return createErrorResponse('Missing required parameters for invoke_read_contract', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getContractService'](networkParam).invokeReadContract(
              req.arguments.contractName,
              req.arguments.operation,
              req.arguments.args || []
            )
          );

        case 'invoke_write_contract':
          if (!req.arguments?.fromWIF || !req.arguments?.contractName ||
              !req.arguments?.operation || req.arguments?.confirm !== true) {
            return createErrorResponse('Missing required parameters for invoke_write_contract', ErrorCode.InvalidParams);
          }
          return createSuccessResponse(
            await testServer['getContractService'](networkParam).invokeWriteContract(
              req.arguments.fromWIF,
              req.arguments.contractName,
              req.arguments.operation,
              req.arguments.args || []
            )
          );

        default:
          return createErrorResponse(`Invalid tool name: ${req.name}`, ErrorCode.InvalidRequest);
      }
    } catch (error) {
      return handleError(error);
    }
  };

  return await mockHandler(request);
}

// Start the server
const mainServer = new NeoMcpServer();
mainServer.run().catch(console.error);
