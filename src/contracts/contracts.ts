/**
 * Famous Neo N3 Contract Definitions
 * This file contains definitions and script hashes for well-known Neo N3 contracts,
 * along with their standard interfaces for interaction.
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
 * NeoFS Contract
 * Decentralized storage service on Neo N3
 */
export const NeoFS: ContractDefinition = {
  name: 'NeoFS',
  description: 'Decentralized storage system on Neo N3 blockchain',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0x50ac1c37690cc2cfc594472833cf57505d5f46de',
    [ContractNetwork.TESTNET]: '0xccca29443855a1c455d72a3318cf605debb9e384'
  },
  operations: {
    createContainer: {
      name: 'createContainer',
      description: 'Create a storage container',
      args: [
        {
          name: 'ownerId',
          type: 'string',
          description: 'Owner ID of the container'
        },
        {
          name: 'rules',
          type: 'array',
          description: 'Container rules'
        }
      ]
    },
    deleteContainer: {
      name: 'deleteContainer',
      description: 'Delete a storage container',
      args: [
        {
          name: 'containerId',
          type: 'string',
          description: 'Container ID to delete'
        }
      ]
    },
    getContainers: {
      name: 'getContainers',
      description: 'Get containers owned by an address',
      args: [
        {
          name: 'ownerId',
          type: 'string',
          description: 'Owner ID to query containers for'
        }
      ]
    }
  }
};

/**
 * NeoBurger Contract
 * Neo staking platform
 */
export const NeoBurger: ContractDefinition = {
  name: 'NeoBurger',
  description: 'Neo N3 staking service',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0x48c40d4666f93408be1bef038b6722404d9a4c2a',
  },
  operations: {
    depositNeo: {
      name: 'exchange',
      description: 'Deposit NEO to receive bNEO tokens',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account receiving bNEO'
        }
      ]
    },
    withdrawNeo: {
      name: 'exchange_to_neo',
      description: 'Withdraw NEO by returning bNEO tokens',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account receiving NEO'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount of bNEO to exchange'
        }
      ]
    },
    balanceOf: {
      name: 'balanceOf',
      description: 'Get bNEO balance of an account',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account to check balance for'
        }
      ]
    },
    calculateGas: {
      name: 'calculate_gas',
      description: 'Calculate GAS rewards for an account',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account to calculate rewards for'
        }
      ]
    },
    claimGas: {
      name: 'claim_gas',
      description: 'Claim accumulated GAS rewards',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account claiming rewards'
        }
      ]
    }
  }
};

/**
 * Flamingo Contract
 * Neo-based DeFi platform
 */
export const Flamingo: ContractDefinition = {
  name: 'Flamingo',
  description: 'Neo N3 DeFi platform',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0xf970f4ccecd765b63732b821775dc38c25d74b39', // Flamingo token contract
  },
  operations: {
    balanceOf: {
      name: 'balanceOf',
      description: 'Get FLM token balance',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account to check balance for'
        }
      ]
    },
    stake: {
      name: 'stake',
      description: 'Stake FLM tokens',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account staking tokens'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to stake'
        }
      ]
    },
    unstake: {
      name: 'unstake',
      description: 'Unstake FLM tokens',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account unstaking tokens'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to unstake'
        }
      ]
    },
    claimRewards: {
      name: 'claimRewards',
      description: 'Claim staking rewards',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account claiming rewards'
        }
      ]
    }
  }
};

/**
 * NeoCompound Contract
 * Automatic yield farming protocol
 */
