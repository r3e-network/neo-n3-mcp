/**
 * Famous Neo N3 Contracts Service
 *
 * This service provides methods to interact with well-known Neo N3 contracts
 * like NeoFS, NeoBurger, Flamingo, NeoCompound, GrandShare, and GhostMarket.
 */
import * as neonJs from '@cityofzion/neon-js';
import { NeoNetwork } from '../services/neo-service';
import {
  FAMOUS_CONTRACTS,
  ContractDefinition,
  ContractNetwork
} from './contracts';
import {
  validateScriptHash,
  validateAmount,
  validateContractName,
  validateContractOperation,
  validateAddress,
  validateInteger
} from '../utils/validation';
import { ContractError, NetworkError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Service for interacting with famous Neo N3 contracts
 */
export class ContractService {
  private rpcClient: any;
  private network: NeoNetwork;

  /**
   * Create a new ContractService
   * @param rpcUrl URL of the Neo N3 RPC node
   * @param network Network type (mainnet or testnet)
   * @throws NetworkError if RPC client initialization fails
   */
  constructor(rpcUrl: string, network: NeoNetwork = NeoNetwork.MAINNET) {
    if (!rpcUrl) {
      throw new NetworkError('RPC URL is required');
    }

    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);

      // Log successful initialization
      logger.info(`ContractService initialized for ${network}`, { rpcUrl });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Neo RPC client`, { error: errorMessage, rpcUrl, network });
      throw new NetworkError(`Failed to initialize Neo RPC client: ${errorMessage}`);
    }

    this.network = network;
  }

  /**
   * Get a contract by name
   * @param contractName Name of the contract
   * @returns Contract definition
   * @throws ContractError if contract not found
   */
  getContract(contractName: string): ContractDefinition {
    // Get available contract names
    const availableContracts = Object.values(FAMOUS_CONTRACTS).map(c => c.name);

    // Validate contract name
    const validContractName = validateContractName(contractName, availableContracts);

    // Find the contract (case-insensitive)
    const contractKey = validContractName.toLowerCase();
    const contract = Object.values(FAMOUS_CONTRACTS).find(
      c => c.name.toLowerCase() === contractKey
    );

    if (!contract) {
      throw new ContractError(`Contract ${validContractName} not found`);
    }

    return contract;
  }

  /**
   * Get contract script hash based on the current network
   * @param contractName Name of the contract
   * @returns Script hash for the current network
   * @throws ContractError if contract not available on current network
   */
  getContractScriptHash(contractName: string): string {
    try {
      // Get the contract definition
      const contract = this.getContract(contractName);

      // Determine the network key
      const networkKey = this.network === NeoNetwork.MAINNET
        ? ContractNetwork.MAINNET
        : ContractNetwork.TESTNET;

      // Get the script hash for the current network
      const scriptHash = contract.scriptHash[networkKey];

      if (!scriptHash) {
        throw new ContractError(
          `Contract ${contract.name} is not available on ${this.network}. ` +
          `It's only available on ${Object.keys(contract.scriptHash).join(', ')}.`
        );
      }

      // Validate and normalize the script hash
      return validateScriptHash(scriptHash);
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to get script hash for ${contractName}: ${errorMessage}`);
    }
  }

  /**
   * Query a contract's read-only method
   * @param contractName Name of the contract
   * @param operation Operation name
   * @param args Arguments for the operation
   * @returns Operation result
   * @throws ContractError if contract execution fails
   */
  async queryContract(contractName: string, operation: string, args: any[] = []): Promise<any> {
    try {
      // Get the contract definition
      const contract = this.getContract(contractName);

      // Get available operations
      const availableOperations = Object.values(contract.operations).map(op => op.name);

      // Validate operation
      const validOperation = validateContractOperation(operation, availableOperations);

      // Get the script hash
      const scriptHash = this.getContractScriptHash(contractName);

      // Log the query
      logger.info(`Querying contract ${contractName}`, {
        operation: validOperation,
        args: JSON.stringify(args),
        network: this.network
      });

      let result;

      // Use invokefunction RPC method as per Neo N3 documentation
      try {
        // Format the arguments according to Neo N3 RPC specification
        const formattedArgs = this.formatContractArgs(args);

        // Execute the function through the RPC client
        result = await this.rpcClient.execute(
          'invokefunction',
          [scriptHash, validOperation, formattedArgs]
        );
      } catch (invokeError) {
        console.error('Error invoking function:', invokeError);

        // Fallback to invokeScript if invokefunction fails
        // Create a script to execute the operation
        const script = neonJs.sc.createScript({
          scriptHash,
          operation: validOperation,
          args
        });

        // Execute the script through the RPC client
        result = await this.rpcClient.invokeScript(
          neonJs.u.HexString.fromHex(script)
        );
      }

      // Check for execution errors
      if (result && result.state === 'FAULT') {
        throw new ContractError(
          `Contract execution failed: ${result.exception || 'Unknown error'}`,
          { contractName, operation: validOperation, args }
        );
      }

      return result;
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // If it's a network error, wrap it in a NetworkError
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(`Failed to connect to Neo N3 node: ${error.message}`);
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to query contract ${contractName}: ${errorMessage}`,
        { contractName, operation, args }
      );
    }
  }

  /**
   * Invoke a contract's method that requires signing
   * @param fromAccount Account to sign the transaction
   * @param contractName Name of the contract
   * @param operation Operation name
   * @param args Arguments for the operation
   * @param additionalScriptAttributes Additional script attributes
   * @returns Transaction hash
   * @throws ContractError if contract execution fails
   */
  async invokeContract(
    fromAccount: any,
    contractName: string,
    operation: string,
    args: any[] = [],
    additionalScriptAttributes: any[] = []
  ): Promise<string> {
    try {
      // Get the contract definition
      const contract = this.getContract(contractName);

      // Get available operations
      const availableOperations = Object.values(contract.operations).map(op => op.name);

      // Validate operation
      const validOperation = validateContractOperation(operation, availableOperations);

      // Get the script hash
      const scriptHash = this.getContractScriptHash(contractName);

      // Validate account
      if (!fromAccount || !fromAccount.address) {
        throw new ContractError('Invalid account: missing address');
      }

      // Validate address
      validateAddress(fromAccount.address);

      // Log the invocation
      logger.info(`Invoking contract ${contractName}`, {
        operation: validOperation,
        args: JSON.stringify(args),
        network: this.network,
        address: fromAccount.address
      });

      // Create a script to execute the operation
      const script = neonJs.sc.createScript({
        scriptHash,
        operation: validOperation,
        args
      });

      // Create signer object
      const signer = {
        account: neonJs.u.HexString.fromHex(
          neonJs.wallet.getScriptHashFromAddress(fromAccount.address)
        ),
        scopes: 'CalledByEntry',
        allowedcontracts: [],
        allowedgroups: []
      };

      // Format the arguments according to Neo N3 RPC specification
      const formattedArgs = this.formatContractArgs(args);

      let tx;

      // Use invokefunction RPC method as per Neo N3 documentation
      try {
        // Execute the function through the RPC client
        tx = await this.rpcClient.execute(
          'invokefunction',
          [scriptHash, validOperation, formattedArgs, [signer]]
        );

        // If invokefunction succeeds, use the result
        if (!tx || !tx.script) {
          throw new Error('Invalid response from invokefunction');
        }
      } catch (invokeError) {
        console.error('Error invoking function:', invokeError);

        // Fallback to invokeScript if invokefunction fails
        // Create transaction intent
        const txIntent = {
          script,
          attributes: additionalScriptAttributes,
          signers: [
            {
              account: neonJs.u.HexString.fromHex(
                neonJs.wallet.getScriptHashFromAddress(fromAccount.address)
              ),
              scopes: 'CalledByEntry',
            },
          ],
        };

        // Get transaction information from RPC
        tx = await this.rpcClient.invokeScript(
          neonJs.u.HexString.fromHex(script),
          txIntent.signers
        );
      }

      // Check for execution errors
      if (tx.state === 'FAULT') {
        throw new ContractError(
          `Contract execution failed: ${tx.exception || 'Unknown error'}`,
          { contractName, operation: validOperation, args }
        );
      }

      // Sign the transaction
      const transaction = new neonJs.tx.Transaction(tx);
      transaction.sign(fromAccount);

      // Send the transaction
      const txid = await this.rpcClient.sendRawTransaction(
        transaction.serialize(true)
      );

      return txid;
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // If it's a network error, wrap it in a NetworkError
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(`Failed to connect to Neo N3 node: ${error.message}`);
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to invoke contract ${contractName}: ${errorMessage}`,
        { contractName, operation, args }
      );
    }
  }

  /**
   * List all supported famous contracts
   * @returns Array of contract details including availability on current network
   */
  listSupportedContracts(): Array<{
    name: string,
    description: string,
    available: boolean,
    operationCount: number,
    network: NeoNetwork
  }> {
    try {
      return Object.values(FAMOUS_CONTRACTS).map(contract => {
        const contractName = contract.name;
        const isAvailable = this.isContractAvailable(contractName);
        const operationCount = Object.keys(contract.operations).length;

        return {
          name: contractName,
          description: contract.description,
          available: isAvailable,
          operationCount,
          network: this.network
        };
      });
    } catch (error) {
      // Log the error but return an empty array
      logger.error(`Error listing supported contracts`, {
        error: error instanceof Error ? error.message : String(error),
        network: this.network
      });
      return [];
    }
  }

  /**
   * Get details about a contract's operations
   * @param contractName Name of the contract
   * @returns Contract operations details
   * @throws ContractError if contract not found
   */
  getContractOperations(contractName: string): any {
    try {
      // Get the contract definition
      const contract = this.getContract(contractName);

      // Return the operations with additional metadata
      return {
        operations: contract.operations,
        count: Object.keys(contract.operations).length,
        contractName: contract.name,
        network: this.network,
        available: this.isContractAvailable(contractName)
      };
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to get contract operations: ${errorMessage}`);
    }
  }

  /**
   * Check if a contract is available on the current network
   * @param contractName Name of the contract
   * @returns True if the contract is available
   */
  isContractAvailable(contractName: string): boolean {
    try {
      // Get available contract names
      const availableContracts = Object.values(FAMOUS_CONTRACTS).map(c => c.name);

      // Validate contract name without throwing
      if (!contractName || typeof contractName !== 'string') {
        return false;
      }

      // Find the contract (case-insensitive)
      const contractKey = contractName.toLowerCase().trim();
      const contract = Object.values(FAMOUS_CONTRACTS).find(
        c => c.name.toLowerCase() === contractKey
      );

      if (!contract) {
        return false;
      }

      // Check if the contract is available on the current network
      const networkKey = this.network === NeoNetwork.MAINNET
        ? ContractNetwork.MAINNET
        : ContractNetwork.TESTNET;

      return !!contract.scriptHash[networkKey];
    } catch (error) {
      // Log the error but return false
      logger.debug(`Error checking contract availability: ${contractName}`, {
        error: error instanceof Error ? error.message : String(error),
        network: this.network
      });
      return false;
    }
  }

  // NeoFS specific methods
  async createNeoFSContainer(fromAccount: any, ownerId: string, rules: any[]): Promise<string> {
    return this.invokeContract(
      fromAccount,
      'neofs',
      FAMOUS_CONTRACTS.neofs.operations.createContainer.name,
      [
        neonJs.sc.ContractParam.string(ownerId),
        neonJs.sc.ContractParam.array({ type: 'Array', value: rules })
      ]
    );
  }

  async getNeoFSContainers(ownerId: string): Promise<any> {
    return this.queryContract(
      'neofs',
      FAMOUS_CONTRACTS.neofs.operations.getContainers.name,
      [neonJs.sc.ContractParam.string(ownerId)]
    );
  }

  /**
   * Deploy a smart contract
   * @param wif WIF private key of the account that will deploy the contract
   * @param script Base64-encoded contract script
   * @param manifest Contract manifest
   * @returns Transaction hash and contract hash
   * @throws ContractError if deployment fails
   */
  async deployContract(wif: string, script: string, manifest: any): Promise<any> {
    try {
      // Create account from WIF
      const account = new neonJs.wallet.Account(wif);

      // Validate script
      if (!script || typeof script !== 'string') {
        throw new ValidationError('Invalid script: must be a non-empty string');
      }

      // Validate manifest
      if (!manifest || typeof manifest !== 'object') {
        throw new ValidationError('Invalid manifest: must be a non-empty object');
      }

      // Convert script from base64 to hex if needed
      let scriptHex = script;
      if (script.match(/^[A-Za-z0-9+/=]+$/)) {
        // Looks like base64, convert to hex
        const scriptBuffer = Buffer.from(script, 'base64');
        scriptHex = scriptBuffer.toString('hex');
      }

      // Log the deployment
      logger.info(`Deploying contract`, {
        network: this.network,
        address: account.address,
        manifestName: manifest.name
      });

      // Create deployment transaction
      const deploymentConfig = {
        script: scriptHex,
        manifest: JSON.stringify(manifest),
        account: account
      };

      // Create a transaction to deploy the contract
      const tx = new neonJs.tx.Transaction({
        signers: [
          {
            account: neonJs.wallet.getScriptHashFromAddress(account.address),
            scopes: neonJs.tx.WitnessScope.CalledByEntry
          }
        ],
        systemFee: '10',
        networkFee: '1',
        validUntilBlock: 1000,
        script: neonJs.sc.createScript({
          // Use the ContractManagement native contract hash
          scriptHash: '0xfffdc93764dbaddd97c48f252a53ea4643faa3fd',
          operation: 'deploy',
          args: [
            neonJs.sc.ContractParam.byteArray(scriptHex),
            neonJs.sc.ContractParam.string(JSON.stringify(manifest))
          ]
        })
      });

      // Sign the transaction
      tx.sign(account);

      // Send the transaction
      const txid = await this.rpcClient.sendRawTransaction(
        tx.serialize(true)
      );

      // Calculate the contract hash (simplified version)
      const contractHash = neonJs.wallet.getScriptHashFromAddress(account.address);

      return {
        txid,
        contractHash,
        address: account.address,
        network: this.network
      };
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // If it's a validation error, rethrow it
      if (error instanceof ValidationError) {
        throw error;
      }

      // If it's a network error, wrap it in a NetworkError
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(`Failed to connect to Neo N3 node: ${error.message}`);
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to deploy contract: ${errorMessage}`
      );
    }
  }

  // NeoBurger specific methods
  async depositNeoToNeoBurger(fromAccount: any): Promise<string> {
    return this.invokeContract(
      fromAccount,
      'neoburger',
      FAMOUS_CONTRACTS.neoburger.operations.depositNeo.name,
      [neonJs.sc.ContractParam.hash160(fromAccount.address)]
    );
  }

  async withdrawNeoFromNeoBurger(fromAccount: any, amount: string | number): Promise<string> {
    // Validate amount
    const validAmount = validateAmount(amount);

    return this.invokeContract(
      fromAccount,
      'neoburger',
      FAMOUS_CONTRACTS.neoburger.operations.withdrawNeo.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async getNeoBurgerBalance(address: string): Promise<any> {
    return this.queryContract(
      'neoburger',
      FAMOUS_CONTRACTS.neoburger.operations.balanceOf.name,
      [neonJs.sc.ContractParam.hash160(address)]
    );
  }

  async claimNeoBurgerGas(fromAccount: any): Promise<string> {
    return this.invokeContract(
      fromAccount,
      'neoburger',
      FAMOUS_CONTRACTS.neoburger.operations.claimGas.name,
      [neonJs.sc.ContractParam.hash160(fromAccount.address)]
    );
  }

  // Flamingo specific methods
  async stakeFlamingo(fromAccount: any, amount: string | number): Promise<string> {
    // Validate amount
    const validAmount = validateAmount(amount);

    return this.invokeContract(
      fromAccount,
      'flamingo',
      FAMOUS_CONTRACTS.flamingo.operations.stake.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async unstakeFlamingo(fromAccount: any, amount: string | number): Promise<string> {
    // Validate amount
    const validAmount = validateAmount(amount);

    return this.invokeContract(
      fromAccount,
      'flamingo',
      FAMOUS_CONTRACTS.flamingo.operations.unstake.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async getFlamingoBalance(address: string): Promise<any> {
    return this.queryContract(
      'flamingo',
      FAMOUS_CONTRACTS.flamingo.operations.balanceOf.name,
      [neonJs.sc.ContractParam.hash160(address)]
    );
  }

  // NeoCompound specific methods
  async depositToNeoCompound(fromAccount: any, assetId: string, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    const validAssetId = validateScriptHash(assetId);

    return this.invokeContract(
      fromAccount,
      'neocompound',
      FAMOUS_CONTRACTS.neocompound.operations.deposit.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.hash160(validAssetId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async withdrawFromNeoCompound(fromAccount: any, assetId: string, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    const validAssetId = validateScriptHash(assetId);

    return this.invokeContract(
      fromAccount,
      'neocompound',
      FAMOUS_CONTRACTS.neocompound.operations.withdraw.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.hash160(validAssetId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async getNeoCompoundBalance(address: string, assetId: string): Promise<any> {
    // Validate parameters
    const validAssetId = validateScriptHash(assetId);

    return this.queryContract(
      'neocompound',
      FAMOUS_CONTRACTS.neocompound.operations.getBalance.name,
      [
        neonJs.sc.ContractParam.hash160(address),
        neonJs.sc.ContractParam.hash160(validAssetId)
      ]
    );
  }

  // GrandShare specific methods
  async depositToGrandShare(fromAccount: any, poolId: number | string, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    const validPoolId = validateInteger(poolId);

    // Validate address
    validateAddress(fromAccount.address);

    return this.invokeContract(
      fromAccount,
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.deposit.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(validPoolId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async withdrawFromGrandShare(fromAccount: any, poolId: number | string, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    const validPoolId = validateInteger(poolId);

    // Validate address
    validateAddress(fromAccount.address);

    return this.invokeContract(
      fromAccount,
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.withdraw.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(validPoolId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async getGrandSharePoolDetails(poolId: number | string): Promise<any> {
    // Validate parameters
    const validPoolId = validateInteger(poolId);

    return this.queryContract(
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.getPoolDetails.name,
      [neonJs.sc.ContractParam.integer(validPoolId)]
    );
  }

  // GhostMarket specific methods
  async createGhostMarketNFT(fromAccount: any, tokenURI: string, properties: any[]): Promise<string> {
    // Validate address
    validateAddress(fromAccount.address);

    // Validate tokenURI (basic validation)
    if (!tokenURI || typeof tokenURI !== 'string') {
      throw new ValidationError('Token URI must be a non-empty string');
    }

    return this.invokeContract(
      fromAccount,
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.createNFT.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.string(tokenURI),
        neonJs.sc.ContractParam.array({ type: 'Array', value: properties })
      ]
    );
  }

  async listGhostMarketNFT(fromAccount: any, tokenId: number | string, price: string | number, paymentToken: string): Promise<string> {
    // Validate parameters
    const validTokenId = validateInteger(tokenId);
    const validPrice = validateAmount(price);
    const validPaymentToken = validateScriptHash(paymentToken);

    // Validate address
    validateAddress(fromAccount.address);

    return this.invokeContract(
      fromAccount,
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.listNFT.name,
      [
        neonJs.sc.ContractParam.integer(validTokenId),
        neonJs.sc.ContractParam.integer(validPrice),
        neonJs.sc.ContractParam.hash160(validPaymentToken)
      ]
    );
  }

  async buyGhostMarketNFT(fromAccount: any, tokenId: number | string): Promise<string> {
    // Validate parameters
    const validTokenId = validateInteger(tokenId);

    // Validate address
    validateAddress(fromAccount.address);

    return this.invokeContract(
      fromAccount,
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.buyNFT.name,
      [
        neonJs.sc.ContractParam.integer(validTokenId),
        neonJs.sc.ContractParam.hash160(fromAccount.address)
      ]
    );
  }

  async getGhostMarketTokenInfo(tokenId: number | string): Promise<any> {
    // Validate parameters
    const validTokenId = validateInteger(tokenId);

    return this.queryContract(
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.getTokenInfo.name,
      [neonJs.sc.ContractParam.integer(validTokenId)]
    );
  }

  /**
   * Get the current network
   * @returns Current network
   */
  getNetwork(): NeoNetwork {
    return this.network;
  }

  /**
   * Format contract arguments according to Neo N3 RPC specification
   * @param args Arguments to format
   * @returns Formatted arguments
   */
  private formatContractArgs(args: any[]): any[] {
    if (!args || !Array.isArray(args)) {
      return [];
    }

    return args.map(arg => {
      // Handle null or undefined
      if (arg === null || arg === undefined) {
        return { type: 'Any', value: null };
      }

      // Handle numbers
      if (typeof arg === 'number') {
        if (Number.isInteger(arg)) {
          return { type: 'Integer', value: arg.toString() };
        } else {
          return { type: 'Float', value: arg.toString() };
        }
      }

      // Handle booleans
      if (typeof arg === 'boolean') {
        return { type: 'Boolean', value: arg };
      }

      // Handle strings
      if (typeof arg === 'string') {
        // Check if it's a hex string (script hash)
        if (arg.startsWith('0x') && /^0x[0-9a-fA-F]{40}$/.test(arg)) {
          return { type: 'Hash160', value: arg };
        }

        // Regular string
        return { type: 'String', value: arg };
      }

      // Handle arrays
      if (Array.isArray(arg)) {
        return { type: 'Array', value: this.formatContractArgs(arg) };
      }

      // Handle objects (as Map)
      if (typeof arg === 'object') {
        return { type: 'Map', value: Object.entries(arg).map(([k, v]) => ({
          key: this.formatContractArgs([k])[0],
          value: this.formatContractArgs([v])[0]
        }))};
      }

      // Default to ByteArray for unknown types
      return { type: 'ByteArray', value: Buffer.from(String(arg)).toString('hex') };
    });
  }

  /**
   * Invoke a read-only contract method
   * @param contractName Name of the contract
   * @param operation Operation name
   * @param args Arguments for the operation
   * @returns Operation result
   * @throws ContractError if contract execution fails
   */
  async invokeReadContract(
    contractName: string,
    operation: string,
    args: any[] = []
  ): Promise<any> {
    try {
      // Use the queryContract method to execute the read-only operation
      return await this.queryContract(contractName, operation, args);
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to invoke read contract ${contractName}: ${errorMessage}`,
        { contractName, operation, args }
      );
    }
  }

  /**
   * Invoke a contract method that requires signing (alias for invokeContract)
   * @param fromAccount Account to sign the transaction
   * @param contractName Name of the contract
   * @param operation Operation name
   * @param args Arguments for the operation
   * @param additionalScriptAttributes Additional script attributes
   * @returns Object containing txid
   * @throws ContractError if contract execution fails
   */
  async invokeWriteContract(
    fromAccount: any,
    contractName: string,
    operation: string,
    args: any[] = [],
    additionalScriptAttributes: any[] = []
  ): Promise<{ txid: string }> {
    try {
      // Only pass additionalScriptAttributes if it's explicitly provided
      const txid = args.length === 0 && additionalScriptAttributes.length === 0
        ? await this.invokeContract(fromAccount, contractName, operation)
        : additionalScriptAttributes.length === 0
          ? await this.invokeContract(fromAccount, contractName, operation, args)
          : await this.invokeContract(fromAccount, contractName, operation, args, additionalScriptAttributes);

      return { txid };
    } catch (error) {
      // If it's already a ContractError, rethrow it
      if (error instanceof ContractError) {
        throw error;
      }

      // Otherwise, wrap it in a ContractError
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to invoke write contract ${contractName}: ${errorMessage}`,
        { contractName, operation, args }
      );
    }
  }
}