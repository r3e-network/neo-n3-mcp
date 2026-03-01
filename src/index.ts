#!/usr/bin/env node

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as neonJs from '@cityofzion/neon-js';

import { NeoService, NeoNetwork } from './services/neo-service';
import { ContractService } from './contracts/contract-service';
import { callTool } from './handlers/tool-handler';
import { config, NetworkMode } from './config';
import {
  validateAddress,
  validateHash,
  validateAmount,
  validatePassword,
  validateScriptHash,
  validateNetwork
} from './utils/validation';

/**
 * Neo N3 MCP Server - Modern MCP SDK 1.12.0 Implementation
 * Using the high-level McpServer API
 */
class NeoN3McpServer {
  private server: McpServer;
  private neoServices: Map<NeoNetwork, NeoService>;
  private contractServices: Map<NeoNetwork, ContractService>;
  private servicesInitialized = false;

  constructor() {
    console.error('🚀 Initializing Neo N3 MCP Server (Modern API)...');
    
    // Create McpServer with high-level API
    this.server = new McpServer({
      name: 'neo-n3-mcp-server',
      version: '1.6.0',
    });

    // Initialize service maps
    this.neoServices = new Map();
    this.contractServices = new Map();

    // Setup tools and resources using modern API
    this.setupTools();
    this.setupResources();
    
    console.error('✅ Neo N3 MCP Server initialized successfully');
  }

  /**
   * Lazy initialize Neo services only when needed
   */
  private async ensureServicesInitialized() {
    if (this.servicesInitialized) {
      return;
    }

    try {
      console.error('🔧 Lazy-initializing Neo services...');
      console.error(`Network mode: ${config.networkMode}`);

      // Initialize mainnet services if enabled
      if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        console.error('   Initializing mainnet services...');
        
        const mainnetNeoService = new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        const mainnetContractService = new ContractService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        
        this.neoServices.set(NeoNetwork.MAINNET, mainnetNeoService);
        this.contractServices.set(NeoNetwork.MAINNET, mainnetContractService);
        
        console.error('   ✅ Mainnet services initialized');
      }

      // Initialize testnet services if enabled
      if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        console.error('   Initializing testnet services...');
        
        const testnetNeoService = new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        const testnetContractService = new ContractService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        
        this.neoServices.set(NeoNetwork.TESTNET, testnetNeoService);
        this.contractServices.set(NeoNetwork.TESTNET, testnetContractService);
        
        console.error('   ✅ Testnet services initialized');
      }

      this.servicesInitialized = true;
      console.error('✅ All Neo services initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Neo services:', error);
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
    console.error('🔧 Setting up tools with modern API...');

