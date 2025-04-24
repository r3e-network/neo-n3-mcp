import { config, NetworkMode } from '../src/config';
import { NeoMcpServer } from '../src/index';
import { NeoNetwork } from '../src/services/neo-service';

describe('Network Configuration Tests', () => {
  let originalNetworkMode: NetworkMode;

  beforeEach(() => {
    // Save the original network mode
    originalNetworkMode = config.networkMode;
  });

  afterEach(() => {
    // Restore the original network mode
    (config as any).networkMode = originalNetworkMode;
  });

  test('Default network mode is BOTH', () => {
    expect(config.networkMode).toBe(NetworkMode.BOTH);
  });

  test('Server initializes with both networks in BOTH mode', () => {
    // Set network mode to BOTH
    (config as any).networkMode = NetworkMode.BOTH;

    // Initialize server
    const server = new NeoMcpServer();

    // Check if both networks are available
    expect(server['neoServices'].has(NeoNetwork.MAINNET)).toBe(true);
    expect(server['neoServices'].has(NeoNetwork.TESTNET)).toBe(true);
    expect(server['contractServices'].has(NeoNetwork.MAINNET)).toBe(true);
    expect(server['contractServices'].has(NeoNetwork.TESTNET)).toBe(true);
  });

  test('Server initializes with only mainnet in MAINNET_ONLY mode', () => {
    // Set network mode to MAINNET_ONLY
    (config as any).networkMode = NetworkMode.MAINNET_ONLY;

    // Initialize server
    const server = new NeoMcpServer();

    // Check if only mainnet is available
    expect(server['neoServices'].has(NeoNetwork.MAINNET)).toBe(true);
    expect(server['neoServices'].has(NeoNetwork.TESTNET)).toBe(false);
    expect(server['contractServices'].has(NeoNetwork.MAINNET)).toBe(true);
    expect(server['contractServices'].has(NeoNetwork.TESTNET)).toBe(false);
  });

  test('Server initializes with only testnet in TESTNET_ONLY mode', () => {
    // Set network mode to TESTNET_ONLY
    (config as any).networkMode = NetworkMode.TESTNET_ONLY;

    // Initialize server
    const server = new NeoMcpServer();

    // Check if only testnet is available
    expect(server['neoServices'].has(NeoNetwork.MAINNET)).toBe(false);
    expect(server['neoServices'].has(NeoNetwork.TESTNET)).toBe(true);
    expect(server['contractServices'].has(NeoNetwork.MAINNET)).toBe(false);
    expect(server['contractServices'].has(NeoNetwork.TESTNET)).toBe(true);
  });

  test('getNeoService returns correct service based on network mode', () => {
    // Set network mode to BOTH
    (config as any).networkMode = NetworkMode.BOTH;

    // Initialize server
    const server = new NeoMcpServer();

    // Test with no network parameter (should return mainnet)
    const mainnetService = server['getNeoService']();
    expect(mainnetService.getNetwork()).toBe(NeoNetwork.MAINNET);

    // Test with explicit mainnet parameter
    const explicitMainnetService = server['getNeoService'](NeoNetwork.MAINNET);
    expect(explicitMainnetService.getNetwork()).toBe(NeoNetwork.MAINNET);

    // Test with explicit testnet parameter
    const testnetService = server['getNeoService'](NeoNetwork.TESTNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });

  test('getNeoService throws error when requesting disabled network', () => {
    // Set network mode to MAINNET_ONLY
    (config as any).networkMode = NetworkMode.MAINNET_ONLY;

    // Initialize server
    const server = new NeoMcpServer();

    // Test with testnet parameter (should throw error)
    expect(() => {
      server['getNeoService'](NeoNetwork.TESTNET);
    }).toThrow(/Network testnet is not enabled/);
  });

  test('getContractService returns correct service based on network mode', () => {
    // Set network mode to BOTH
    (config as any).networkMode = NetworkMode.BOTH;

    // Initialize server
    const server = new NeoMcpServer();

    // Test with no network parameter (should return mainnet)
    const mainnetService = server['getContractService']();
    expect(mainnetService.getNetwork()).toBe(NeoNetwork.MAINNET);

    // Test with explicit mainnet parameter
    const explicitMainnetService = server['getContractService'](NeoNetwork.MAINNET);
    expect(explicitMainnetService.getNetwork()).toBe(NeoNetwork.MAINNET);

    // Test with explicit testnet parameter
    const testnetService = server['getContractService'](NeoNetwork.TESTNET);
    expect(testnetService.getNetwork()).toBe(NeoNetwork.TESTNET);
  });

  test('getContractService throws error when requesting disabled network', () => {
    // Set network mode to TESTNET_ONLY
    (config as any).networkMode = NetworkMode.TESTNET_ONLY;

    // Initialize server
    const server = new NeoMcpServer();

    // Test with mainnet parameter (should throw error)
    expect(() => {
      server['getContractService'](NeoNetwork.MAINNET);
    }).toThrow(/Network mainnet is not enabled/);
  });

  test('Default network changes based on network mode', () => {
    // Test with MAINNET_ONLY mode
    (config as any).networkMode = NetworkMode.MAINNET_ONLY;
    let server = new NeoMcpServer();
    let defaultService = server['getNeoService']();
    expect(defaultService.getNetwork()).toBe(NeoNetwork.MAINNET);

    // Test with TESTNET_ONLY mode
    (config as any).networkMode = NetworkMode.TESTNET_ONLY;
    server = new NeoMcpServer();
    defaultService = server['getNeoService']();
    expect(defaultService.getNetwork()).toBe(NeoNetwork.TESTNET);

    // Test with BOTH mode
    (config as any).networkMode = NetworkMode.BOTH;
    server = new NeoMcpServer();
    defaultService = server['getNeoService']();
    expect(defaultService.getNetwork()).toBe(NeoNetwork.MAINNET);
  });
});
