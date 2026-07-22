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
import {
  validateAddress,
  validateHash,
  validateScriptHash,
  validateNetwork,
  validateInteger,
  validateTokenAmount,
  validateEvmAddress,
  validateEvmHash,
  validateEvmBlockRef,
  sanitizeString,
} from '../utils/validation';
import { handleError, createSuccessResponse } from '../utils/error-handler';
import { rateLimiter } from '../utils/rate-limiter';
import { callIndexerRpc } from '../contracts/indexer-rpc-client';
import { fetchBlockscout, resolveNeoxNetwork, NeoxNetwork } from '../contracts/blockscout-client';
import { ValidationError } from '../utils/errors';
import {
  N3_PROPOSAL_TOOLS,
  NEOX_PROPOSAL_TOOLS,
  dispatchN3ProposalTool,
  dispatchNeoxProposalTool,
} from './proposal-tools';

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

// --- Analytical indexer (neo3fura) read tools ---

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

/** Clamp an optional Limit param to [1, MAX_PAGE_LIMIT], defaulting to DEFAULT_PAGE_LIMIT. */
function resolveLimit(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_PAGE_LIMIT;
  }
  const parsed = validateInteger(value as string | number);
  if (parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

/** Resolve an optional Skip param to a non-negative integer, defaulting to 0. */
function resolveSkip(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }
  return validateInteger(value as string | number);
}

/** Resolve and validate the N3 network for an indexer read (defaults to mainnet). */
function resolveIndexerNetwork(input: Record<string, unknown>): NeoNetwork {
  if (typeof input.network === 'string' && input.network.trim().length > 0) {
    return validateNetwork(input.network);
  }
  return NeoNetwork.MAINNET;
}

