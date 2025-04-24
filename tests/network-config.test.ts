import { config, NetworkMode } from '../src/config';

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

  test('NetworkMode enum has correct values', () => {
    expect(NetworkMode.MAINNET_ONLY).toBe('mainnet_only');
    expect(NetworkMode.TESTNET_ONLY).toBe('testnet_only');
    expect(NetworkMode.BOTH).toBe('both');
  });

  test('Network mode can be changed', () => {
    // Set network mode to MAINNET_ONLY
    (config as any).networkMode = NetworkMode.MAINNET_ONLY;
    expect(config.networkMode).toBe(NetworkMode.MAINNET_ONLY);

    // Set network mode to TESTNET_ONLY
    (config as any).networkMode = NetworkMode.TESTNET_ONLY;
    expect(config.networkMode).toBe(NetworkMode.TESTNET_ONLY);

    // Set network mode back to BOTH
    (config as any).networkMode = NetworkMode.BOTH;
    expect(config.networkMode).toBe(NetworkMode.BOTH);
  });
});
