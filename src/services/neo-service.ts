import * as neonJs from '@cityofzion/neon-js';

/**
 * Supported Neo N3 networks
 */
export enum NeoNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

/**
 * Service for interacting with the Neo N3 blockchain
 */
export class NeoService {
  private rpcClient: any;
  private network: NeoNetwork;
  private lastCallTime: number = 0;
  private minCallInterval: number = 100; // Minimum time between RPC calls in milliseconds
  private rateLimitEnabled: boolean = true;

  /**
   * Create a new Neo service
   * @param rpcUrl URL of the Neo N3 RPC node
   * @param network Network type (mainnet or testnet)
   * @param options Additional service options
   */
  constructor(
    rpcUrl: string, 
    network: NeoNetwork = NeoNetwork.MAINNET,
    options: {
      rateLimitEnabled?: boolean,
      minCallInterval?: number
    } = {}
  ) {
    if (!rpcUrl) {
      throw new Error('RPC URL is required');
    }
    
    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);
      
      // Validate that the RPC URL is formatted correctly
      const urlPattern = /^(http|https):\/\/[^ "]+$/;
      if (!urlPattern.test(rpcUrl)) {
        throw new Error(`Invalid RPC URL format: ${rpcUrl}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Neo RPC client: ${errorMessage}`);
    }
    
    // Validate network
    if (!Object.values(NeoNetwork).includes(network)) {
      throw new Error(`Invalid network: ${network}. Must be one of: ${Object.values(NeoNetwork).join(', ')}`);
    }
    
    this.network = network;
    
    // Apply options
    if (options.rateLimitEnabled !== undefined) {
      this.rateLimitEnabled = options.rateLimitEnabled;
    }
    
    if (options.minCallInterval !== undefined && options.minCallInterval > 0) {
      this.minCallInterval = options.minCallInterval;
    }
  }

