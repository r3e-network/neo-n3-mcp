// src/handlers/tool-handler.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NeoService, NeoNetwork } from '../services/neo-service';
import { ContractService } from '../contracts/contract-service';
import { WalletService } from '../services/wallet-service';
import { FAMOUS_CONTRACTS } from '../contracts/contracts';
import { config, NetworkMode } from '../config';
import { validateAddress, validateHash, validateAmount, validatePassword, validateScriptHash, validateNetwork, validateContractName, validateInteger } from '../utils/validation';
import { handleError, createSuccessResponse } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';
import * as neonJs from '@cityofzion/neon-js'; // Needed for Account creation

// --- Individual Tool Handlers ---

async function handleGetNetworkMode(): Promise<Record<string, unknown>> {
  const availableNetworks = [];

  if (config.networkMode === NetworkMode.MAINNET_ONLY || config.networkMode === NetworkMode.BOTH) {
    availableNetworks.push(NeoNetwork.MAINNET);
  }

  if (config.networkMode === NetworkMode.TESTNET_ONLY || config.networkMode === NetworkMode.BOTH) {
    availableNetworks.push(NeoNetwork.TESTNET);
  }

  const defaultNetwork = config.networkMode === NetworkMode.TESTNET_ONLY
    ? NeoNetwork.TESTNET
    : NeoNetwork.MAINNET;

  return createSuccessResponse({
    networkMode: config.networkMode,
    mode: config.networkMode,
    availableNetworks,
    defaultNetwork
  });
}

