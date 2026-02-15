#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { NeoService, NeoNetwork } from './services/neo-service';
import { ContractService } from './contracts/contract-service';
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
    console.log('🚀 Initializing Neo N3 MCP Server (Modern API)...');
    
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
    
    console.log('✅ Neo N3 MCP Server initialized successfully');
  }

  /**
   * Lazy initialize Neo services only when needed
   */
  private async ensureServicesInitialized() {
    if (this.servicesInitialized) {
      return;
    }

    try {
      console.log('🔧 Lazy-initializing Neo services...');
      console.log(`Network mode: ${config.networkMode}`);

      // Initialize mainnet services if enabled
      if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        console.log('   Initializing mainnet services...');
        
        const mainnetNeoService = new NeoService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        const mainnetContractService = new ContractService(config.mainnetRpcUrl, NeoNetwork.MAINNET);
        
        this.neoServices.set(NeoNetwork.MAINNET, mainnetNeoService);
        this.contractServices.set(NeoNetwork.MAINNET, mainnetContractService);
        
        console.log('   ✅ Mainnet services initialized');
      }

      // Initialize testnet services if enabled
      if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
        console.log('   Initializing testnet services...');
        
        const testnetNeoService = new NeoService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        const testnetContractService = new ContractService(config.testnetRpcUrl, NeoNetwork.TESTNET);
        
        this.neoServices.set(NeoNetwork.TESTNET, testnetNeoService);
        this.contractServices.set(NeoNetwork.TESTNET, testnetContractService);
        
        console.log('   ✅ Testnet services initialized');
      }

      this.servicesInitialized = true;
      console.log('✅ All Neo services initialized successfully');
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
    console.log('🔧 Setting up tools with modern API...');

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

    console.log('✅ Tools set up successfully');
  }

  /**
   * Setup resources using modern McpServer API
   */
  private setupResources() {
    console.log('🔧 Setting up resources with modern API...');

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

    console.log('✅ Resources set up successfully');
  }

  /**
   * Run the server
   */
  async run() {
    try {
      console.log('🚀 Starting Neo N3 MCP Server...');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.log('✅ Neo N3 MCP Server started and connected successfully');
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