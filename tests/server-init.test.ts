import { config, NetworkMode } from '../src/config';

// Mock the NeoService and ContractService to avoid actual network calls
jest.mock('../src/services/neo-service', () => {
  return {
    NeoService: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockReturnValue('mainnet')
    })),
    NeoNetwork: {
      MAINNET: 'mainnet',
      TESTNET: 'testnet'
    }
  };
});

jest.mock('../src/contracts/contract-service', () => {
  return {
    ContractService: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockReturnValue('mainnet')
    }))
  };
});

describe('Server Initialization', () => {
  let originalNetworkMode: NetworkMode;

  beforeEach(() => {
    // Save the original network mode
    originalNetworkMode = config.networkMode;

    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore the original network mode
    (config as any).networkMode = originalNetworkMode;
  });

  test('NetworkMode is correctly defined', () => {
    expect(NetworkMode.MAINNET_ONLY).toBe('mainnet_only');
    expect(NetworkMode.TESTNET_ONLY).toBe('testnet_only');
    expect(NetworkMode.BOTH).toBe('both');
  });

  test('Default network mode is BOTH', () => {
    expect(config.networkMode).toBe(NetworkMode.BOTH);
  });
});