export const NeoCompound: ContractDefinition = {
  name: 'NeoCompound',
  description: 'Automatic yield farming protocol on Neo N3',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0xd6c41383808d22d7d1e40f8a741e20dc24b858e7',
  },
  operations: {
    deposit: {
      name: 'deposit',
      description: 'Deposit assets into NeoCompound',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account depositing assets'
        },
        {
          name: 'assetId',
          type: 'hash160',
          description: 'Asset to deposit'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to deposit'
        }
      ]
    },
    withdraw: {
      name: 'withdraw',
      description: 'Withdraw assets from NeoCompound',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account withdrawing assets'
        },
        {
          name: 'assetId',
          type: 'hash160',
          description: 'Asset to withdraw'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to withdraw'
        }
      ]
    },
    getBalance: {
      name: 'getBalance',
      description: 'Get balance of deposited assets',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account to check balance for'
        },
        {
          name: 'assetId',
          type: 'hash160',
          description: 'Asset to check balance for'
        }
      ]
    }
  }
};

/**
 * GrandShare Contract
 * Neo-based profit sharing platform
 */
export const GrandShare: ContractDefinition = {
  name: 'GrandShare',
  description: 'Profit sharing protocol on Neo N3',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0xbbcb7a1e3defbeeafc18b3358a27ccb93d0b2b13',
  },
  operations: {
    deposit: {
      name: 'deposit',
      description: 'Deposit assets into GrandShare pool',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account depositing assets'
        },
        {
          name: 'poolId',
          type: 'integer',
          description: 'ID of the pool to deposit into'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to deposit'
        }
      ]
    },
    withdraw: {
      name: 'withdraw',
      description: 'Withdraw assets from GrandShare pool',
      args: [
        {
          name: 'account',
          type: 'hash160',
          description: 'Account withdrawing assets'
        },
        {
          name: 'poolId',
          type: 'integer',
          description: 'ID of the pool to withdraw from'
        },
        {
          name: 'amount',
          type: 'integer',
          description: 'Amount to withdraw'
        }
      ]
    },
    getPoolDetails: {
      name: 'getPoolDetails',
      description: 'Get details about a pool',
      args: [
        {
          name: 'poolId',
          type: 'integer',
          description: 'ID of the pool to query'
        }
      ]
    }
  }
};

/**
 * GhostMarket Contract
 * Neo-based NFT marketplace
 */
export const GhostMarket: ContractDefinition = {
  name: 'GhostMarket',
  description: 'NFT marketplace on Neo N3',
  scriptHash: {
    [ContractNetwork.MAINNET]: '0x7a8d62e32f1f4ed880f05e93d9b03d48e3b6add7',
  },
  operations: {
    createNFT: {
      name: 'mintToken',
      description: 'Create a new NFT',
      args: [
        {
          name: 'owner',
          type: 'hash160',
          description: 'Owner of the new NFT'
        },
        {
          name: 'tokenURI',
          type: 'string',
          description: 'URI for token metadata'
        },
        {
          name: 'properties',
          type: 'array',
          description: 'NFT properties'
        }
      ]
    },
    listNFT: {
      name: 'listToken',
      description: 'List an NFT for sale',
      args: [
        {
          name: 'tokenId',
          type: 'integer',
          description: 'ID of the token to list'
        },
        {
          name: 'price',
          type: 'integer',
          description: 'Price of the token'
        },
        {
          name: 'paymentToken',
          type: 'hash160',
          description: 'Token accepted as payment'
        }
      ]
    },
    buyNFT: {
      name: 'buyToken',
      description: 'Buy a listed NFT',
      args: [
        {
          name: 'tokenId',
          type: 'integer',
          description: 'ID of the token to buy'
        },
        {
          name: 'buyer',
          type: 'hash160',
          description: 'Buyer of the token'
        }
      ]
    },
    getTokenInfo: {
      name: 'getTokenInfo',
      description: 'Get information about an NFT',
      args: [
        {
          name: 'tokenId',
          type: 'integer',
          description: 'ID of the token to query'
        }
      ]
    }
  }
};

/**
 * All supported famous Neo N3 contracts
 */
export const FAMOUS_CONTRACTS: { [key: string]: ContractDefinition } = {
  'neofs': NeoFS,
  'neoburger': NeoBurger,
  'flamingo': Flamingo,
  'neocompound': NeoCompound,
  'grandshare': GrandShare,
  'ghostmarket': GhostMarket
}; 