async function handleSetNetworkMode(input: Record<string, unknown>): Promise<unknown> {
  const normalizedMode = typeof input?.mode === 'string' ? input.mode.toLowerCase().trim() : '';

  let newMode: NetworkMode;
  switch (normalizedMode) {
    case 'mainnet':
    case NetworkMode.MAINNET_ONLY:
      newMode = NetworkMode.MAINNET_ONLY;
      break;
    case 'testnet':
    case NetworkMode.TESTNET_ONLY:
      newMode = NetworkMode.TESTNET_ONLY;
      break;
    case NetworkMode.BOTH:
      newMode = NetworkMode.BOTH;
      break;
    default:
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid network mode: ${input?.mode}. Must be one of: ${NetworkMode.MAINNET_ONLY}, ${NetworkMode.TESTNET_ONLY}, ${NetworkMode.BOTH}`
      );
  }

  config.networkMode = newMode;

  const availableNetworks = [];
  if (newMode === NetworkMode.MAINNET_ONLY || newMode === NetworkMode.BOTH) {
    availableNetworks.push(NeoNetwork.MAINNET);
  }
  if (newMode === NetworkMode.TESTNET_ONLY || newMode === NetworkMode.BOTH) {
    availableNetworks.push(NeoNetwork.TESTNET);
  }

  logger.warn('Network mode change requested; restart may be required for full effect', { networkMode: newMode });
  return createSuccessResponse({
    message: `Network mode set to ${newMode}. Restart may be required for resource listings to refresh.`,
    networkMode: newMode,
    mode: newMode,
    availableNetworks,
    defaultNetwork: newMode === NetworkMode.TESTNET_ONLY ? NeoNetwork.TESTNET : NeoNetwork.MAINNET,
    restartRequired: true
  });
}

async function handleGetBlockchainInfo(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    const info = await neoService.getBlockchainInfo();
    return createSuccessResponse(info);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBlockCount(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    const count = await neoService.getBlockCount();
    return createSuccessResponse({ blockCount: count });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBlock(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    if (typeof input.hashOrHeight === 'string') {
      validateHash(input.hashOrHeight);
    } else if (typeof input.hashOrHeight === 'number') {
      // It's a block height, could validate integer if needed
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'hashOrHeight must be a string or number');
    }
    const block = await neoService.getBlock(input.hashOrHeight);
    return createSuccessResponse(block);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetTransaction(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateHash(input.txid as string);
    const tx = await neoService.getTransaction(input.txid as string);
    return createSuccessResponse(tx);
  } catch (error) {
    return handleError(error);
  }
}


async function handleGetApplicationLog(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateHash(input.txid as string);
    const applicationLog = await neoService.getApplicationLog(input.txid as string);
    return createSuccessResponse(applicationLog);
  } catch (error) {
    return handleError(error);
  }
}

async function handleWaitForTransaction(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateHash(input.txid as string);
    const timeoutMs = input.timeoutMs !== undefined ? validateInteger(input.timeoutMs as string | number) : 30000;
    const pollIntervalMs = input.pollIntervalMs !== undefined ? validateInteger(input.pollIntervalMs as string | number) : 1000;

    if (timeoutMs <= 0) {
      throw new McpError(ErrorCode.InvalidParams, 'timeoutMs must be greater than zero.');
    }

    if (pollIntervalMs <= 0) {
      throw new McpError(ErrorCode.InvalidParams, 'pollIntervalMs must be greater than zero.');
    }

    const result = await neoService.waitForTransaction(input.txid as string, {
      timeoutMs,
      pollIntervalMs,
      includeApplicationLog: Boolean(input.includeApplicationLog),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetUnclaimedGas(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    const result = await neoService.getUnclaimedGas(input.address as string);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetNep17Transfers(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    const fromTimestampMs = input.fromTimestampMs !== undefined ? validateInteger(input.fromTimestampMs as string | number) : undefined;
    const toTimestampMs = input.toTimestampMs !== undefined ? validateInteger(input.toTimestampMs as string | number) : undefined;

    if (fromTimestampMs !== undefined && toTimestampMs !== undefined && fromTimestampMs > toTimestampMs) {
      throw new McpError(ErrorCode.InvalidParams, 'fromTimestampMs must be less than or equal to toTimestampMs.');
    }

    const result = await neoService.getNep17Transfers(input.address as string, {
      ...(fromTimestampMs !== undefined ? { fromTimestampMs } : {}),
      ...(toTimestampMs !== undefined ? { toTimestampMs } : {}),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetNep11Balances(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    const result = await neoService.getNep11Balances(input.address as string);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetNep11Transfers(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    const fromTimestampMs = input.fromTimestampMs !== undefined ? validateInteger(input.fromTimestampMs as string | number) : undefined;
    const toTimestampMs = input.toTimestampMs !== undefined ? validateInteger(input.toTimestampMs as string | number) : undefined;

    if (fromTimestampMs !== undefined && toTimestampMs !== undefined && fromTimestampMs > toTimestampMs) {
      throw new McpError(ErrorCode.InvalidParams, 'fromTimestampMs must be less than or equal to toTimestampMs.');
    }

    const result = await neoService.getNep11Transfers(input.address as string, {
      ...(fromTimestampMs !== undefined ? { fromTimestampMs } : {}),
      ...(toTimestampMs !== undefined ? { toTimestampMs } : {}),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBalance(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    const balance = await neoService.getBalance(input.address as string); 
    return createSuccessResponse({ ...balance });
  } catch (error) {
    return handleError(error);
  }
}

async function handleTransferAssets(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Transfer requires explicit confirmation. Set confirm=true.');
    }
    validateAddress(input.toAddress as string);
    validateAmount(input.amount as string | number);
    // Basic WIF validation
    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    const txid = await neoService.transferAssets(account, input.toAddress as string, input.asset as string, input.amount as string | number);
    return createSuccessResponse({ txid });
  } catch (error) {
    return handleError(error);
  }
}


function resolveContractReference(input: Record<string, unknown>): string {
  const reference = input?.contract ?? input?.contractReference ?? input?.contractName ?? input?.nameOrHash;
  if (typeof reference === 'string' && reference.trim()) {
    return reference.trim();
  }

  throw new McpError(
    ErrorCode.InvalidParams,
    'Either scriptHash or a contract reference must be provided.'
  );
}

async function resolveInvocationScriptHash(input: Record<string, unknown>, contractService: ContractService): Promise<string> {
  if (typeof input?.scriptHash === 'string' && input.scriptHash.trim()) {
    return validateScriptHash(input.scriptHash);
  }

  return await contractService.resolveContractScriptHash(resolveContractReference(input));
}

async function handleInvokeReadContract(input: Record<string, unknown>, neoService: NeoService, contractService: ContractService): Promise<unknown> {
  try {
    const namedContractReference = !input?.scriptHash && (() => {
      try {
        return resolveContractReference(input);
      } catch {
        return undefined;
      }
    })();

    if (namedContractReference) {
      await contractService.assertContractDeployed(namedContractReference);
    }

    const result = namedContractReference
      ? await contractService.invokeReadContract(namedContractReference, input.operation as string, (input.args as unknown[]) || [])
      : await neoService.invokeReadContract(await resolveInvocationScriptHash(input, contractService), input.operation as string, (input.args as unknown[]) || []);

    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleInvokeWriteContract(input: Record<string, unknown>, neoService: NeoService, contractService: ContractService): Promise<unknown> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Contract invocation requires explicit confirmation. Set confirm=true.');
    }

    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }

    const namedContractReference = !input?.scriptHash && (() => {
      try {
        return resolveContractReference(input);
      } catch {
        return undefined;
      }
    })();
    if (namedContractReference) {
      await contractService.assertContractDeployed(namedContractReference);
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    const result = namedContractReference
      ? await contractService.invokeWriteContract(account, namedContractReference, input.operation as string, (input.args as unknown[]) || [])
      : await neoService.invokeContract(account, await resolveInvocationScriptHash(input, contractService), input.operation as string, (input.args as unknown[]) || []);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateWallet(input: Record<string, unknown>, walletService?: WalletService): Promise<unknown> {
  try {
    validatePassword(input.password as string);

    if (walletService) {
      const wallet = await walletService.createWallet(input.password as string);
      return createSuccessResponse({
        ...wallet,
        encryptedWIF: wallet.encryptedPrivateKey,
      });
    }

    const account = new neonJs.wallet.Account();
    const encryptedWIF = await neonJs.wallet.encrypt(account.WIF, input.password as string);
    return createSuccessResponse({
      address: account.address,
      publicKey: account.publicKey,
      encryptedPrivateKey: encryptedWIF,
      encryptedWIF,
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleImportWallet(input: Record<string, unknown>, walletService?: WalletService): Promise<unknown> {
  try {
    const key = input?.key ?? input?.privateKeyOrWIF;
    if (typeof key !== 'string' || !(neonJs.wallet.isWIF(key) || neonJs.wallet.isPrivateKey(key))) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid private key or WIF format.');
    }

    if (walletService) {
      const wallet = await walletService.importWallet(key, input.password as string | undefined);
      if ('encryptedPrivateKey' in wallet) {
        return createSuccessResponse({
          ...wallet,
          encryptedWIF: wallet.encryptedPrivateKey,
        });
      }
      return createSuccessResponse(wallet);
    }

    let account = new neonJs.wallet.Account(key);
    if (input.password) {
      validatePassword(input.password as string);
      const encryptedWIF = await neonJs.wallet.encrypt(account.WIF, input.password as string);
      return createSuccessResponse({
        address: account.address,
        publicKey: account.publicKey,
        encryptedPrivateKey: encryptedWIF,
        encryptedWIF,
      });
    }

    return createSuccessResponse({ address: account.address, publicKey: account.publicKey });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetWallet(input: Record<string, unknown>, walletService?: WalletService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    if (!walletService) {
      throw new McpError(ErrorCode.InternalError, 'Wallet service is not available.');
    }
    const wallet = await walletService.getWallet(input.address as string);
    const { encryptedPrivateKey, ...sanitizedWallet } = wallet;
    return createSuccessResponse(sanitizedWallet);
  } catch (error) {
    return handleError(error);
  }
}

async function handleEstimateTransferFees(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.fromAddress as string);
    validateAddress(input.toAddress as string);
    validateAmount(input.amount as string | number);
    const fees = await neoService.calculateTransferFee(input.fromAddress as string, input.toAddress as string, input.asset as string, input.amount as string | number); 
    return createSuccessResponse(fees);
  } catch (error) {
    return handleError(error);
  }
}

async function handleEstimateInvokeFees(input: Record<string, unknown>, neoService: NeoService, contractService: ContractService): Promise<unknown> {
  try {
    if (!input.signerAddress) {
      throw new McpError(ErrorCode.InvalidParams, 'Signer address is required to estimate invocation fees.');
    }

    const namedContractReference = !input?.scriptHash && (() => {
      try {
        return resolveContractReference(input);
      } catch {
        return undefined;
      }
    })();

    if (namedContractReference) {
      await contractService.assertContractDeployed(namedContractReference);
    }

    const scriptHash = await resolveInvocationScriptHash(input, contractService);
    validateAddress(input.signerAddress as string);
    const fees = await neoService.calculateInvokeFee(input.signerAddress as string, scriptHash, input.operation as string, (input.args as unknown[]) || []);
    return createSuccessResponse(fees);
  } catch (error) {
    return handleError(error);
  }
}

async function handleClaimGas(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'GAS claim requires explicit confirmation. Set confirm=true.');
    }
    if (!input.fromWIF || typeof input.fromWIF !== 'string' || !neonJs.wallet.isWIF(input.fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }
    const account = new neonJs.wallet.Account(input.fromWIF);
    const txid = await neoService.claimGas(account);
    return createSuccessResponse({ txid });
  } catch (error) {
    return handleError(error);
  }
}


async function handleDeployContract(input: Record<string, unknown>, contractService: ContractService): Promise<unknown> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Contract deployment requires explicit confirmation. Set confirm=true.');
    }

    const fromWIF = input.fromWIF ?? input.wif;
    if (!fromWIF || typeof fromWIF !== 'string' || !neonJs.wallet.isWIF(fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid deployer WIF provided.');
    }

    if (!input.script || typeof input.script !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Contract script must be a non-empty string.');
    }

    if (!input.manifest || typeof input.manifest !== 'object' || Array.isArray(input.manifest)) {
      throw new McpError(ErrorCode.InvalidParams, 'Contract manifest must be an object.');
    }

    const result = await contractService.deployContract(fromWIF, input.script as string, input.manifest as Record<string, unknown>);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleListFamousContracts(input: Record<string, unknown>, contractService: ContractService): Promise<unknown> {
  try {
    const contracts = await contractService.listSupportedContracts();
    const availableContracts = contracts.filter(contract => contract.available);
    return {
      contracts: availableContracts,
      network: contractService.getNetwork()
    };
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetContractInfo(input: Record<string, unknown>, contractService: ContractService): Promise<unknown> {
  try {
    const contractReference = resolveContractReference(input);
    return await contractService.getContractInfo(contractReference);
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetContractStatus(input: Record<string, unknown>, contractService: ContractService): Promise<unknown> {
  try {
    const contractReference = resolveContractReference(input);
    return createSuccessResponse(await contractService.getContractStatus(contractReference));
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateContainer(input: Record<string, unknown>, neoService: NeoService, contractService: ContractService): Promise<unknown> {
  try {
    if (!input.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'NeoFS container creation requires explicit confirmation. Set confirm=true.');
    }

    const fromWIF = input?.fromWIF ?? input?.wif;
    if (!fromWIF || typeof fromWIF !== 'string' || !neonJs.wallet.isWIF(fromWIF)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid sender WIF provided.');
    }

    if (!input.ownerId || typeof input.ownerId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'ownerId is required.');
    }

    const fromAccount = new neonJs.wallet.Account(fromWIF);
    const txid = await contractService.createNeoFSContainer(fromAccount, input.ownerId, (input.rules as unknown[]) || []);
    return createSuccessResponse({ txid });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetContainers(input: Record<string, unknown>, neoService: NeoService, contractService: ContractService): Promise<unknown> {
  try {
    validateAddress(input.ownerAddress as string);
    const containers = await contractService.getNeoFSContainers(input.ownerAddress as string);
    return createSuccessResponse({ containers });
  } catch (error) {
    return handleError(error);
  }
}

// --- Tool Setup Function ---

export async function callTool(name: string, input: Record<string, unknown>, neoServices: Map<NeoNetwork, NeoService>, contractServices: Map<NeoNetwork, ContractService>, walletService?: WalletService): Promise<Record<string, unknown>> {
  rateLimiter.checkLimit('mcp-client');
  switch (name) {
    case 'get_network_mode':
      return await handleGetNetworkMode();
    case 'set_network_mode':
      return await handleSetNetworkMode(input) as Record<string, unknown>;
    case 'create_wallet':
      return await handleCreateWallet(input, walletService) as Record<string, unknown>;
    case 'import_wallet':
      return await handleImportWallet(input, walletService) as Record<string, unknown>;
    case 'get_wallet':
      return await handleGetWallet(input, walletService) as Record<string, unknown>;
  }

  if (!input || typeof input !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid input parameters. Expected an object.');
  }

  let neoService: NeoService | undefined;
  let contractService: ContractService | undefined;

  try {
    const requestedNetwork = typeof input.network === 'string' && input.network.trim().length > 0
      ? validateNetwork(input.network as string)
      : undefined;

    if (requestedNetwork) {
      neoService = neoServices.get(requestedNetwork);
      contractService = contractServices.get(requestedNetwork);
    } else if (neoServices.size === 1 && contractServices.size === 1) {
      neoService = neoServices.values().next().value;
      contractService = contractServices.values().next().value;
    } else {
      neoService = neoServices.get(NeoNetwork.MAINNET) || neoServices.get(NeoNetwork.TESTNET);
      contractService = contractServices.get(NeoNetwork.MAINNET) || contractServices.get(NeoNetwork.TESTNET);
    }

    if (!neoService || !contractService) {
      throw new McpError(ErrorCode.InvalidParams, 'Requested network is not enabled or service unavailable.');
    }
  } catch (error) {
    return handleError(error);
  }

  try {
    switch (name) {
      case 'get_blockchain_info':
        return await handleGetBlockchainInfo(input, neoService) as Record<string, unknown>;
      case 'get_block_count':
        return await handleGetBlockCount(input, neoService) as Record<string, unknown>;
      case 'get_block':
        return await handleGetBlock(input, neoService) as Record<string, unknown>;
      case 'get_transaction':
        return await handleGetTransaction(input, neoService) as Record<string, unknown>;
      case 'get_application_log':
        return await handleGetApplicationLog(input, neoService) as Record<string, unknown>;
      case 'wait_for_transaction':
        return await handleWaitForTransaction(input, neoService) as Record<string, unknown>;
      case 'get_balance':
        return await handleGetBalance(input, neoService) as Record<string, unknown>;
      case 'get_unclaimed_gas':
        return await handleGetUnclaimedGas(input, neoService) as Record<string, unknown>;
      case 'get_nep17_transfers':
        return await handleGetNep17Transfers(input, neoService) as Record<string, unknown>;
      case 'get_nep11_balances':
        return await handleGetNep11Balances(input, neoService) as Record<string, unknown>;
      case 'get_nep11_transfers':
        return await handleGetNep11Transfers(input, neoService) as Record<string, unknown>;
      case 'transfer_assets':
        return await handleTransferAssets(input, neoService) as Record<string, unknown>;
      case 'invoke_contract':
        if (input.fromWIF) {
          return await handleInvokeWriteContract(input, neoService, contractService) as Record<string, unknown>;
        }
        return await handleInvokeReadContract(input, neoService, contractService) as Record<string, unknown>;
      case 'estimate_transfer_fees':
        return await handleEstimateTransferFees(input, neoService) as Record<string, unknown>;
      case 'estimate_invoke_fees':
        return await handleEstimateInvokeFees(input, neoService, contractService) as Record<string, unknown>;
      case 'claim_gas':
        return await handleClaimGas(input, neoService) as Record<string, unknown>;
      case 'deploy_contract':
        return await handleDeployContract(input, contractService) as Record<string, unknown>;
      case 'list_famous_contracts':
        return await handleListFamousContracts(input, contractService) as Record<string, unknown>;
      case 'get_contract_info':
        return await handleGetContractInfo(input, contractService) as Record<string, unknown>;
      case 'get_contract_status':
        return await handleGetContractStatus(input, contractService) as Record<string, unknown>;
      case 'neofs_create_container':
        return await handleCreateContainer(input, neoService, contractService) as Record<string, unknown>;
      case 'neofs_get_containers':
        return await handleGetContainers(input, neoService, contractService) as Record<string, unknown>;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found or requires network parameter.`);
    }
  } catch (error) {
    return handleError(error);
  }
}

