/**
 * Curated Neo N3 contract definitions.
 *
 * Only contracts whose network hashes and advertised operations are verified
 * should be added here. Generic contract interaction does not depend on this
 * registry; callers can use a script hash, Neo address, exact N3Index name, or
 * a name learned from a live on-chain manifest.
 */

/**
 * Contract Network Type
 */
export enum ContractNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

/**
 * Contract Interface
 */
export interface ContractDefinition {
  name: string;
  description: string;
  scriptHash: {
    [ContractNetwork.MAINNET]: string;
    [ContractNetwork.TESTNET]?: string;
  };
  operations: {
    [key: string]: {
      name: string;
      description: string;
      args?: Array<{
        name: string;
        type: string;
        description: string;
      }>;
    };
  };
}

/**
 * Verified curated contracts. Deliberately empty until a contract definition is
 * backed by current network hashes and a checked on-chain manifest.
 */
export const FAMOUS_CONTRACTS: Readonly<Record<string, ContractDefinition>> = Object.freeze({});
