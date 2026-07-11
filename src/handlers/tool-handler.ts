// src/handlers/tool-handler.ts
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  MAX_TRANSACTION_WAIT_TIMEOUT_MS,
  MIN_TRANSACTION_POLL_INTERVAL_MS,
  NeoService,
  NeoNetwork,
} from '../services/neo-service';
import { ContractService } from '../contracts/contract-service';
import { sanitizeWalletMetadata, WalletService } from '../services/wallet-service';
import { config, NetworkMode } from '../config';
import { validateAddress, validateHash, validateScriptHash, validateNetwork, validateInteger, validateTokenAmount } from '../utils/validation';
import { handleError, createSuccessResponse } from '../utils/error-handler';
import { rateLimiter } from '../utils/rate-limiter';

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
    return createSuccessResponse({
      blockCount: count,
      height: Math.max(0, count - 1),
      network: neoService.getNetwork(),
    });
  } catch (error) {
    return handleError(error);
  }
}

async function handleGetBlock(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    let blockReference: string | number;
    if (typeof input.hashOrHeight === 'string') {
      blockReference = validateHash(input.hashOrHeight);
    } else if (typeof input.hashOrHeight === 'number') {
      blockReference = validateInteger(input.hashOrHeight);
    } else {
      throw new McpError(ErrorCode.InvalidParams, 'hashOrHeight must be a string or number');
    }
    const block = await neoService.getBlock(blockReference);
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
    if (timeoutMs > MAX_TRANSACTION_WAIT_TIMEOUT_MS) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `timeoutMs must not exceed ${MAX_TRANSACTION_WAIT_TIMEOUT_MS}.`
      );
    }
    if (pollIntervalMs < MIN_TRANSACTION_POLL_INTERVAL_MS) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `pollIntervalMs must be at least ${MIN_TRANSACTION_POLL_INTERVAL_MS}.`
      );
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

async function handleGetWallet(input: Record<string, unknown>, walletService?: WalletService): Promise<unknown> {
  try {
    validateAddress(input.address as string);
    if (!walletService) {
      throw new McpError(ErrorCode.InternalError, 'Wallet service is not available.');
    }
    const wallet = await walletService.getWallet(input.address as string);
    return createSuccessResponse(sanitizeWalletMetadata(wallet));
  } catch (error) {
    return handleError(error);
  }
}

async function handleEstimateTransferFees(input: Record<string, unknown>, neoService: NeoService): Promise<unknown> {
  try {
    validateAddress(input.fromAddress as string);
    validateAddress(input.toAddress as string);
    const amount = validateTokenAmount(input.amount);
    const fees = await neoService.calculateTransferFee(input.fromAddress as string, input.toAddress as string, input.asset as string, amount);
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

export async function callTool(name: string, input: Record<string, unknown>, neoServices: Map<NeoNetwork, NeoService>, contractServices: Map<NeoNetwork, ContractService>, walletService?: WalletService): Promise<Record<string, unknown>> {
  rateLimiter.checkLimit('mcp-client');
  if (name === 'create_wallet' || name === 'import_wallet') {
    return handleError(new McpError(
      ErrorCode.InvalidParams,
      `${name} is not available through MCP. Provision signing wallets outside the model-facing channel.`
    ));
  }

  const legacyWriteRequested = name === 'transfer_assets'
    || name === 'invoke_contract_write'
    || name === 'claim_gas'
    || name === 'deploy_contract';
  const secretBearingInvocation = name === 'invoke_contract' && [
    'fromWIF',
    'wif',
    'privateKey',
    'password',
    'confirm',
  ].some((field) => Object.prototype.hasOwnProperty.call(input, field));
  if (legacyWriteRequested || secretBearingInvocation) {
    return handleError(new McpError(
      ErrorCode.InvalidParams,
      'State-changing calls must use the registered idempotent write tools with a server-held signer and elicited approval.'
    ));
  }

  switch (name) {
    case 'get_network_mode':
      return await handleGetNetworkMode();
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
      case 'invoke_contract':
        return await handleInvokeReadContract(input, neoService, contractService) as Record<string, unknown>;
      case 'estimate_transfer_fees':
        return await handleEstimateTransferFees(input, neoService) as Record<string, unknown>;
      case 'estimate_invoke_fees':
        return await handleEstimateInvokeFees(input, neoService, contractService) as Record<string, unknown>;
      case 'list_famous_contracts':
        return await handleListFamousContracts(input, contractService) as Record<string, unknown>;
      case 'get_contract_info':
        return await handleGetContractInfo(input, contractService) as Record<string, unknown>;
      case 'get_contract_status':
        return await handleGetContractStatus(input, contractService) as Record<string, unknown>;
      default:
        throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found or requires network parameter.`);
    }
  } catch (error) {
    return handleError(error);
  }
}
