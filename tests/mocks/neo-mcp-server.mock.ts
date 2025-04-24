import { NeoNetwork, NeoService } from '../../src/services/neo-service';
import { ContractService } from '../../src/contracts/contract-service';
import { NetworkMode, config } from '../../src/config';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types';

/**
 * Mock NeoMcpServer class for testing
 */
export class MockNeoMcpServer {
  private neoServices: Map<NeoNetwork, NeoService>;
  private contractServices: Map<NeoNetwork, ContractService>;

  constructor() {
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
  }

  /**
   * Get the appropriate Neo service for the requested network
   * @param networkParam Optional network parameter
   * @returns Neo service for the requested network
   */
  getNeoService(networkParam?: string): NeoService {
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
    const network = this.validateNetwork(networkParam);

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
  getContractService(networkParam?: string): ContractService {
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
    const network = this.validateNetwork(networkParam);

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
   * Validate network parameter
   * @param network Network parameter
   * @returns Validated network
   */
  private validateNetwork(network: string): NeoNetwork {
    if (!network) {
      return NeoNetwork.MAINNET;
    }

    const normalizedNetwork = network.toLowerCase();

    if (normalizedNetwork === 'mainnet') {
      return NeoNetwork.MAINNET;
    } else if (normalizedNetwork === 'testnet') {
      return NeoNetwork.TESTNET;
    } else {
      throw new McpError(ErrorCode.InvalidParams, `Invalid network: ${network}`);
    }
  }
}
