/**
 * NeoService / ContractService must accept an ordered endpoint list, not just a
 * single URL, so the failover in utils/rpc-client.ts is reachable from the
 * services the server actually constructs. Every entry has to be validated at
 * construction time — a bad URL in position three is otherwise only discovered
 * during an outage.
 */
import { NeoService, NeoNetwork } from '../src/services/neo-service';
import { ContractService } from '../src/contracts/contract-service';

const PRIMARY = 'https://mainnet3.neo.coz.io:443';
const SECONDARY = 'https://mainnet4.neo.coz.io:443';

describe('NeoService endpoint lists', () => {
  it('accepts a single URL string (unchanged behaviour)', () => {
    const service = new NeoService(PRIMARY, NeoNetwork.MAINNET);
    expect(service.getRpcUrls()).toEqual([PRIMARY]);
  });

  it('accepts an ordered list and preserves order', () => {
    const service = new NeoService([PRIMARY, SECONDARY], NeoNetwork.MAINNET);
    expect(service.getRpcUrls()).toEqual([PRIMARY, SECONDARY]);
  });

  it('rejects an empty list', () => {
    expect(() => new NeoService([], NeoNetwork.MAINNET)).toThrow(/RPC URL/i);
  });

  it('rejects a list whose later entry is not a valid RPC URL', () => {
    expect(
      () => new NeoService([PRIMARY, SECONDARY, 'not-a-url'], NeoNetwork.MAINNET)
    ).toThrow(/RPC/i);
  });

  it('rejects credentials embedded in a later entry', () => {
    expect(
      () => new NeoService([PRIMARY, 'https://user:pass@mainnet4.neo.coz.io:443'], NeoNetwork.MAINNET)
    ).toThrow(/RPC/i);
  });
});

describe('ContractService endpoint lists', () => {
  it('accepts a single URL string (unchanged behaviour)', () => {
    const service = new ContractService(PRIMARY, NeoNetwork.MAINNET);
    expect(service.getRpcUrls()).toEqual([PRIMARY]);
  });

  it('accepts an ordered list and preserves order', () => {
    const service = new ContractService([PRIMARY, SECONDARY], NeoNetwork.MAINNET);
    expect(service.getRpcUrls()).toEqual([PRIMARY, SECONDARY]);
  });

  it('rejects an empty list', () => {
    expect(() => new ContractService([], NeoNetwork.MAINNET)).toThrow(/RPC URL/i);
  });

  it('rejects a list whose later entry is not a valid RPC URL', () => {
    expect(
      () => new ContractService([PRIMARY, 'http://neo.example.org'], NeoNetwork.MAINNET)
    ).toThrow(/RPC/i);
  });
});