async function handleN3GetAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const address = validateAddress(input.address as string);
    const result = await callIndexerRpc(network, 'GetAddressByAddress', { Address: address });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3ListTransactionsByAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const address = validateAddress(input.address as string);
    const result = await callIndexerRpc(network, 'GetRawTransactionByAddress', {
      Address: address,
      Limit: resolveLimit(input.limit),
      Skip: resolveSkip(input.skip),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3ListTransfersByAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const address = validateAddress(input.address as string);
    const result = await callIndexerRpc(network, 'GetNep17TransferByAddress', {
      Address: address,
      Limit: resolveLimit(input.limit),
      Skip: resolveSkip(input.skip),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3AssetHolders(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const contractHash = validateScriptHash(input.contractHash as string);
    const result = await callIndexerRpc(network, 'GetAssetHoldersListByContractHash', {
      ContractHash: contractHash,
      Limit: resolveLimit(input.limit),
      Skip: resolveSkip(input.skip),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3AssetsHeldByAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const address = validateAddress(input.address as string);
    const result = await callIndexerRpc(network, 'GetAssetsHeldByAddress', {
      Address: address,
      Limit: resolveLimit(input.limit),
      Skip: resolveSkip(input.skip),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3ApplicationLog(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const txid = validateHash(input.txid as string).toLowerCase();
    const result = await callIndexerRpc(network, 'GetApplicationLogByTransactionHash', {
      TransactionHash: txid,
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleN3ContractByName(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveIndexerNetwork(input);
    const rawName = typeof input.name === 'string' ? sanitizeString(input.name) : '';
    if (!rawName) {
      throw new ValidationError('Contract name must be a non-empty string');
    }
    const result = await callIndexerRpc(network, 'GetContractListByName', {
      Name: rawName,
      Limit: resolveLimit(input.limit),
      Skip: resolveSkip(input.skip),
    });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

// --- Neo X (Blockscout v2) read tools ---

function resolveNeoxNetworkParam(input: Record<string, unknown>): NeoxNetwork {
  const raw = typeof input.network === 'string' && input.network.trim().length > 0
    ? input.network
    : 'neox-mainnet';
  return resolveNeoxNetwork(raw);
}

async function handleXSearch(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const query = typeof input.q === 'string' ? sanitizeString(input.q) : '';
    if (!query) {
      throw new ValidationError('Search query "q" must be a non-empty string');
    }
    const result = await fetchBlockscout(network, 'search', { q: query });
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXGetAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const address = validateEvmAddress(input.address as string);
    const result = await fetchBlockscout(network, `addresses/${address}`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXListTransactionsByAddress(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const address = validateEvmAddress(input.address as string);
    const result = await fetchBlockscout(network, `addresses/${address}/transactions`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXListTokenTransfers(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const address = validateEvmAddress(input.address as string);
    const result = await fetchBlockscout(network, `addresses/${address}/token-transfers`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXTokenInfo(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const token = validateEvmAddress(input.address as string);
    const result = await fetchBlockscout(network, `tokens/${token}`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXTokenHolders(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const token = validateEvmAddress(input.address as string);
    const result = await fetchBlockscout(network, `tokens/${token}/holders`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXBlock(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const blockRef = validateEvmBlockRef(input.blockNumberOrHash as string | number);
    const result = await fetchBlockscout(network, `blocks/${blockRef}`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

async function handleXTransaction(input: Record<string, unknown>): Promise<unknown> {
  try {
    const network = resolveNeoxNetworkParam(input);
    const hash = validateEvmHash(input.hash as string);
    const result = await fetchBlockscout(network, `transactions/${hash}`);
    return createSuccessResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

const N3_INDEXER_TOOLS = new Set([
  'n3_get_address',
  'n3_list_transactions_by_address',
  'n3_list_transfers_by_address',
  'n3_asset_holders',
  'n3_assets_held_by_address',
  'n3_application_log',
  'n3_contract_by_name',
]);

const NEOX_TOOLS = new Set([
  'x_search',
  'x_get_address',
  'x_list_transactions_by_address',
  'x_list_token_transfers',
  'x_token_info',
  'x_token_holders',
  'x_block',
  'x_transaction',
]);

async function dispatchAnalyticalTool(name: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (name) {
    case 'n3_get_address':
      return await handleN3GetAddress(input) as Record<string, unknown>;
    case 'n3_list_transactions_by_address':
      return await handleN3ListTransactionsByAddress(input) as Record<string, unknown>;
    case 'n3_list_transfers_by_address':
      return await handleN3ListTransfersByAddress(input) as Record<string, unknown>;
    case 'n3_asset_holders':
      return await handleN3AssetHolders(input) as Record<string, unknown>;
    case 'n3_assets_held_by_address':
      return await handleN3AssetsHeldByAddress(input) as Record<string, unknown>;
    case 'n3_application_log':
      return await handleN3ApplicationLog(input) as Record<string, unknown>;
    case 'n3_contract_by_name':
      return await handleN3ContractByName(input) as Record<string, unknown>;
    case 'x_search':
      return await handleXSearch(input) as Record<string, unknown>;
    case 'x_get_address':
      return await handleXGetAddress(input) as Record<string, unknown>;
    case 'x_list_transactions_by_address':
      return await handleXListTransactionsByAddress(input) as Record<string, unknown>;
    case 'x_list_token_transfers':
      return await handleXListTokenTransfers(input) as Record<string, unknown>;
    case 'x_token_info':
      return await handleXTokenInfo(input) as Record<string, unknown>;
    case 'x_token_holders':
      return await handleXTokenHolders(input) as Record<string, unknown>;
    case 'x_block':
      return await handleXBlock(input) as Record<string, unknown>;
    case 'x_transaction':
      return await handleXTransaction(input) as Record<string, unknown>;
    default:
      throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found.`);
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

  // Analytical indexer (neo3fura) and Neo X (Blockscout) reads go straight to
  // their HTTP clients and never touch the NeoService/ContractService RPC layer.
  if (N3_INDEXER_TOOLS.has(name) || NEOX_TOOLS.has(name)) {
    return await dispatchAnalyticalTool(name, input);
  }

  // Neo X (EVM) simulate/construct tools use the read-only, allowlisted EVM RPC
  // client and never touch the N3 RPC layer. They return UNSIGNED proposals and
  // never sign or broadcast.
  if (NEOX_PROPOSAL_TOOLS.has(name)) {
    try {
      return await dispatchNeoxProposalTool(name, input);
    } catch (error) {
      return handleError(error);
    }
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

  // Neo N3 simulate/construct tools reuse the read-only NeoService RPC path
  // (invokefunction test mode) and return UNSIGNED proposals — no signing, no
  // sendrawtransaction.
  if (N3_PROPOSAL_TOOLS.has(name)) {
    try {
      return await dispatchN3ProposalTool(name, input, neoService);
    } catch (error) {
      return handleError(error);
    }
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