    // Network mode tool
    this.server.tool(
      'get_network_mode',
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

    // List famous contracts tool
    this.server.tool(
      'list_famous_contracts',
      {
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ network }) => {
        const contractService = await this.getContractService(network);
        const contracts = contractService.listSupportedContracts();
        const availableContracts = contracts.filter(contract => {
          return contractService.isContractAvailable(contract.name);
        });

        const result = {
          contracts: availableContracts,
          network: contractService.getNetwork()
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

    // Contract info tool
    this.server.tool(
      'get_contract_info',
      {
        contractName: z.string().describe('Contract name'),
        network: z.string().optional().describe('Network to use: "mainnet" or "testnet"'),
      },
      async ({ contractName, network }) => {
        const contractService = await this.getContractService(network);

        try {
          const contract = contractService.getContract(contractName);
          const operations = contractService.getContractOperations(contractName);
          const scriptHash = contractService.getContractScriptHash(contractName);

          const result = {
            name: contract.name,
            description: contract.description,
            scriptHash,
            operations,
            network: contractService.getNetwork()
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new Error(`Contract ${contractName} not found or not available on this network`);
        }
      }
    );

    // Create wallet tool
    this.server.tool(
      'create_wallet',
      {
        password: z.string().describe('Password to encrypt the wallet WIF'),
      },
      async ({ password }) => {
        validatePassword(password);
        const account = new neonJs.wallet.Account();
        const encryptedWIF = await neonJs.wallet.encrypt(account.WIF, password);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ 
                address: account.address, 
                publicKey: account.publicKey,
                encryptedPrivateKey: encryptedWIF 
              }, null, 2),
            },
          ],
        };
      }
    );
    this.server.tool(
      'set_network_mode',
      { mode: z.string().describe('Network mode to set') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('set_network_mode', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'get_block',
      { hashOrHeight: z.union([z.string(), z.number()]).describe('Block hash or height'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_block', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'get_transaction',
      { txid: z.string().describe('Transaction hash'), network: z.string().optional().describe('Optional: Network') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('get_transaction', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'transfer_assets',
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
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'invoke_contract',
      { 
      network: z.string().optional().describe('Optional: Network'),
      fromWIF: z.string().optional().describe('Optional: Sender WIF for write operations'),
      scriptHash: z.string().describe('Contract script hash'),
      operation: z.string().describe('Method name'),
      args: z.array(z.any()).optional().describe('Optional: Method arguments'),
      signers: z.array(z.any()).optional().describe('Optional: Signer scopes'),
      confirm: z.boolean().optional().describe('Must be true to execute write operations')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('invoke_contract', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'import_wallet',
      { privateKeyOrWIF: z.string().describe('Private key or WIF') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('import_wallet', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'estimate_transfer_fees',
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
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'estimate_invoke_fees',
      { 
      network: z.string().optional().describe('Optional: Network'),
      signerAddress: z.string().describe('Signer address'),
      scriptHash: z.string().describe('Contract script hash'),
      operation: z.string().describe('Method name'),
      args: z.array(z.any()).optional().describe('Optional: Method arguments'),
      signers: z.array(z.any()).optional().describe('Optional: Signer scopes')
    },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('estimate_invoke_fees', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'claim_gas',
      { network: z.string().optional().describe('Optional: Network'), fromWIF: z.string().describe('Account WIF'), confirm: z.boolean().optional().describe('Must be true to execute') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('claim_gas', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'neofs_create_container',
      { network: z.string().optional().describe('Optional: Network'), wif: z.string().describe('Account WIF'), rules: z.array(z.any()).optional().describe('Optional: Container placement rules') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('neofs_create_container', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

    this.server.tool(
      'neofs_get_containers',
      { network: z.string().optional().describe('Optional: Network'), ownerAddress: z.string().describe('Address of the owner') },
      async (args) => {
        try {
          await this.ensureServicesInitialized();
          const result = await callTool('neofs_get_containers', args, this.neoServices, this.contractServices);
          // If the result is an error object from our error handler, return it properly formatted
          if (result && result.error) {
            return { isError: true, content: [{ type: 'text', text: typeof result.error === 'string' ? result.error : JSON.stringify(result.error) }] };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error: any) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );

  }

  /**
   * Setup resources using modern McpServer API
   */
  private setupResources() {
    console.error('🔧 Setting up resources with modern API...');

    // Network status resource
    this.server.resource(
      'neo-network-status',
      'neo://network/status',
      async (uri) => {
        const neoService = await this.getNeoService();
        const info = await neoService.getBlockchainInfo();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }
    );

    // Mainnet status resource
    this.server.resource(
      'neo-mainnet-status',
      'neo://mainnet/status',
      async (uri) => {
        const neoService = await this.getNeoService('mainnet');
        const info = await neoService.getBlockchainInfo();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }
    );

    // Testnet status resource
    this.server.resource(
      'neo-testnet-status',
      'neo://testnet/status',
      async (uri) => {
        const neoService = await this.getNeoService('testnet');
        const info = await neoService.getBlockchainInfo();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }
    );

    // Block resource by height
    this.server.resource(
      'neo-block',
      new ResourceTemplate('neo://block/{height}', { list: undefined }),
      async (uri, { height }) => {
        const neoService = await this.getNeoService();
        const parsedHeight = Array.isArray(height) ? height[0] : height;
        const blockHeight = typeof parsedHeight === 'string' ? parseInt(parsedHeight, 10) : parsedHeight;
        const block = await neoService.getBlock(blockHeight as number);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(block, null, 2),
            },
          ],
        };
      }
    );

    console.error('✅ Resources set up successfully');
  }

  /**
   * Run the server
   */
  async run() {
    try {
      console.error('🚀 Starting Neo N3 MCP Server...');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('✅ Neo N3 MCP Server started and connected successfully');
    } catch (error) {
      console.error('❌ Failed to start Neo N3 MCP Server:', error);
      throw error;
    }
  }
}

// Start the server if run directly
if (require.main === module) {
  const server = new NeoN3McpServer();
  server.run().catch((error) => {
    console.error('💥 Fatal error starting server:', error);
    process.exit(1);
  });
} 