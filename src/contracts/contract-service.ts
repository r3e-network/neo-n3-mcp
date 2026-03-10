/**
 * Famous Neo N3 Contracts Service
 *
 * This service provides methods to interact with well-known Neo N3 contracts
 * like NeoFS, NeoBurger, Flamingo, NeoCompound, GrandShare, and GhostMarket.
 */
import * as neonJs from '@cityofzion/neon-js';
import { config } from '../config';
import { NeoNetwork } from '../services/neo-service';
import {
  FAMOUS_CONTRACTS,
  ContractDefinition,
  ContractNetwork
} from './contracts';
import { N3IndexClient, N3IndexResolvedContract } from './n3index-client';
import { normalizeScriptHash, tryGetAddressFromScriptHash, tryGetScriptHashFromAddress } from '../metadata/known-accounts';
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

type ContractReferenceSource = 'known_name' | 'known_hash' | 'script_hash' | 'address' | 'manifest_name' | 'n3index_metadata' | 'n3index_manifest';

interface ResolvedContractTarget {
  reference: string;
  scriptHash: string;
  address?: string;
  source: ContractReferenceSource;
  knownContract?: ContractDefinition;
  remoteMetadata?: N3IndexResolvedContract;
}

interface ContractOperationSummary {
  operations: Record<string, { name: string; description: string; args?: Array<{ name: string; type: string; description: string }> }>;
  count: number;
  contractName: string;
  network: NeoNetwork;
  available: boolean;
}

function isMissingContractStateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes('unknown contract')
    || normalized.includes('contract not found')
    || normalized.includes('unknown entity')
    || normalized.includes('unknown item')
    || normalized.includes('not deployed');
}

/**
 * Service for interacting with famous Neo N3 contracts
 */
export class ContractService {
  private rpcClient: any;
  private network: NeoNetwork;

  private readonly rpcUrl: string;
  private networkMagic?: number;
  private readonly discoveredContractsByName = new Map<string, string>();
  private readonly n3indexClient: N3IndexClient | null;
  private readonly remotelyResolvedContractsByName = new Map<string, N3IndexResolvedContract>();

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

    this.network = network;
    this.rpcUrl = rpcUrl;
    this.n3indexClient = config.n3index.enabled ? new N3IndexClient(config.n3index.baseUrl) : null;

