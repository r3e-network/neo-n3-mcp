/**
 * Famous Neo N3 Contracts Service
 * 
 * This service provides methods to interact with well-known Neo N3 contracts
 * like NeoFS, NeoBurger, Flamingo, NeoCompound, GrandShare, and GhostMarket.
 */
import * as neonJs from '@cityofzion/neon-js';
import { NeoNetwork } from '../services/neo-service.js';
import { 
  FAMOUS_CONTRACTS, 
  ContractDefinition, 
  ContractNetwork 
} from './contracts.js';
import { validateScriptHash, validateAmount } from '../utils/validation.js';

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
   */
  constructor(rpcUrl: string, network: NeoNetwork = NeoNetwork.MAINNET) {
    if (!rpcUrl) {
      throw new Error('RPC URL is required');
    }
    
    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Neo RPC client: ${errorMessage}`);
    }
    
    this.network = network;
  }

  /**
   * Get a contract by name
   * @param contractName Name of the contract
   * @returns Contract definition
   */
  getContract(contractName: string): ContractDefinition {
    const contractKey = contractName.toLowerCase();
    const contract = FAMOUS_CONTRACTS[contractKey];
    
    if (!contract) {
      throw new Error(`Contract ${contractName} not found`);
    }
    
    return contract;
  }

  /**
   * Get contract script hash based on the current network
   * @param contractName Name of the contract
   * @returns Script hash for the current network
   */
  getContractScriptHash(contractName: string): string {
    const contract = this.getContract(contractName);
    
    const networkKey = this.network === NeoNetwork.MAINNET 
      ? ContractNetwork.MAINNET 
      : ContractNetwork.TESTNET;
    
    const scriptHash = contract.scriptHash[networkKey];
    
    if (!scriptHash) {
      throw new Error(`Contract ${contractName} is not available on ${this.network}`);
    }
    
    return scriptHash;
  }

  /**
   * Query a contract's read-only method
   * @param contractName Name of the contract
   * @param operation Operation name
   * @param args Arguments for the operation
   * @returns Operation result
   */
  async queryContract(contractName: string, operation: string, args: any[] = []): Promise<any> {
    try {
      const scriptHash = this.getContractScriptHash(contractName);
      
      // Create a script to execute the operation
      const script = neonJs.sc.createScript({
        scriptHash,
        operation,
        args
      });
      
      // Execute the script through the RPC client
      const result = await this.rpcClient.invokeScript(
        neonJs.u.HexString.fromHex(script)
      );
      
      if (result.state === 'FAULT') {
        throw new Error(`Contract execution failed: ${result.exception || 'Unknown error'}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to query contract ${contractName}: ${errorMessage}`);
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
   */
  async invokeContract(
    fromAccount: any,
    contractName: string,
    operation: string,
    args: any[] = [],
    additionalScriptAttributes: any[] = []
  ): Promise<string> {
    try {
      const scriptHash = this.getContractScriptHash(contractName);
      
      // Validate account
      if (!fromAccount || !fromAccount.address) {
        throw new Error('Invalid account: missing address');
      }
      
      // Create a script to execute the operation
      const script = neonJs.sc.createScript({
        scriptHash,
        operation,
        args
      });
      
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
      const tx = await this.rpcClient.invokeScript(
        neonJs.u.HexString.fromHex(script),
        txIntent.signers
      );
      
      // Sign the transaction
      const transaction = new neonJs.tx.Transaction(tx);
      transaction.sign(fromAccount);
      
      // Send the transaction
      const txid = await this.rpcClient.sendRawTransaction(
        transaction.serialize(true)
      );
      
      return txid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to invoke contract ${contractName}: ${errorMessage}`);
    }
  }

  /**
   * List all supported famous contracts
   * @returns Array of contract names and descriptions
   */
  listSupportedContracts(): Array<{ name: string, description: string }> {
    return Object.values(FAMOUS_CONTRACTS).map(contract => ({
      name: contract.name,
      description: contract.description
    }));
  }

  /**
   * Get details about a contract's operations
   * @param contractName Name of the contract
   * @returns Contract operations details
   */
  getContractOperations(contractName: string): any {
    const contract = this.getContract(contractName);
    return contract.operations;
  }

  /**
   * Check if a contract is available on the current network
   * @param contractName Name of the contract
   * @returns True if the contract is available
   */
  isContractAvailable(contractName: string): boolean {
    try {
      this.getContractScriptHash(contractName);
      return true;
    } catch (error) {
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
  async depositToGrandShare(fromAccount: any, poolId: number, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    
    return this.invokeContract(
      fromAccount,
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.deposit.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(poolId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async withdrawFromGrandShare(fromAccount: any, poolId: number, amount: string | number): Promise<string> {
    // Validate parameters
    const validAmount = validateAmount(amount);
    
    return this.invokeContract(
      fromAccount,
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.withdraw.name,
      [
        neonJs.sc.ContractParam.hash160(fromAccount.address),
        neonJs.sc.ContractParam.integer(poolId),
        neonJs.sc.ContractParam.integer(validAmount)
      ]
    );
  }

  async getGrandSharePoolDetails(poolId: number): Promise<any> {
    return this.queryContract(
      'grandshare',
      FAMOUS_CONTRACTS.grandshare.operations.getPoolDetails.name,
      [neonJs.sc.ContractParam.integer(poolId)]
    );
  }

  // GhostMarket specific methods
  async createGhostMarketNFT(fromAccount: any, tokenURI: string, properties: any[]): Promise<string> {
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

  async listGhostMarketNFT(fromAccount: any, tokenId: number, price: string | number, paymentToken: string): Promise<string> {
    // Validate parameters
    const validPrice = validateAmount(price);
    const validPaymentToken = validateScriptHash(paymentToken);
    
    return this.invokeContract(
      fromAccount,
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.listNFT.name,
      [
        neonJs.sc.ContractParam.integer(tokenId),
        neonJs.sc.ContractParam.integer(validPrice),
        neonJs.sc.ContractParam.hash160(validPaymentToken)
      ]
    );
  }

  async buyGhostMarketNFT(fromAccount: any, tokenId: number): Promise<string> {
    return this.invokeContract(
      fromAccount,
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.buyNFT.name,
      [
        neonJs.sc.ContractParam.integer(tokenId),
        neonJs.sc.ContractParam.hash160(fromAccount.address)
      ]
    );
  }

  async getGhostMarketTokenInfo(tokenId: number): Promise<any> {
    return this.queryContract(
      'ghostmarket',
      FAMOUS_CONTRACTS.ghostmarket.operations.getTokenInfo.name,
      [neonJs.sc.ContractParam.integer(tokenId)]
    );
  }

  /**
   * Get the current network
   * @returns Current network
   */
  getNetwork(): NeoNetwork {
    return this.network;
  }
} 