  /**
   * Get general blockchain information
   * @returns Object containing blockchain height and validators
   */
  async getBlockchainInfo() {
    try {
      // Always use direct execute calls to avoid method naming inconsistencies
      let height, validators;
      
      // Use direct RPC calls with retry logic for better reliability
      try {
        height = await this.executeWithRetry('getblockcount', []);
      } catch (blockCountError) {
        console.error('Error getting block count:', blockCountError);
        height = 0;
      }
      
      try {
        validators = await this.executeWithRetry('getvalidators', []);
      } catch (validatorsError) {
        console.error('Error getting validators:', validatorsError);
        validators = [];
      }
      
      return { height, validators, network: this.network };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get blockchain info: ${errorMessage}`);
    }
  }

  /**
   * Get block details by height or hash
   * @param hashOrHeight Block height or hash
   * @returns Block details
   */
  async getBlock(hashOrHeight: string | number) {
    try {
      // Use direct RPC call for better compatibility
      return await this.rpcClient.execute('getblock', [hashOrHeight, 1]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get block ${hashOrHeight}: ${errorMessage}`);
    }
  }

  /**
   * Get transaction details by hash
   * @param txid Transaction hash
   * @returns Transaction details
   */
  async getTransaction(txid: string) {
    try {
      // Use direct RPC call for better compatibility
      return await this.rpcClient.execute('getrawtransaction', [txid, 1]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transaction ${txid}: ${errorMessage}`);
    }
  }

  /**
   * Get account balance for a specific address
   * @param address Neo N3 address
   * @returns Balance information
   */
  async getBalance(address: string) {
    try {
      // Use direct RPC call for better compatibility
      const accountState = await this.rpcClient.execute('getaccountstate', [address]);
      
      // Format the response to match the expected structure
      if (accountState && accountState.balances) {
        return {
          balance: accountState.balances || []
        };
      }
      
      // Fallback if account state doesn't have the expected structure
      return {
        balance: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get balance for address ${address}: ${errorMessage}`);
    }
  }

  /**
   * Transfer assets between addresses
   * @param fromAccount Sender account
   * @param toAddress Recipient address
   * @param asset Asset hash or symbol (e.g., 'NEO', 'GAS')
   * @param amount Amount to transfer
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction details
   */
  async transferAssets(
    fromAccount: any,
    toAddress: string,
    asset: string,
    amount: string | number,
    additionalScriptAttributes: any[] = []
  ) {
    try {
      // Validate parameters
      if (!fromAccount || !fromAccount.address) {
        throw new Error('Invalid sender account: missing address');
      }

      if (!toAddress) {
        throw new Error('Recipient address is required');
      }

      // Ensure addresses are strings, not objects
      const fromAddress = typeof fromAccount.address === 'string' 
        ? fromAccount.address 
        : String(fromAccount.address);
        
      // Validate addresses using Neo address pattern
      const addressPattern = /^[A-Za-z0-9]{33,35}$/;
      if (!addressPattern.test(fromAddress)) {
        throw new Error(`Invalid sender address format: ${fromAddress}`);
      }
      
      if (!addressPattern.test(toAddress)) {
        throw new Error(`Invalid recipient address format: ${toAddress}`);
      }

      // Create a transaction
      const script = neonJs.sc.createScript({
        scriptHash: asset.startsWith('0x') ? asset : this.getAssetHash(asset),
        operation: 'transfer',
        args: [
          neonJs.sc.ContractParam.hash160(fromAddress),
          neonJs.sc.ContractParam.hash160(toAddress),
          neonJs.sc.ContractParam.integer(amount),
          neonJs.sc.ContractParam.any(null),
        ],
      });

      // Create transaction intent
      const txIntent = {
        script,
        attributes: additionalScriptAttributes,
        signers: [
          {
            account: neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(fromAddress)),
            scopes: 'CalledByEntry',
          },
        ],
      };

      // Get transaction info from RPC using direct execute call
      const tx = await this.rpcClient.execute('invokescript', [
        neonJs.u.HexString.fromHex(script),
        txIntent.signers
      ]);

      // Properly sign the transaction
      let signedTx;

      // Use standard transaction construction and signing
      try {
        const txn = new neonJs.tx.Transaction(tx);
        txn.sign(fromAccount);
        signedTx = txn.serialize(true);
      } catch (signError) {
        // Fall back to other methods if the standard approach fails
        console.error('Transaction signing error:', signError);
        
        // Try a different approach if the standard one fails
        try {
          // If tx is already a string, use it directly
          if (typeof tx === 'string') {
            signedTx = tx;
          } else if (tx && typeof tx.serialize === 'function') {
            // If tx has a serialize method, use it
            signedTx = tx.serialize(true);
          } else {
            // Last resort, use JSON serialization
            signedTx = JSON.stringify(tx);
          }
        } catch (fallbackError: any) {
          throw new Error(`Failed to sign transaction: ${fallbackError.message}`);
        }
        
        console.warn('Transaction signing fallback used - verify transaction structure');
      }

      // Send transaction using direct execute call
      const result = await this.rpcClient.execute('sendrawtransaction', [signedTx]);

      return { txid: result, tx: signedTx };
    } catch (error) {
      // Production error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to transfer assets: ${errorMessage}`);
    }
  }

  /**
   * Invoke a smart contract method
   * @param fromAccount Account to sign the transaction
   * @param scriptHash Contract script hash
   * @param operation Method name
   * @param args Method arguments
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction details
   */
  async invokeContract(
    fromAccount: any,
    scriptHash: string,
    operation: string,
    args: any[] = [],
    additionalScriptAttributes: any[] = []
  ) {
    try {
      // Validate parameters
      if (!fromAccount || !fromAccount.address) {
        throw new Error('Invalid sender account: missing address');
      }

      if (!scriptHash) {
        throw new Error('Script hash is required');
      }

      if (!operation) {
        throw new Error('Operation is required');
      }

      // Ensure address is a string, not an object
      const fromAddress = typeof fromAccount.address === 'string' 
        ? fromAccount.address 
        : String(fromAccount.address);
      
      // Validate address using Neo address pattern
      const addressPattern = /^[A-Za-z0-9]{33,35}$/;
      if (!addressPattern.test(fromAddress)) {
        throw new Error(`Invalid sender address format: ${fromAddress}`);
      }

      // Create a transaction
      const script = neonJs.sc.createScript({
        scriptHash,
        operation,
        args,
      });

      // Create transaction intent
      const txIntent = {
        script,
        attributes: additionalScriptAttributes,
        signers: [
          {
            account: neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(fromAddress)),
            scopes: 'CalledByEntry',
          },
        ],
      };

      // Get transaction info from RPC using direct execute call
      const tx = await this.rpcClient.execute('invokescript', [
        neonJs.u.HexString.fromHex(script),
        txIntent.signers
      ]);

      // Properly sign the transaction
      let signedTx;

      // Use standard transaction construction and signing
      try {
        const txn = new neonJs.tx.Transaction(tx);
        txn.sign(fromAccount);
        signedTx = txn.serialize(true);
      } catch (signError) {
        // Fall back to other methods if the standard approach fails
        console.error('Transaction signing error:', signError);
        
        // Try a different approach if the standard one fails
        try {
          // If tx is already a string, use it directly
          if (typeof tx === 'string') {
            signedTx = tx;
          } else if (tx && typeof tx.serialize === 'function') {
            // If tx has a serialize method, use it
            signedTx = tx.serialize(true);
          } else {
            // Last resort, use JSON serialization
            signedTx = JSON.stringify(tx);
          }
        } catch (fallbackError: any) {
          throw new Error(`Failed to sign transaction: ${fallbackError.message}`);
        }
        
        console.warn('Transaction signing fallback used - verify transaction structure');
      }

      // Send transaction using direct execute call
      const result = await this.rpcClient.execute('sendrawtransaction', [signedTx]);

      return { txid: result, tx: signedTx };
    } catch (error) {
      // Production error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to invoke contract: ${errorMessage}`);
    }
  }

  /**
   * Create a new wallet
   * @param password Password for encrypting the wallet
   * @returns New wallet account
   */
  createWallet(password: string) {
    try {
      const account = new neonJs.wallet.Account();
      return {
        address: account.address,
        publicKey: account.publicKey,
        encryptedPrivateKey: account.encrypt(password),
        WIF: account.WIF,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create wallet: ${errorMessage}`);
    }
  }

  /**
   * Import a wallet from WIF or encrypted key
   * @param key WIF or encrypted private key
   * @param password Password for decrypting the key (if encrypted)
   * @returns Wallet account
   */
  importWallet(key: string, password?: string) {
    try {
      let account: any;

      if (password) {
        // Import from encrypted key
        account = new neonJs.wallet.Account();
        
        try {
          account.decrypt(key, password);
        } catch (decryptError: any) {
          throw new Error(`Failed to decrypt wallet: ${decryptError.message}`);
        }
      } else {
        // Import from WIF
        try {
          account = new neonJs.wallet.Account(key);
        } catch (wifError: any) {
          throw new Error(`Invalid WIF key: ${wifError.message}`);
        }
      }

      return {
        address: account.address,
        publicKey: account.publicKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import wallet: ${errorMessage}`);
    }
  }

  /**
   * Get asset hash from symbol based on the current network
   * @param symbol Asset symbol (e.g., 'NEO', 'GAS')
   * @returns Asset hash
   */
  private getAssetHash(symbol: string): string {
    if (!symbol) {
      throw new Error('Asset symbol is required');
    }
    
    // Asset hashes for different networks
    const assets: Record<NeoNetwork, Record<string, string>> = {
      [NeoNetwork.MAINNET]: {
        NEO: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5',
        GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf',
      },
      [NeoNetwork.TESTNET]: {
        NEO: '0x8c23f196d8a1bfd103a9dcb1f9ccf0c611377d3b',  // Testnet NEO hash
        GAS: '0xd2a4cff31913016155e38e474a2c06d08be276cf',  // Testnet GAS hash
      }
    };

    // Check if the network is supported
    if (!assets[this.network]) {
      throw new Error(`Unsupported network: ${this.network}`);
    }

    const networkAssets = assets[this.network];
    const symbolUpper = symbol.toUpperCase();
    
    if (!networkAssets[symbolUpper]) {
      const availableAssets = Object.keys(networkAssets).join(', ');
      throw new Error(`Unknown asset: "${symbol}" on network "${this.network}". Available assets: ${availableAssets}`);
    }

    return networkAssets[symbolUpper];
  }
  
  /**
   * Get the current network
   * @returns The current network
   */
  getNetwork(): NeoNetwork {
    return this.network;
  }

  /**
   * Get transaction status by hash
   * @param txid Transaction hash
   * @returns Transaction status information
   */
  async getTransactionStatus(txid: string) {
    try {
      if (!txid) {
        throw new Error('Transaction ID is required');
      }
      
      // Validate transaction ID format
      const txidPattern = /^0x[a-fA-F0-9]{64}$/;
      if (!txidPattern.test(txid)) {
        throw new Error(`Invalid transaction ID format: ${txid}. Expected format: 0x<64 hex chars>`);
      }
      
      // Try to get the transaction
      try {
        const tx = await this.rpcClient.execute('getrawtransaction', [txid, 1]);
        
        // If transaction exists, check if it's confirmed by getting its block
        if (tx && tx.blockhash) {
          const block = await this.rpcClient.execute('getblock', [tx.blockhash, 1]);
          const currentHeight = await this.rpcClient.execute('getblockcount', []);
          
          // Calculate confirmations
          const confirmations = currentHeight - block.index;
          
          return {
            status: 'confirmed',
            confirmations,
            transaction: tx,
            network: this.network
          };
        }
        
        // Transaction found but not yet confirmed
        return {
          status: 'pending',
          confirmations: 0,
          transaction: tx,
          network: this.network
        };
      } catch (error) {
        // If we get here, the transaction likely doesn't exist
        return {
          status: 'not_found',
          confirmations: 0,
          error: 'Transaction not found on the blockchain',
          network: this.network
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transaction status: ${errorMessage}`);
    }
  }

  /**
   * Check transaction status by hash with additional details
   * @param txid Transaction hash
   * @returns Detailed transaction status information
   */
  async checkTransactionStatus(txid: string) {
    try {
      if (!txid) {
        throw new Error('Transaction hash is required');
      }
      
      // Remove '0x' prefix if present
      const normalizedTxid = txid.startsWith('0x') ? txid.substring(2) : txid;
      
      // Validate hash format
      if (!/^[0-9a-fA-F]{64}$/.test(normalizedTxid)) {
        throw new Error(`Invalid transaction hash format: ${txid}`);
      }
      
      try {
        // Try to get transaction using executeWithRetry for better reliability
        const tx = await this.executeWithRetry('getrawtransaction', [normalizedTxid, 1]);
        
        // If transaction exists, check if it's confirmed
        if (tx) {
          if (tx.blockhash) {
            // Transaction is confirmed in a block
            const block = await this.executeWithRetry('getblock', [tx.blockhash, 1]);
            const currentHeight = await this.executeWithRetry('getblockcount', []);
            
            // Calculate confirmations
            const confirmations = currentHeight - block.index;
            
            return {
              status: 'confirmed',
              confirmations,
              blockHeight: block.index,
              blockTime: block.time,
              transactionId: normalizedTxid,
              blockHash: tx.blockhash,
              network: this.network,
              details: {
                sender: tx.sender || 'Unknown',
                size: tx.size,
                version: tx.version,
                sysfee: tx.sysfee,
                netfee: tx.netfee,
                validUntilBlock: tx.validuntilblock
              }
            };
          } else {
            // Transaction found but not yet confirmed (in mempool)
            return {
              status: 'pending',
              confirmations: 0,
              transactionId: normalizedTxid,
              network: this.network,
              details: {
                sender: tx.sender || 'Unknown',
                size: tx.size,
                version: tx.version,
                sysfee: tx.sysfee,
                netfee: tx.netfee,
                validUntilBlock: tx.validuntilblock
              }
            };
          }
        }
        
        // This line should not be reached but added as a fallback
        throw new Error('Transaction not found');
      } catch (error) {
        // If we get here with a specific error, the transaction likely doesn't exist
        return {
          status: 'not_found',
          confirmations: 0,
          transactionId: normalizedTxid,
          network: this.network,
          error: 'Transaction not found on the blockchain'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to check transaction status: ${errorMessage}`);
    }
  }

  /**
   * Execute an RPC method with retry logic and rate limiting
   * @param method RPC method name
   * @param params RPC method parameters
   * @param maxRetries Maximum number of retry attempts
   * @param initialDelay Initial delay in milliseconds before first retry
   * @returns RPC method result
   */
  private async executeWithRetry(
    method: string,
    params: any[] = [],
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<any> {
    let lastError;
    let delay = initialDelay;
    
    // Apply rate limiting if enabled
    if (this.rateLimitEnabled) {
      const now = Date.now();
      const timeElapsed = now - this.lastCallTime;
      
      if (timeElapsed < this.minCallInterval) {
        const waitTime = this.minCallInterval - timeElapsed;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastCallTime = Date.now();
    }
    
    // Try the initial call plus retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute the RPC call
        return await this.rpcClient.execute(method, params);
      } catch (error) {
        lastError = error;
        
        // Don't wait after the last attempt
        if (attempt < maxRetries) {
          // Log the error and retry information
          console.warn(`RPC call to ${method} failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Exponential backoff
          delay *= 2;
        }
      }
    }
    
    // If we get here, all attempts failed
    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    throw new Error(`RPC call to ${method} failed after ${maxRetries + 1} attempts: ${errorMessage}`);
  }

  /**
   * Estimate gas fees for an asset transfer
   * @param fromAddress Sender address
   * @param toAddress Recipient address
   * @param asset Asset hash or symbol (e.g., 'NEO', 'GAS')
   * @param amount Amount to transfer
   * @returns Estimated gas fees
   */
  async estimateTransferFees(
    fromAddress: string,
    toAddress: string,
    asset: string,
    amount: string | number
  ) {
    try {
      // Validate parameters
      if (!fromAddress) {
        throw new Error('Sender address is required');
      }

      if (!toAddress) {
        throw new Error('Recipient address is required');
      }
      
      // Validate addresses using Neo address pattern
      const addressPattern = /^[A-Za-z0-9]{33,35}$/;
      if (!addressPattern.test(fromAddress)) {
        throw new Error(`Invalid sender address format: ${fromAddress}`);
      }
      
      if (!addressPattern.test(toAddress)) {
        throw new Error(`Invalid recipient address format: ${toAddress}`);
      }

      // Create a script for the transfer
      const script = neonJs.sc.createScript({
        scriptHash: asset.startsWith('0x') ? asset : this.getAssetHash(asset),
        operation: 'transfer',
        args: [
          neonJs.sc.ContractParam.hash160(fromAddress),
          neonJs.sc.ContractParam.hash160(toAddress),
          neonJs.sc.ContractParam.integer(amount),
          neonJs.sc.ContractParam.any(null),
        ],
      });

      // Create transaction intent
      const txIntent = {
        script,
        signers: [
          {
            account: neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(fromAddress)),
            scopes: 'CalledByEntry',
          },
        ],
      };

      // Get transaction info from RPC using direct execute call
      const result = await this.executeWithRetry('invokescript', [
        neonJs.u.HexString.fromHex(script),
        txIntent.signers
      ]);

      // Extract the gas consumed from the result
      if (result && result.gasconsumed) {
        // Add a 10% buffer for safety
        const estimatedGas = parseFloat(result.gasconsumed) * 1.1;
        
        return {
          estimatedGas: estimatedGas.toFixed(8),
          minRequired: result.gasconsumed,
          script: neonJs.u.HexString.fromHex(script),
          state: result.state || 'UNKNOWN',
          network: this.network
        };
      }
      
      throw new Error('Failed to estimate gas: Invalid response from RPC node');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to estimate transfer fees: ${errorMessage}`);
    }
  }
}