    try {
      this.rpcClient = new neonJs.rpc.RPCClient(rpcUrl);

      logger.info(`ContractService initialized for ${network}`, { rpcUrl });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Neo RPC client`, { error: errorMessage, rpcUrl, network });
      throw new NetworkError(`Failed to initialize Neo RPC client: ${errorMessage}`);
    }
  }

  private getNetworkKey(): ContractNetwork {
    return this.network === NeoNetwork.MAINNET ? ContractNetwork.MAINNET : ContractNetwork.TESTNET;
  }

  private rememberDiscoveredContract(name: string | undefined, scriptHash: string) {
    if (!name || typeof name !== 'string') {
      return;
    }

    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }

    this.discoveredContractsByName.set(normalizedName, scriptHash);
  }

  private rememberRemoteContract(name: string | undefined, metadata: N3IndexResolvedContract) {
    if (!name || typeof name !== 'string') {
      return;
    }

    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }

    this.remotelyResolvedContractsByName.set(normalizedName, metadata);
    this.rememberDiscoveredContract(name, metadata.contractHash);
  }

  private getKnownContractByHash(scriptHash: string): ContractDefinition | undefined {
    const normalizedHash = validateScriptHash(scriptHash).toLowerCase();
    const networkKey = this.getNetworkKey();

    return Object.values(FAMOUS_CONTRACTS).find((contract) => {
      const knownHash = contract.scriptHash[networkKey];
      return typeof knownHash === 'string' && validateScriptHash(knownHash).toLowerCase() === normalizedHash;
    });
  }

  private getKnownContractByName(reference: string): ContractDefinition | undefined {
    const availableContracts = Object.values(FAMOUS_CONTRACTS).map((contract) => contract.name);
    const validContractName = validateContractName(reference, availableContracts);
    const contractKey = validContractName.toLowerCase();

    return Object.values(FAMOUS_CONTRACTS).find((contract) => contract.name.toLowerCase() === contractKey);
  }

  private resolveContractTarget(contractReference: string): ResolvedContractTarget {
    const reference = typeof contractReference === 'string' ? contractReference.trim() : '';
    if (!reference) {
      throw new ValidationError('Contract name, script hash, or Neo address is required');
    }

    const normalizedHash = normalizeScriptHash(reference);
    if (normalizedHash) {
      return {
        reference,
        scriptHash: validateScriptHash(normalizedHash),
        address: tryGetAddressFromScriptHash(normalizedHash) ?? undefined,
        source: this.getKnownContractByHash(normalizedHash) ? 'known_hash' : 'script_hash',
        knownContract: this.getKnownContractByHash(normalizedHash),
      };
    }

    let validatedAddress: string | null = null;
    try {
      validatedAddress = validateAddress(reference);
    } catch {
      validatedAddress = null;
    }

    const addressScriptHash = validatedAddress ? tryGetScriptHashFromAddress(validatedAddress) : null;
    if (validatedAddress && addressScriptHash) {
      return {
        reference,
        scriptHash: validateScriptHash(addressScriptHash),
        address: validatedAddress,
        source: 'address',
        knownContract: this.getKnownContractByHash(addressScriptHash),
      };
    }

    try {
      const knownContract = this.getKnownContractByName(reference);
      if (knownContract) {
        const scriptHash = knownContract.scriptHash[this.getNetworkKey()];
        if (!scriptHash) {
          throw new ContractError(
            `Contract ${knownContract.name} is not available on ${this.network}. ` +
            `It's only available on ${Object.keys(knownContract.scriptHash).join(', ')}.`
          );
        }

        const normalizedKnownHash = validateScriptHash(scriptHash);
        return {
          reference,
          scriptHash: normalizedKnownHash,
          address: tryGetAddressFromScriptHash(normalizedKnownHash) ?? undefined,
          source: 'known_name',
          knownContract,
        };
      }
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
    }

    const discoveredHash = this.discoveredContractsByName.get(reference.toLowerCase());
    if (discoveredHash) {
      return {
        reference,
        scriptHash: validateScriptHash(discoveredHash),
        address: tryGetAddressFromScriptHash(discoveredHash) ?? undefined,
        source: 'manifest_name',
      };
    }

    throw new ContractError(
      `Unable to resolve contract reference "${reference}". Provide a known contract name, script hash, or Neo address.`,
      { contractReference: reference, network: this.network }
    );
  }

  private buildRemoteTarget(reference: string, metadata: N3IndexResolvedContract): ResolvedContractTarget {
    return {
      reference,
      scriptHash: validateScriptHash(metadata.contractHash),
      address: tryGetAddressFromScriptHash(metadata.contractHash) ?? undefined,
      source: metadata.source === 'contract_metadata_cache' ? 'n3index_metadata' : 'n3index_manifest',
      remoteMetadata: metadata,
      knownContract: this.getKnownContractByHash(metadata.contractHash),
    };
  }

  private async resolveContractTargetAsync(contractReference: string): Promise<ResolvedContractTarget> {
    try {
      return this.resolveContractTarget(contractReference);
    } catch (error) {
      if (!(error instanceof ContractError)) {
        throw error;
      }

      const reference = typeof contractReference === 'string' ? contractReference.trim() : '';
      if (!reference || !this.n3indexClient) {
        throw error;
      }

      const cachedRemote = this.remotelyResolvedContractsByName.get(reference.toLowerCase());
      if (cachedRemote) {
        return this.buildRemoteTarget(reference, cachedRemote);
      }

      const remoteMetadata = await this.n3indexClient.resolveByName(this.network, reference);
      if (!remoteMetadata) {
        throw error;
      }

      this.rememberRemoteContract(remoteMetadata.displayName ?? reference, remoteMetadata);
      if (remoteMetadata.symbol) {
        this.rememberRemoteContract(remoteMetadata.symbol, remoteMetadata);
      }

      return this.buildRemoteTarget(reference, remoteMetadata);
    }
  }

  private buildOperationSummary(target: ResolvedContractTarget, contractState?: any): ContractOperationSummary {
    if (target.knownContract) {
      return {
        operations: target.knownContract.operations,
        count: Object.keys(target.knownContract.operations).length,
        contractName: target.knownContract.name,
        network: this.network,
        available: true,
      };
    }

    const manifestMethods = Array.isArray(contractState?.manifest?.abi?.methods)
      ? contractState.manifest.abi.methods
      : [];
    const operations = manifestMethods.reduce((accumulator: ContractOperationSummary['operations'], method: any) => {
      const methodName = typeof method?.name === 'string' ? method.name.trim() : '';
      if (!methodName) {
        return accumulator;
      }

      accumulator[methodName] = {
        name: methodName,
        description: 'Method discovered from on-chain contract manifest',
        args: Array.isArray(method.parameters)
          ? method.parameters.map((parameter: any) => ({
              name: typeof parameter?.name === 'string' ? parameter.name : 'arg',
              type: typeof parameter?.type === 'string' ? parameter.type : 'Any',
              description: 'Manifest parameter'
            }))
          : undefined,
      };
      return accumulator;
    }, {});

    return {
      operations,
      count: Object.keys(operations).length,
      contractName: typeof contractState?.manifest?.name === 'string' && contractState.manifest.name.trim()
        ? contractState.manifest.name.trim()
        : target.remoteMetadata?.displayName ?? target.remoteMetadata?.manifestName ?? target.address ?? target.scriptHash,
      network: this.network,
      available: true,
    };
  }

  /**
   * Get a contract by name
   * @param contractName Name of the contract
   * @returns Contract definition
   * @throws ContractError if contract not found
   */
  getContract(contractNameOrHash: string): ContractDefinition {
    const reference = typeof contractNameOrHash === 'string' ? contractNameOrHash.trim() : '';
    if (!reference) {
      throw new ValidationError('Contract name or script hash is required');
    }

    const networkKey = this.network === NeoNetwork.MAINNET
      ? ContractNetwork.MAINNET
      : ContractNetwork.TESTNET;

    const looksLikeHash = reference.startsWith('0x') || /^[0-9a-fA-F]{40}$/.test(reference);
    if (looksLikeHash) {
      const normalizedHash = validateScriptHash(reference).toLowerCase();
      const contractByHash = Object.values(FAMOUS_CONTRACTS).find((contract) => {
        const scriptHash = contract.scriptHash[networkKey];
        return typeof scriptHash === 'string' && validateScriptHash(scriptHash).toLowerCase() === normalizedHash;
      });

      if (!contractByHash) {
        throw new ContractError(`Contract with script hash ${reference} not found on ${this.network}`);
      }

      return contractByHash;
    }

    const availableContracts = Object.values(FAMOUS_CONTRACTS).map(c => c.name);
    const validContractName = validateContractName(reference, availableContracts);
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
  getContractScriptHash(contractReference: string): string {
    try {
      return this.resolveContractTarget(contractReference).scriptHash;
    } catch (error) {
      if (error instanceof ContractError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to get script hash for ${contractReference}: ${errorMessage}`);
    }
  }

  async resolveContractScriptHash(contractReference: string): Promise<string> {
    try {
      return (await this.resolveContractTargetAsync(contractReference)).scriptHash;
    } catch (error) {
      if (error instanceof ContractError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to resolve script hash for ${contractReference}: ${errorMessage}`);
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
  async queryContract(contractReference: string, operation: string, args: any[] = []): Promise<any> {
    try {
      const target = await this.resolveContractTargetAsync(contractReference);
      await this.assertContractDeployed(contractReference);
      const validOperation = target.knownContract
        ? validateContractOperation(operation, Object.values(target.knownContract.operations).map((op) => op.name))
        : validateContractOperation(operation, []);

      // Log the query
      logger.info(`Querying contract ${contractReference}`, {
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
        result = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'invokefunction', params: [target.scriptHash, validOperation, formattedArgs] }));
      } catch (invokeError) {
        logger.warn('invokefunction failed; falling back to invokeScript for read invocation', { contractReference, operation: validOperation, error: invokeError instanceof Error ? invokeError.message : String(invokeError) });

        // Fallback to invokeScript if invokefunction fails
        // Create a script to execute the operation
        const script = neonJs.sc.createScript({
          scriptHash: target.scriptHash,
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
          { contractReference, operation: validOperation, args, scriptHash: target.scriptHash }
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
        `Failed to query contract ${contractReference}: ${errorMessage}`,
        { contractReference, operation, args }
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
    contractReference: string,
    operation: string,
    args: any[] = [],
    additionalScriptAttributes: any[] = []
  ): Promise<string> {
    try {
      const target = await this.resolveContractTargetAsync(contractReference);
      await this.assertContractDeployed(contractReference);
      const validOperation = target.knownContract
        ? validateContractOperation(operation, Object.values(target.knownContract.operations).map((op) => op.name))
        : validateContractOperation(operation, []);

      // Validate account
      if (!fromAccount || !fromAccount.address) {
        throw new ContractError('Invalid account: missing address');
      }

      // Validate address
      validateAddress(fromAccount.address);

      // Log the invocation
      logger.info(`Invoking contract ${contractReference}`, {
        operation: validOperation,
        args: JSON.stringify(args),
        network: this.network,
        address: fromAccount.address
      });

      // Create a script to execute the operation
      const script = neonJs.sc.createScript({
        scriptHash: target.scriptHash,
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
        tx = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'invokefunction', params: [target.scriptHash, validOperation, formattedArgs, [signer]] }));

        // If invokefunction succeeds, use the result
        if (!tx || !tx.script) {
          throw new Error('Invalid response from invokefunction');
        }
      } catch (invokeError) {
        logger.warn('invokefunction failed; falling back to invokeScript for write invocation', { contractReference, operation: validOperation, address: fromAccount.address, error: invokeError instanceof Error ? invokeError.message : String(invokeError) });

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
          { contractReference, operation: validOperation, args, scriptHash: target.scriptHash }
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
        `Failed to invoke contract ${contractReference}: ${errorMessage}`,
        { contractReference, operation, args }
      );
    }
  }

  private async getContractState(scriptHash: string): Promise<any> {
    if (typeof this.rpcClient.getContractState === 'function') {
      return await this.rpcClient.getContractState(scriptHash);
    }

    return await this.rpcClient.execute(
      new neonJs.rpc.Query({ method: 'getcontractstate', params: [scriptHash] })
    );
  }

  async getContractStatus(contractReference: string): Promise<any> {
    const target = await this.resolveContractTargetAsync(contractReference);
    if (!target.remoteMetadata && this.n3indexClient) {
      try {
        const remoteMetadata = await this.n3indexClient.getContractByHash(this.network, target.scriptHash);
        if (remoteMetadata) {
          target.remoteMetadata = remoteMetadata;
          this.rememberRemoteContract(remoteMetadata.displayName ?? contractReference, remoteMetadata);
          if (remoteMetadata.symbol) {
            this.rememberRemoteContract(remoteMetadata.symbol, remoteMetadata);
          }
        }
      } catch (error) {
        logger.debug('N3Index hash enrichment failed', {
          contractReference,
          scriptHash: target.scriptHash,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const contractState = await this.getContractState(target.scriptHash);
      const manifestName = typeof contractState?.manifest?.name === 'string' && contractState.manifest.name.trim()
        ? contractState.manifest.name.trim()
        : target.remoteMetadata?.displayName ?? target.remoteMetadata?.manifestName ?? target.knownContract?.name ?? target.address ?? target.scriptHash;
      const operations = this.buildOperationSummary(target, contractState);

      this.rememberDiscoveredContract(manifestName, target.scriptHash);

      return {
        reference: target.reference,
        referenceType: target.source,
        scriptHash: target.scriptHash,
        address: target.address ?? tryGetAddressFromScriptHash(target.scriptHash) ?? undefined,
        name: target.remoteMetadata?.displayName ?? target.knownContract?.name ?? manifestName,
        manifestName,
        symbol: target.remoteMetadata?.symbol ?? undefined,
        logoUrl: target.remoteMetadata?.logoUrl ?? undefined,
        description: target.knownContract?.description ?? `Neo N3 smart contract at ${target.scriptHash}`,
        deployed: true,
        status: 'deployed',
        operationCount: operations.count,
        operations: operations.operations,
        network: this.network,
        contractState,
      };
    } catch (error) {
      if (!isMissingContractStateError(error)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        reference: target.reference,
        referenceType: target.source,
        scriptHash: target.scriptHash,
        address: target.address ?? tryGetAddressFromScriptHash(target.scriptHash) ?? undefined,
        name: target.remoteMetadata?.displayName ?? target.knownContract?.name ?? target.address ?? target.scriptHash,
        symbol: target.remoteMetadata?.symbol ?? undefined,
        logoUrl: target.remoteMetadata?.logoUrl ?? undefined,
        description: target.knownContract?.description ?? `Neo N3 smart contract at ${target.scriptHash}`,
        deployed: false,
        status: 'not_deployed',
        operationCount: target.knownContract ? Object.keys(target.knownContract.operations).length : 0,
        operations: target.knownContract?.operations ?? {},
        network: this.network,
        error: errorMessage,
      };
    }
  }

  async getContractInfo(contractReference: string): Promise<any> {
    const status = await this.getContractStatus(contractReference);

    return {
      name: status.name,
      description: status.description,
      scriptHash: status.scriptHash,
      ...(status.address ? { address: status.address } : {}),
      operations: {
        operations: status.operations,
        count: status.operationCount,
        contractName: status.name,
        network: this.network,
        available: status.deployed,
      },
      network: this.network,
      available: status.deployed,
      status,
    };
  }

  async isContractDeployed(contractNameOrHash: string): Promise<boolean> {
    try {
      if (!contractNameOrHash || typeof contractNameOrHash !== 'string') {
        return false;
      }

      const target = await this.resolveContractTargetAsync(contractNameOrHash);
      await this.getContractState(target.scriptHash);
      return true;
    } catch (error) {
      if (!isMissingContractStateError(error)) {
        throw error;
      }

      logger.debug(`Contract is not deployed on current network: ${contractNameOrHash}`, {
        error: error instanceof Error ? error.message : String(error),
        network: this.network
      });
      return false;
    }
  }

  async assertContractDeployed(contractNameOrHash: string): Promise<void> {
    const target = await this.resolveContractTargetAsync(contractNameOrHash);
    const isDeployed = await this.isContractDeployed(contractNameOrHash);
    if (!isDeployed) {
      throw new ContractError(
        `Contract ${target.remoteMetadata?.displayName ?? target.knownContract?.name ?? target.address ?? target.scriptHash} is not deployed on ${this.network}`,
        { contractReference: contractNameOrHash, scriptHash: target.scriptHash, network: this.network }
      );
    }
  }

  /**
   * List all supported famous contracts
   * @returns Array of contract details including live availability on current network
   */
  async listSupportedContracts(): Promise<Array<{
    name: string,
    description: string,
    available: boolean,
    operationCount: number,
    network: NeoNetwork
  }>> {
    try {
      const contracts = await Promise.all(Object.values(FAMOUS_CONTRACTS).map(async (contract) => {
        const contractName = contract.name;
        const isAvailable = await this.isContractDeployed(contractName);
        const operationCount = Object.keys(contract.operations).length;

        return {
          name: contractName,
          description: contract.description,
          available: isAvailable,
          operationCount,
          network: this.network
        };
      }));

      return contracts;
    } catch (error) {
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
  getContractOperations(contractNameOrHash: string): any {
    try {
      const target = this.resolveContractTarget(contractNameOrHash);
      const operations = this.buildOperationSummary(target);

      return operations;
    } catch (error) {
      if (error instanceof ContractError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to get contract operations: ${errorMessage}`);
    }
  }

  /**
   * Check if a contract is available on the current network
   * @param contractName Name of the contract
   * @returns True if the contract is available
   */
  isContractAvailable(contractNameOrHash: string): boolean {
    try {
      if (!contractNameOrHash || typeof contractNameOrHash !== 'string') {
        return false;
      }

      return Boolean(this.resolveContractTarget(contractNameOrHash).scriptHash);
    } catch (error) {
      logger.debug(`Error checking contract availability: ${contractNameOrHash}`, {
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
      const account = new neonJs.wallet.Account(wif);

      if (!script || typeof script !== 'string') {
        throw new ValidationError('Invalid script: must be a non-empty string');
      }

      if (!manifest || typeof manifest !== 'object') {
        throw new ValidationError('Invalid manifest: must be a non-empty object');
      }

      const scriptHex = /^[A-Za-z0-9+/=]+$/.test(script)
        ? Buffer.from(script, 'base64').toString('hex')
        : script.replace(/^0x/i, '');

      const nef = new neonJs.sc.NEF({ script: scriptHex });
      const contractManifest = neonJs.sc.ContractManifest.fromJson(manifest);
      const txid = await neonJs.experimental.deployContract(nef, contractManifest, {
        account,
        rpcAddress: this.rpcUrl,
        networkMagic: await this.getNetworkMagic(),
      });
      const contractHash = neonJs.experimental.getContractHash(
        neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(account.address), true),
        nef.checksum,
        contractManifest.name
      );

      logger.info('Deploying contract', {
        network: this.network,
        address: account.address,
        manifestName: contractManifest.name,
        contractHash,
      });

      return {
        txid,
        contractHash: `0x${contractHash}`,
        address: account.address,
        network: this.network,
      };
    } catch (error) {
      if (error instanceof ContractError) {
        throw error;
      }

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(`Failed to connect to Neo N3 node: ${error.message}`);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ContractError(`Failed to deploy contract: ${errorMessage}`);
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

  private async getNetworkMagic(): Promise<number> {
    if (this.networkMagic !== undefined) {
      return this.networkMagic;
    }

    const version = await this.rpcClient.execute(new neonJs.rpc.Query({ method: 'getversion', params: [] }));
    const networkMagic = version?.protocol?.network;
    if (!Number.isInteger(networkMagic)) {
      throw new Error('Failed to determine network magic from RPC getversion');
    }

    this.networkMagic = networkMagic;
    return networkMagic;
  }

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
