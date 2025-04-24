import { config, NetworkMode } from '../src/config';

describe('Network Mode Configuration', () => {
  test('Default network mode is BOTH', () => {
    expect(config.networkMode).toBe(NetworkMode.BOTH);
  });
  
  test('NetworkMode enum has correct values', () => {
    expect(NetworkMode.MAINNET_ONLY).toBe('mainnet_only');
    expect(NetworkMode.TESTNET_ONLY).toBe('testnet_only');
    expect(NetworkMode.BOTH).toBe('both');
  });
});
