/**
 * Neo N3 contract discovery and invocation service.
 */
import * as neonJs from '@cityofzion/neon-js';
import { config } from '../config';
import { NEO_NETWORK_MAGIC, NeoNetwork, PreparedNeoTransaction } from '../services/neo-service';
import {
  FAMOUS_CONTRACTS,
  ContractDefinition,
  ContractNetwork
} from './contracts';
import { N3IndexClient, N3IndexResolvedContract } from './n3index-client';
import { normalizeScriptHash, tryGetAddressFromScriptHash, tryGetScriptHashFromAddress } from '../metadata/known-accounts';
import {
  validateScriptHash,
  validateContractName,
  validateContractOperation,
  validateAddress
} from '../utils/validation';
import { ContractError, NetworkError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { createRpcClient, isDefinitiveRpcRejection, isUnsupportedRpcMethodError, toRpcUrlList } from '../utils/rpc-client';
import { RpcDeadlineError, SubmissionOutcomeUnknownError, withRpcDeadline } from '../utils/rpc-deadline';
import { formatContractParameters } from '../utils/contract-params';
import type { NeonAccount, NeonContractManifestJson, NeonRpcClient } from '../types/neon';
import { parseGasAmountToDatos, prepareTransactionForSigning } from '../utils/transaction-preparation';
import { assertValidRpcUrl } from '../utils/rpc-url';

type ContractReferenceSource = 'known_name' | 'known_hash' | 'script_hash' | 'address' | 'manifest_name' | 'n3index_metadata' | 'n3index_contracts';

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

interface ContractServiceOptions {
  rpcTimeoutMs?: number;
  allowInsecureRpc?: boolean;
  maxTransactionFeeGas?: string;
}

export interface EncodedNef {
  encoding: 'base64' | 'hex';
  data: string;
}

export interface PreparedContractDeployment {
  transaction: PreparedNeoTransaction;
  contractHash: string;
  address: string;
  network: NeoNetwork;
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
 * Service for discovering and interacting with Neo N3 contracts.
 */
export class ContractService {
  private rpcClient: NeonRpcClient;
  private fetchRpcVersion!: () => Promise<unknown>;
  private network: NeoNetwork;

  private readonly rpcTimeoutMs: number;
  private networkMagic?: number;
  private networkMagicRequest?: Promise<number>;
  private readonly maxTransactionFeeDatos: bigint;
  private readonly discoveredContractsByName = new Map<string, string>();
  private readonly n3indexClient: N3IndexClient | null;
  private readonly remotelyResolvedContractsByName = new Map<string, N3IndexResolvedContract>();
  private readonly rpcUrls: readonly string[];

  /**
   * Create a new ContractService
   * @param rpcUrl One Neo N3 RPC URL, or an ordered list of URLs to fail over
   *   between. Reads advance to the next entry only when an endpoint does not
   *   answer; transaction submission never retries. See utils/rpc-client.ts.
   * @param network Network type (mainnet or testnet)
   * @throws NetworkError if RPC client initialization fails
   */
  constructor(
    rpcUrl: string | readonly string[],
    network: NeoNetwork = NeoNetwork.MAINNET,
    options: ContractServiceOptions = {}
  ) {
    const rpcUrls = toRpcUrlList(rpcUrl);
    if (rpcUrls.length === 0) {
      throw new NetworkError('RPC URL is required');
    }
    this.rpcUrls = rpcUrls;

    if (!Object.values(NeoNetwork).includes(network)) {
      throw new NetworkError(
        `Invalid network: ${network}. Must be one of: ${Object.values(NeoNetwork).join(', ')}`
      );
    }
    this.network = network;
    this.rpcTimeoutMs = options.rpcTimeoutMs ?? config.rpcTimeoutMs;
    if (!Number.isSafeInteger(this.rpcTimeoutMs) || this.rpcTimeoutMs <= 0) {
      throw new NetworkError(`Invalid RPC timeout: ${this.rpcTimeoutMs}. Must be a positive integer.`);
    }
    this.n3indexClient = config.n3index.enabled ? new N3IndexClient(config.n3index.baseUrl) : null;
    this.maxTransactionFeeDatos = parseGasAmountToDatos(
      options.maxTransactionFeeGas ?? config.maxTransactionFeeGas
    );

    try {
      // Every entry is validated, not just the first: an unusable URL in position
      // three would otherwise stay hidden until the seeds ahead of it go down.
      for (const url of rpcUrls) {
        assertValidRpcUrl(url, {
          allowInsecureRemote: options.allowInsecureRpc ?? config.allowInsecureRpc,
        });
      }
      this.rpcClient = createRpcClient(rpcUrls, this.rpcTimeoutMs);
      const executeRpc = this.rpcClient.execute.bind(this.rpcClient);
      this.fetchRpcVersion = () => executeRpc(
        new neonJs.rpc.Query({ method: 'getversion', params: [] })
      );

      logger.info(`ContractService initialized for ${network}`, { rpcUrls });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Neo RPC client`, { error: errorMessage, rpcUrls, network });
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
      source: metadata.source === 'contract_metadata_cache' ? 'n3index_metadata' : 'n3index_contracts',
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

      this.rememberRemoteContract(reference, remoteMetadata);

      return this.buildRemoteTarget(reference, remoteMetadata);
    }
  }

  private buildOperationSummary(target: ResolvedContractTarget, contractState?: Record<string, unknown>): ContractOperationSummary {
    if (target.knownContract) {
      return {
        operations: target.knownContract.operations,
        count: Object.keys(target.knownContract.operations).length,
        contractName: target.knownContract.name,
        network: this.network,
        available: true,
      };
    }

    const csManifest = contractState?.manifest as Record<string, unknown> | undefined;
    const csAbi = csManifest?.abi as Record<string, unknown> | undefined;
    const manifestMethods = Array.isArray(csAbi?.methods)
      ? (csAbi.methods as Record<string, unknown>[])
      : [];
    const operations = manifestMethods.reduce((accumulator: ContractOperationSummary['operations'], method: Record<string, unknown>) => {
      const methodName = typeof method?.name === 'string' ? method.name.trim() : '';
      if (!methodName) {
        return accumulator;
      }

      accumulator[methodName] = {
        name: methodName,
        description: 'Method discovered from on-chain contract manifest',
        args: Array.isArray(method.parameters)
          ? (method.parameters as Record<string, unknown>[]).map((parameter: Record<string, unknown>) => ({
              name: typeof parameter?.name === 'string' ? parameter.name : 'arg',
              type: typeof parameter?.type === 'string' ? parameter.type : 'Any',
              description: 'Manifest parameter'
            }))
          : undefined,
      };
      return accumulator;
    }, {});

    const csManifestName = typeof csManifest?.name === 'string' ? csManifest.name.trim() : '';
    return {
      operations,
      count: Object.keys(operations).length,
      contractName: csManifestName
        ? csManifestName
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
  async queryContract(contractReference: string, operation: string, args: unknown[] = []): Promise<Record<string, unknown>> {
    try {
      const formattedArgs = formatContractParameters(args);
      const target = await this.resolveContractTargetAsync(contractReference);
      await this.assertContractDeployed(contractReference);
      const validOperation = target.knownContract
        ? validateContractOperation(operation, Object.values(target.knownContract.operations).map((op) => op.name))
        : validateContractOperation(operation, []);

      // Log the query
      logger.info(`Querying contract ${contractReference}`, {
        operation: validOperation,
        args,
        network: this.network
      });

      let result: Record<string, unknown>;
      // Use invokefunction RPC method as per Neo N3 documentation
      try {
        // Execute the function through the RPC client
        result = await this.withRpcDeadline(
          () => this.rpcClient.execute(new neonJs.rpc.Query({ method: 'invokefunction', params: [target.scriptHash, validOperation, formattedArgs] }))
        ) as Record<string, unknown>;
      } catch (invokeError) {
        if (!isUnsupportedRpcMethodError(invokeError)) {
          throw invokeError;
        }
        logger.warn('invokefunction failed; falling back to invokeScript for read invocation', { contractReference, operation: validOperation, error: invokeError instanceof Error ? invokeError.message : String(invokeError) });

        // Fallback to invokeScript if invokefunction fails
        // Create a script to execute the operation
        const script = neonJs.sc.createScript({
          scriptHash: target.scriptHash,
          operation: validOperation,
          args: formattedArgs
        });

        // Execute the script through the RPC client
        result = await this.withRpcDeadline(
          () => this.rpcClient.invokeScript(neonJs.u.HexString.fromHex(script))
        ) as unknown as Record<string, unknown>;
      }

      // Check for execution errors
      if (!result || result.state !== 'HALT') {
        throw new ContractError(
          `Contract execution failed with VM state ${String(result?.state || 'missing')}: `
          + `${result?.exception || 'Unknown error'}`,
          { contractReference, operation: validOperation, args, scriptHash: target.scriptHash }
        );
      }

      return result;
    } catch (error) {
      // Preserve typed client errors for transport-level status mapping.
      if (error instanceof ContractError || error instanceof ValidationError) {
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
    fromAccount: NeonAccount,
    contractReference: string,
    operation: string,
    args: unknown[] = [],
    additionalScriptAttributes: unknown[] = []
  ): Promise<string> {
    try {
      const normalizedHash = normalizeScriptHash(contractReference);
      let addressHash: string | null = null;
      if (!normalizedHash) {
        try {
          validateAddress(contractReference);
          addressHash = tryGetScriptHashFromAddress(contractReference);
        } catch {
          addressHash = null;
        }
      }
      const explicitScriptHash = normalizedHash ?? addressHash;
      if (!explicitScriptHash) {
        throw new ValidationError(
          'Signed contract writes require an explicit script hash or Neo address; name-based resolution is read-only.'
        );
      }

      const target = this.resolveContractTarget(explicitScriptHash);
      await this.assertContractDeployed(explicitScriptHash);
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
        args,
        network: this.network,
        address: fromAccount.address
      });

      if (additionalScriptAttributes.length > 0) {
        throw new ValidationError('Additional transaction attributes are not supported for contract invocations');
      }

      const script = neonJs.sc.createScript({
        scriptHash: target.scriptHash,
        operation: validOperation,
        args: formatContractParameters(args),
      });
      return await this.signAndSubmitTransaction(
        fromAccount,
        neonJs.u.HexString.fromHex(script)
      );
    } catch (error) {
      if (error instanceof SubmissionOutcomeUnknownError) {
        throw error;
      }
      // Preserve typed client errors for transport-level status mapping.
      if (error instanceof ContractError || error instanceof ValidationError) {
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

  private async getContractState(scriptHash: string): Promise<Record<string, unknown>> {
    if (typeof this.rpcClient.getContractState === 'function') {
      return await this.withRpcDeadline(
        () => this.rpcClient.getContractState(scriptHash)
      ) as unknown as Record<string, unknown>;
    }

    return await this.withRpcDeadline(
      () => this.rpcClient.execute(
        new neonJs.rpc.Query({ method: 'getcontractstate', params: [scriptHash] })
      )
    ) as Record<string, unknown>;
  }

  async getContractStatus(contractReference: string): Promise<Record<string, unknown>> {
    const target = await this.resolveContractTargetAsync(contractReference);
    if (!target.remoteMetadata && this.n3indexClient) {
      try {
        const remoteMetadata = await this.n3indexClient.getContractByHash(this.network, target.scriptHash);
        if (remoteMetadata) {
          target.remoteMetadata = remoteMetadata;
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
      const csStatusManifest = contractState?.manifest as Record<string, unknown> | undefined;
      const csStatusManifestName = typeof csStatusManifest?.name === 'string' ? csStatusManifest.name.trim() : '';
      const manifestName = csStatusManifestName
        ? csStatusManifestName
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

  async getContractInfo(contractReference: string): Promise<Record<string, unknown>> {
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
    const networkKey = this.network === NeoNetwork.MAINNET
      ? ContractNetwork.MAINNET
      : ContractNetwork.TESTNET;

    return await Promise.all(Object.values(FAMOUS_CONTRACTS).map(async (contract) => {
      const scriptHash = contract.scriptHash[networkKey];
      let available = false;

      if (scriptHash) {
        try {
          await this.getContractState(scriptHash);
          available = true;
        } catch (error) {
          if (!isMissingContractStateError(error)) {
            logger.error('Failed to check supported contract availability', {
              contract: contract.name,
              error: error instanceof Error ? error.message : String(error),
              network: this.network,
            });
            throw error;
          }
        }
      }

      return {
        name: contract.name,
        description: contract.description,
        available,
        operationCount: Object.keys(contract.operations).length,
        network: this.network
      };
    }));
  }

  /**
   * Get details about a contract's operations
   * @param contractName Name of the contract
   * @returns Contract operations details
   * @throws ContractError if contract not found
   */
  getContractOperations(contractNameOrHash: string): ContractOperationSummary {
    try {
      const target = this.resolveContractTarget(contractNameOrHash);
      const operations = this.buildOperationSummary(target);

      return operations;
    } catch (error) {
      if (error instanceof ContractError || error instanceof ValidationError) {
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

  /**
   * Deploy a smart contract
   * @param account Configured signing account that will deploy the contract
   * @param encodedNef Complete serialized NEF artifact with an explicit encoding
   * @param manifest Contract manifest
   * @returns Transaction hash and contract hash
   * @throws ContractError if deployment fails
   */
  async deployContract(
    account: NeonAccount,
    encodedNef: EncodedNef,
    manifest: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const prepared = await this.prepareContractDeployment(account, encodedNef, manifest);
      const txid = await this.submitPreparedTransaction(prepared.transaction);

      logger.info('Deploying contract', {
        network: this.network,
        address: account.address,
        contractHash: prepared.contractHash,
      });

      return {
        txid,
        contractHash: prepared.contractHash,
        address: prepared.address,
        network: prepared.network,
      };
    } catch (error) {
      if (error instanceof SubmissionOutcomeUnknownError) {
        throw error;
      }
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

  async prepareContractDeployment(
    account: NeonAccount,
    encodedNef: EncodedNef,
    manifest: Record<string, unknown>
  ): Promise<PreparedContractDeployment> {
    const nef = this.parseEncodedNef(encodedNef);
    if (!account?.address) {
      throw new ValidationError('A configured signing account is required for deployment');
    }
    if (!manifest || typeof manifest !== 'object') {
      throw new ValidationError('Invalid manifest: must be a non-empty object');
    }

    const contractManifest = neonJs.sc.ContractManifest.fromJson(manifest as unknown as NeonContractManifestJson);
    const builder = new neonJs.sc.ScriptBuilder();
    builder.emitContractCall({
      scriptHash: neonJs.CONST.NATIVE_CONTRACT_HASH.ManagementContract,
      operation: 'deploy',
      callFlags: neonJs.sc.CallFlags.All,
      args: [
        neonJs.sc.ContractParam.byteArray(neonJs.u.HexString.fromHex(nef.serialize(), true)),
        neonJs.sc.ContractParam.string(JSON.stringify(contractManifest.toJson())),
      ],
    });
    const contractHash = neonJs.experimental.getContractHash(
      neonJs.u.HexString.fromHex(neonJs.wallet.getScriptHashFromAddress(account.address)),
      nef.checksum,
      contractManifest.name
    );
    return {
      transaction: await this.prepareSignedTransaction(
        account,
        neonJs.u.HexString.fromHex(builder.build())
      ),
      contractHash: `0x${contractHash}`,
      address: account.address,
      network: this.network,
    };
  }

  validateDeploymentArtifacts(
    encodedNef: EncodedNef,
    manifest: Record<string, unknown>,
  ): void {
    this.parseEncodedNef(encodedNef);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new ValidationError('Invalid manifest: must be a non-empty object');
    }
    neonJs.sc.ContractManifest.fromJson(manifest as unknown as NeonContractManifestJson);
  }

  /**
   * Get the current network
   * @returns Current network
   */

  private async getNetworkMagic(): Promise<number> {
    if (this.networkMagic !== undefined) {
      return this.networkMagic;
    }
    if (this.networkMagicRequest) {
      return await this.networkMagicRequest;
    }

    this.networkMagicRequest = withRpcDeadline(
      this.fetchRpcVersion,
      this.rpcTimeoutMs,
    ).then((versionRaw) => {
      const version = versionRaw as Record<string, unknown>;
      const versionProtocol = version?.protocol as Record<string, unknown> | undefined;
      const networkMagicRaw = versionProtocol?.network;
      if (!Number.isInteger(networkMagicRaw)) {
        throw new Error('Failed to determine network magic from RPC getversion');
      }
      const networkMagic = networkMagicRaw as number;
      const expectedNetworkMagic = NEO_NETWORK_MAGIC[this.network];
      if (networkMagic !== expectedNetworkMagic) {
        throw new NetworkError(
          `RPC network mismatch for ${this.network}: expected magic ${expectedNetworkMagic}, ` +
          `but endpoint reported ${networkMagic}`
        );
      }

      this.networkMagic = networkMagic;
      return networkMagic;
    }).finally(() => {
      this.networkMagicRequest = undefined;
    });
    return await this.networkMagicRequest;
  }

  private async prepareSignedTransaction(
    account: NeonAccount,
    script: ReturnType<typeof neonJs.u.HexString.fromHex>
  ): Promise<PreparedNeoTransaction> {
    const networkMagic = await this.getNetworkMagic();
    const transaction = new neonJs.tx.Transaction();
    transaction.script = script;
    transaction.addSigner({
      account: account.scriptHash || neonJs.wallet.getScriptHashFromAddress(account.address),
      scopes: neonJs.tx.WitnessScope.CalledByEntry,
    });
    await prepareTransactionForSigning(transaction, account, this.rpcClient, {
      maxTransactionFeeDatos: this.maxTransactionFeeDatos,
    });
    transaction.sign(account, networkMagic);

    const transactionHash = transaction.hash();
    const txid = transactionHash.startsWith('0x')
      ? transactionHash
      : `0x${transactionHash}`;
    return {
      rawTransaction: transaction.serialize(true),
      txid,
      validUntilBlock: transaction.validUntilBlock,
    };
  }

  async submitPreparedTransaction(prepared: PreparedNeoTransaction): Promise<string> {
    if (!/^[0-9a-fA-F]+$/.test(prepared.rawTransaction) || prepared.rawTransaction.length % 2 !== 0) {
      throw new ValidationError('Prepared transaction must contain even-length hexadecimal bytes');
    }
    try {
      const submittedTxid = await this.withRpcDeadline(
        () => this.rpcClient.sendRawTransaction(neonJs.u.HexString.fromHex(prepared.rawTransaction))
      );
      const normalizedSubmittedTxid = typeof submittedTxid === 'string'
        ? (submittedTxid.startsWith('0x') ? submittedTxid : `0x${submittedTxid}`).toLowerCase()
        : '';
      if (normalizedSubmittedTxid !== prepared.txid.toLowerCase()) {
        throw new SubmissionOutcomeUnknownError(prepared.txid, 'inconsistent_response');
      }
      return prepared.txid;
    } catch (error) {
      if (error instanceof SubmissionOutcomeUnknownError) {
        throw error;
      }
      if (error instanceof RpcDeadlineError) {
        throw new SubmissionOutcomeUnknownError(prepared.txid, this.rpcTimeoutMs);
      }
      if (isDefinitiveRpcRejection(error)) {
        throw error;
      }
      throw new SubmissionOutcomeUnknownError(prepared.txid, 'transport_error');
    }
  }

  private async signAndSubmitTransaction(
    account: NeonAccount,
    script: ReturnType<typeof neonJs.u.HexString.fromHex>
  ): Promise<string> {
    return await this.submitPreparedTransaction(await this.prepareSignedTransaction(account, script));
  }

  getNetwork(): NeoNetwork {
    return this.network;
  }

  /**
   * Get the RPC endpoints this service reads from, in failover order.
   * @returns The configured endpoints; index 0 is the one tried first.
   */
  getRpcUrls(): readonly string[] {
    return this.rpcUrls;
  }

  private async withRpcDeadline<T>(operation: () => Promise<T>): Promise<T> {
    await this.getNetworkMagic();
    return await withRpcDeadline(operation, this.rpcTimeoutMs);
  }

  private parseEncodedNef(encodedNef: EncodedNef): InstanceType<typeof neonJs.sc.NEF> {
    if (!encodedNef || typeof encodedNef !== 'object' || Array.isArray(encodedNef)) {
      throw new ValidationError('Invalid NEF: expected an encoded NEF object');
    }
    if (encodedNef.encoding !== 'hex' && encodedNef.encoding !== 'base64') {
      throw new ValidationError('Invalid NEF encoding: expected "hex" or "base64"');
    }
    if (typeof encodedNef.data !== 'string' || encodedNef.data.length === 0) {
      throw new ValidationError('Invalid NEF data: expected a non-empty string');
    }
    if (encodedNef.data.length > 2_000_000) {
      throw new ValidationError('Invalid NEF data: encoded artifact is too large');
    }

    let bytes: Buffer;
    if (encodedNef.encoding === 'hex') {
      if (encodedNef.data.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(encodedNef.data)) {
        throw new ValidationError('Invalid NEF data: expected an even-length hexadecimal string');
      }
      bytes = Buffer.from(encodedNef.data, 'hex');
    } else {
      const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
      if (!base64Pattern.test(encodedNef.data)) {
        throw new ValidationError('Invalid NEF data: expected canonical base64');
      }
      bytes = Buffer.from(encodedNef.data, 'base64');
      if (bytes.length === 0 || bytes.toString('base64') !== encodedNef.data) {
        throw new ValidationError('Invalid NEF data: expected canonical base64');
      }
    }

    try {
      const nef = neonJs.sc.NEF.fromBuffer(bytes);
      if (nef.serialize().toLowerCase() !== bytes.toString('hex').toLowerCase()) {
        throw new Error('serialized NEF contains trailing or noncanonical bytes');
      }
      return nef;
    } catch (error) {
      throw new ValidationError(
        `Invalid serialized NEF: ${error instanceof Error ? error.message : 'unable to decode artifact'}`
      );
    }
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
    args: unknown[] = []
  ): Promise<Record<string, unknown>> {
    try {
      // Use the queryContract method to execute the read-only operation
      return await this.queryContract(contractName, operation, args);
    } catch (error) {
      if (error instanceof SubmissionOutcomeUnknownError) {
        throw error;
      }
      // Preserve typed client errors for transport-level status mapping.
      if (error instanceof ContractError || error instanceof ValidationError) {
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
    fromAccount: NeonAccount,
    contractName: string,
    operation: string,
    args: unknown[] = [],
    additionalScriptAttributes: unknown[] = []
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
      if (error instanceof SubmissionOutcomeUnknownError) {
        throw error;
      }
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
