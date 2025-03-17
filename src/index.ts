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
import { NeoService } from './services/neo-service.js';
import { config } from './config.js';
import { 
  validateAddress, 
  validateHash, 
  validateAmount, 
  validatePassword,
  validateScriptHash
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
  private neoService: NeoService;

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

    this.neoService = new NeoService(config.neoRpcUrl);
    
    this.setupToolHandlers();
    this.setupResourceHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
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
            properties: {},
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
            },
            required: ['key'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_blockchain_info':
            return await this.handleGetBlockchainInfo();
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
          uri: 'neo://network/status',
          name: 'Neo N3 Network Status',
          description: 'Current status of the Neo N3 network',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        {
          uriTemplate: 'neo://block/{height}',
          name: 'Neo N3 Block by Height',
          description: 'Block information at a specific height',
          mimeType: 'application/json',
        },
        {
          uriTemplate: 'neo://address/{address}/balance',
          name: 'Neo N3 Address Balance',
          description: 'Balance information for a specific address',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        
        // Network status resource
        if (uri === 'neo://network/status') {
          const info = await this.neoService.getBlockchainInfo();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(info, null, 2),
              },
            ],
          };
        }
        
        // Block by height resource template
        const blockMatch = uri.match(/^neo:\/\/block\/(\d+)$/);
        if (blockMatch) {
          const height = parseInt(blockMatch[1], 10);
          const block = await this.neoService.getBlock(height);
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(block, null, 2),
              },
            ],
          };
        }
        
        // Address balance resource template
        const balanceMatch = uri.match(/^neo:\/\/address\/([A-Za-z0-9]+)\/balance$/);
        if (balanceMatch) {
          const address = balanceMatch[1];
          validateAddress(address);
          const balance = await this.neoService.getBalance(address);
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(balance, null, 2),
              },
            ],
          };
        }
        
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof McpError ? error.message : `Error reading resource: ${error.message || 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Handle get_blockchain_info tool
   */
  private async handleGetBlockchainInfo() {
    try {
      const info = await this.neoService.getBlockchainInfo();
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

      const block = await this.neoService.getBlock(args.hashOrHeight);
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
      const tx = await this.neoService.getTransaction(txid);
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
      const balance = await this.neoService.getBalance(address);
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
      
      // Transfer assets
      const result = await this.neoService.transferAssets(
        account,
        toAddress,
        args.asset,
        amount
      );

      return createSuccessResponse({
        txid: result.txid,
        message: 'Transfer successful',
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
      const neonJs = await import('@cityofzion/neon-js');
      const account = new neonJs.wallet.Account(args.fromWIF);
      
      // Convert arguments to contract parameters
      const contractArgs = Array.isArray(args.args) ? args.args.map((arg: any) => {
        // This is a simplified version - in a real implementation, you would need to handle different parameter types
        return neonJs.sc.ContractParam.any(arg);
      }) : [];

      // Invoke contract
      const result = await this.neoService.invokeContract(
        account,
        scriptHash,
        args.operation,
        contractArgs
      );

      return createSuccessResponse({
        txid: result.txid,
        message: 'Contract invocation successful',
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
      const wallet = this.neoService.createWallet(password);
      
      // Don't include the WIF in the response for security
      const safeResponse = {
        address: wallet.address,
        publicKey: wallet.publicKey,
        encryptedPrivateKey: wallet.encryptedPrivateKey,
      };

      return createSuccessResponse(safeResponse);
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

      const wallet = this.neoService.importWallet(args.key, password);
      return createSuccessResponse(wallet);
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