// --- Tool Setup Function ---

export function setupToolHandlers(
  server: Server,
  neoServices: Map<NeoNetwork, NeoService>,
  contractServices: Map<NeoNetwork, ContractService>,
  walletService?: WalletService
) {
  const tools = [
      {
        name: 'get_network_mode',
        description: 'Get the currently configured network mode (mainnet_only, testnet_only, both)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'set_network_mode',
        description: 'Set the network mode (mainnet_only, testnet_only, both). Requires restart.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              description: 'Network mode to set',
              enum: [NetworkMode.MAINNET_ONLY, NetworkMode.TESTNET_ONLY, NetworkMode.BOTH],
            },
          },
          required: ['mode'],
        },
      },
      {
        name: 'get_blockchain_info',
        description: 'Get essential blockchain information (block height, version)',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_block_count',
        description: 'Get the current block height of the Neo N3 blockchain',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_block',
        description: 'Get block details by height or hash',
        inputSchema: {
          type: 'object',
          properties: {
            hashOrHeight: {
              oneOf: [
                { type: 'string', description: 'Block hash (hex string)' },
                { type: 'number', description: 'Block height (integer)' },
              ],
              description: 'Block hash or height',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['hashOrHeight'],
        },
      },
      {
        name: 'get_transaction',
        description: 'Get transaction details by hash',
        inputSchema: {
          type: 'object',
          properties: {
            txid: {
              type: 'string',
              description: 'Transaction hash (hex string)',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['txid'],
        },
      },
      {
        name: 'get_application_log',
        description: 'Get the application log for a confirmed transaction',
        inputSchema: {
          type: 'object',
          properties: {
            txid: {
              type: 'string',
              description: 'Transaction hash (hex string)',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['txid'],
        },
      },
      {
        name: 'wait_for_transaction',
        description: 'Poll until a transaction is confirmed or a timeout is reached',
        inputSchema: {
          type: 'object',
          properties: {
            txid: {
              type: 'string',
              description: 'Transaction hash (hex string)',
            },
            timeoutMs: {
              type: 'number',
              description: 'Optional timeout in milliseconds',
            },
            pollIntervalMs: {
              type: 'number',
              description: 'Optional polling interval in milliseconds',
            },
            includeApplicationLog: {
              type: 'boolean',
              description: 'Include application log once confirmed',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['txid'],
        },
      },
      {
        name: 'get_balance',
        description: 'Get native (NEO/GAS) and NEP-17 token balances for an address',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'transfer_assets',
        description: 'Transfer NEP-17 assets between addresses. Requires sender WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'WIF of the sender account',
            },
            toAddress: {
              type: 'string',
              description: 'Recipient address',
            },
            asset: {
              type: 'string',
              description: 'Asset script hash (hex string, e.g., GAS hash)',
            },
            amount: {
              oneOf: [
                { type: 'string', description: 'Amount as string' },
                { type: 'number', description: 'Amount as number' },
              ],
              description: 'Amount to transfer (in smallest unit, e.g., drops for GAS)',
            },
            confirm: {
              type: 'boolean',
              description: 'Set to true to confirm the transfer operation',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromWIF', 'toAddress', 'asset', 'amount', 'confirm'],
        },
      },
      {
        name: 'invoke_contract',
        description: 'Prepare invocation details for a smart contract method. Accepts either a scriptHash or a generic contract reference such as a known name, script hash, or Neo address. If fromWIF is provided, prepares a write transaction; otherwise, performs a read-only query.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'Optional: WIF of the account to sign the transaction (for write operations)',
            },
            contract: {
              type: 'string',
              description: 'Generic contract reference: known name, script hash, or Neo address',
            },
            scriptHash: {
              type: 'string',
              description: 'Contract script hash (hex string)',
            },
            contractName: {
              type: 'string',
              description: 'Supported contract name',
            },
            operation: {
              type: 'string',
              description: 'Method name to invoke',
            },
            args: {
              type: 'array',
              description: 'Optional: Method arguments (array of values or SDK Signer/ContractParam objects)',
              default: [],
            },
            confirm: {
              type: 'boolean',
              description: 'Required for write operations (when fromWIF is provided). Set to true to confirm.',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'create_wallet',
        description: 'Create a new Neo N3 wallet (address and encrypted WIF)',
        inputSchema: {
          type: 'object',
          properties: {
            password: {
              type: 'string',
              description: 'Password to encrypt the wallet WIF',
            },
          },
          required: ['password'],
        },
      },
      {
        name: 'import_wallet',
        description: 'Import a Neo N3 wallet from private key or WIF. Returns address and optionally encrypted WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Private key (hex) or WIF string',
            },
            privateKeyOrWIF: {
              type: 'string',
              description: 'Backward-compatible alias for key',
            },
            password: {
              type: 'string',
              description: 'Optional: Password to encrypt the imported wallet WIF',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_wallet',
        description: 'Get sanitized metadata for a stored wallet by address.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'estimate_transfer_fees',
        description: 'Estimate network and system fees for a transfer transaction',
        inputSchema: {
          type: 'object',
          properties: {
            fromAddress: {
              type: 'string',
              description: 'Sender address',
            },
            toAddress: {
              type: 'string',
              description: 'Recipient address',
            },
            asset: {
              type: 'string',
              description: 'Asset script hash (hex string)',
            },
            amount: {
              oneOf: [
                { type: 'string', description: 'Amount as string' },
                { type: 'number', description: 'Amount as number' },
              ],
              description: 'Amount to transfer (in smallest unit)',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromAddress', 'toAddress', 'asset', 'amount'],
        },
      },
      {
        name: 'estimate_invoke_fees',
        description: 'Estimate network and system fees for a contract invocation by script hash or a generic contract reference',
        inputSchema: {
          type: 'object',
          properties: {
            signerAddress: {
              type: 'string',
              description: 'Address of the account that will sign the transaction',
            },
            contract: {
              type: 'string',
              description: 'Generic contract reference: known name, script hash, or Neo address',
            },
            scriptHash: {
              type: 'string',
              description: 'Contract script hash (hex string)',
            },
            contractName: {
              type: 'string',
              description: 'Supported contract name',
            },
            operation: {
              type: 'string',
              description: 'Method name to invoke',
            },
            args: {
              type: 'array',
              description: 'Optional: Method arguments',
              default: [],
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['signerAddress', 'operation'],
        },
      },
      {
        name: 'claim_gas',
        description: 'Claim available GAS for an account. Requires account WIF.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'WIF of the account to claim GAS for',
            },
            confirm: {
              type: 'boolean',
              description: 'Set to true to confirm the GAS claim operation',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromWIF', 'confirm'],
        },
      },
      {
        name: 'get_unclaimed_gas',
        description: 'Get the currently unclaimed GAS amount for an address',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'get_nep17_transfers',
        description: 'Get NEP-17 transfer history for an address with additive known-account enrichment when available',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            fromTimestampMs: {
              type: 'integer',
              description: 'Optional start of the transfer history window, in Unix epoch milliseconds.',
            },
            toTimestampMs: {
              type: 'integer',
              description: 'Optional end of the transfer history window, in Unix epoch milliseconds.',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'get_nep11_balances',
        description: 'Get NEP-11 balances for an address with additive asset enrichment when available',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'get_nep11_transfers',
        description: 'Get NEP-11 transfer history for an address with additive asset and party enrichment when available',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Neo N3 address',
            },
            fromTimestampMs: {
              type: 'integer',
              description: 'Optional start of the transfer history window, in Unix epoch milliseconds.',
            },
            toTimestampMs: {
              type: 'integer',
              description: 'Optional end of the transfer history window, in Unix epoch milliseconds.',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'deploy_contract',
        description: 'Deploy a smart contract from a NEF script and manifest. Requires deployer WIF and explicit confirmation.',
        inputSchema: {
          type: 'object',
          properties: {
            fromWIF: {
              type: 'string',
              description: 'WIF of the deploying account',
            },
            script: {
              type: 'string',
              description: 'Contract NEF script as base64 or hex string',
            },
            manifest: {
              type: 'object',
              description: 'Contract manifest JSON object',
            },
            confirm: {
              type: 'boolean',
              description: 'Set to true to confirm deployment',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: ['fromWIF', 'script', 'manifest', 'confirm'],
        },
      },
      {
        name: 'list_famous_contracts',
        description: 'List known famous contracts with their names and script hashes for the active network(s)',
        inputSchema: {
          type: 'object',
          properties: {
             network: {
              type: 'string',
              description: 'Optional: Filter by network ("mainnet" or "testnet"). Defaults to showing contracts for all configured networks.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_contract_info',
        description: 'Get details about a contract by known name, script hash, or Neo address',
        inputSchema: {
          type: 'object',
          properties: {
            contract: {
              type: 'string',
              description: 'Generic contract reference: known name, script hash, or Neo address',
            },
            contractName: {
              type: 'string',
              description: 'Supported contract name',
            },
            nameOrHash: {
              type: 'string',
              description: 'Name (e.g., "flamingo") or script hash (hex string) of the famous contract',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      {
        name: 'get_contract_status',
        description: 'Check whether a contract is deployed and inspect its current on-chain status by known name, script hash, or Neo address',
        inputSchema: {
          type: 'object',
          properties: {
            contract: {
              type: 'string',
              description: 'Generic contract reference: known name, script hash, or Neo address',
            },
            contractName: {
              type: 'string',
              description: 'Supported contract name',
            },
            nameOrHash: {
              type: 'string',
              description: 'Backward-compatible alias for contract name or script hash',
            },
            network: {
              type: 'string',
              description: 'Optional: Network to use ("mainnet" or "testnet"). Defaults based on config.',
              enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET],
            },
          },
          required: [],
        },
      },
      // Add specific contract interaction tools (as examples)
      // --- NeoFS --- (Assuming ContractService handles NeoFS interactions via its methods)
      {
        name: 'neofs_create_container',
        description: '[NeoFS] Create a new storage container (requires WIF)',
        inputSchema: {
          type: 'object',
          properties: {
             fromWIF: { type: 'string', description: 'WIF of the container owner' },
             ownerId: { type: 'string', description: 'Owner ID' },
             rules: { type: 'object', description: 'Container rules definition (complex object)' }, // Needs specific schema
             confirm: { type: 'boolean', description: 'Confirm operation' },
             network: { type: 'string', enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET], description: 'Optional: Network' },
          },
           required: ['fromWIF', 'ownerId', 'rules', 'confirm'],
        },
      },
      {
          name: 'neofs_get_containers',
          description: '[NeoFS] List containers owned by an address',
          inputSchema: {
              type: 'object',
              properties: {
                  ownerAddress: { type: 'string', description: 'Address of the owner' },
                  network: { type: 'string', enum: [NeoNetwork.MAINNET, NeoNetwork.TESTNET], description: 'Optional: Network' },
              },
              required: ['ownerAddress'],
          },
      },
      // --- Add other contract-specific tools similarly ---
  ];

  // Register ListTools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  }));

  // Register CallTool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: input = {} } = request.params;
    return await callTool(name, input, neoServices, contractServices, walletService) as CallToolResult;
  });

  logger.debug('Tool handlers setup complete.');
}
