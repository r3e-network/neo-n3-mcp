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
import { NeoService, NeoNetwork } from './services/neo-service.js';
import { config } from './config.js';
import { 
  validateAddress, 
  validateHash, 
  validateAmount, 
  validatePassword,
  validateScriptHash,
  validateNetwork
} from './utils/validation.js';
import { 
  handleError, 
  createSuccessResponse, 
  createErrorResponse 
} from './utils/error-handler.js';

/**
 * Neo N3 MCP Server
 * Exposes Neo N3 blockchain functionality as MCP tools and resources
 */
class NeoMcpServer {
  private server: Server;
  private neoServices: Map<NeoNetwork, NeoService>;

  constructor() {
    this.server = new Server(
      {
        name: 'neo-n3-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize Neo services for both networks
    this.neoServices = new Map();
    
    // Initialize mainnet service
    this.neoServices.set(
      NeoNetwork.MAINNET, 
      new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET)
    );
    
    // Initialize testnet service
    this.neoServices.set(
      NeoNetwork.TESTNET, 
      new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET)
    );
    
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
    if (!networkParam) {
      return this.neoServices.get(NeoNetwork.MAINNET)!;
    }
    
    const network = validateNetwork(networkParam);
    const service = this.neoServices.get(network);
    
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
          description: 'Create a new wallet',
          inputSchema: {
            type: 'object',
            properties: {
              password: {
                type: 'string',
                description: 'Password for encrypting the wallet',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['password'],
          },
        },
        {
          name: 'import_wallet',
          description: 'Import an existing wallet from WIF or encrypted key',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'WIF or encrypted private key',
              },
              password: {
                type: 'string',
                description: 'Password for decrypting the key (if encrypted)',
              },
              network: {
                type: 'string',
                description: 'Network to use: "mainnet" or "testnet"',
                enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
              },
            },
            required: ['key'],
          },
        },
        {
          name: 'estimate_transfer_fees',
          description: 'Estimate gas fees for an asset transfer',
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
          description: 'Check the status of a transaction by hash',
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_blockchain_info':
            return await this.handleGetBlockchainInfo(request.params.arguments);
          case 'get_block':
            return await this.handleGetBlock(request.params.arguments);
          case 'get_transaction':
            return await this.handleGetTransaction(request.params.arguments);
          case 'get_balance':
            return await this.handleGetBalance(request.params.arguments);
          case 'transfer_assets':
            return await this.handleTransferAssets(request.params.arguments);
          case 'invoke_contract':
            return await this.handleInvokeContract(request.params.arguments);
          case 'create_wallet':
            return await this.handleCreateWallet(request.params.arguments);
          case 'import_wallet':
            return await this.handleImportWallet(request.params.arguments);
          case 'estimate_transfer_fees':
            return await this.handleEstimateTransferFees(request.params.arguments);
          case 'check_transaction_status':
            return await this.handleCheckTransactionStatus(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        return handleError(error);
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
   * Run the server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Neo N3 MCP server running on stdio');
  }
}

// Create and run the server
const server = new NeoMcpServer();
server.run().catch(console.error);
