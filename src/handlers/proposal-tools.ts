// Non-custodial WRITE layer: SIMULATE + CONSTRUCT tools for Neo N3 and Neo X.
//
// These tools help an agent prepare a state-changing transaction WITHOUT ever
// holding a key, signing, or broadcasting. Simulate tools run read-only
// previews (N3 invokefunction test mode / EVM eth_call + estimate). Construct
// tools return an UNSIGNED PROPOSAL object that the user's own wallet
// (NeoLine/WalletConnect for N3, MetaMask for Neo X) reviews and signs.
//
// HARD NON-CUSTODIAL BOUNDARY: this module (and everything it imports) does not
// import a signer, a wallet store, or the write-operation-service. The N3
// simulation is delegated to a read-only NeoService method passed in by the
// caller; the EVM calls go through the read-only, allowlisted evm-rpc-client.
// There is no signing or broadcasting path reachable from here.

import type { NeoService } from '../services/neo-service';
import { createSuccessResponse } from '../utils/error-handler';
import { ValidationError } from '../utils/errors';
import { formatContractParameters } from '../utils/contract-params';
import {
  validateScriptHash,
  validateEvmAddress,
  validateEvmAmount,
} from '../utils/validation';
import {
  callEvmRpc,
  resolveNeoxEvmNetwork,
  neoxChainId,
  NeoxEvmNetwork,
} from '../contracts/evm-rpc-client';
import {
  buildN3TransferProposal,
  buildN3InvokeProposal,
  buildEvmTxProposal,
  simulationRequestFor,
  resolveNep17ScriptHash,
  defaultDecimalsForScriptHash,
  normalizeCalldata,
  toHexQuantity,
  N3InvokeProposal,
  N3Simulation,
  N3Network,
} from '../utils/transaction-proposal';
import { encodeFunctionCall } from '../utils/evm-abi';
import type { ContractInvocationResult } from '../services/neo-service';

// --- shared helpers --------------------------------------------------------

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

/** Shape a raw invokefunction result into a compact simulation preview. */
function shapeSimulation(result: ContractInvocationResult): N3Simulation {
  return {
    state: typeof result.state === 'string' ? result.state : 'UNKNOWN',
    gasConsumed: typeof result.gasconsumed === 'string' ? result.gasconsumed : null,
    exception: (result.exception ?? null) as string | null,
    stack: Array.isArray(result.stack) ? result.stack : [],
  };
}

/** Normalize caller-supplied RPC signers (account may be an N3 address or 0x hash). */
function normalizeRpcSigners(raw: unknown): Array<{ account: string; scopes: string }> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    throw new ValidationError('signers must be an array');
  }
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new ValidationError('Each signer must be an object with account and scopes');
    }
    const record = entry as Record<string, unknown>;
    const account = requireString(record.account, 'signer.account');
    const scopes = record.scopes === undefined ? 'CalledByEntry' : requireString(record.scopes, 'signer.scopes');
    return { account, scopes };
  });
}

function resolveN3Network(input: Record<string, unknown>): N3Network {
  const raw = typeof input.network === 'string' ? input.network.trim().toLowerCase() : 'mainnet';
  if (raw === 'mainnet' || raw === 'testnet') return raw;
  throw new ValidationError(`Invalid network: ${String(input.network)}. Must be one of: mainnet, testnet`);
}

/** Fetch NEP-17 token decimals via a read-only test invoke. */
async function fetchTokenDecimals(neoService: NeoService, scriptHash: string): Promise<number> {
  const result = await neoService.testInvoke(scriptHash, 'decimals', [], []);
  const raw = Array.isArray(result.stack) && result.stack.length > 0
    ? (result.stack[0] as { value?: unknown }).value
    : undefined;
  const decimals = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^\d+$/.test(raw)
      ? Number(raw)
      : Number.NaN;
  if (result.state !== 'HALT' || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new ValidationError(
      `Could not determine token decimals for ${scriptHash}; pass "decimals" explicitly.`
    );
  }
  return decimals;
}

async function attachSimulation(
  neoService: NeoService,
  proposal: N3InvokeProposal
): Promise<N3InvokeProposal> {
  const request = simulationRequestFor(proposal);
  const result = await neoService.testInvoke(
    request.scriptHash,
    request.operation,
    request.params,
    request.signers
  );
  return { ...proposal, simulation: shapeSimulation(result) };
}

// --- Neo N3: simulate ------------------------------------------------------

export async function handleN3TestInvoke(
  input: Record<string, unknown>,
  neoService: NeoService
): Promise<Record<string, unknown>> {
  const scriptHash = validateScriptHash(requireString(input.scriptHash, 'scriptHash'));
  const operation = requireString(input.operation, 'operation');
  const rawArgs = input.args === undefined ? [] : input.args;
  if (!Array.isArray(rawArgs)) {
    throw new ValidationError('args must be an array');
  }
  const params = formatContractParameters(rawArgs);
  const signers = normalizeRpcSigners(input.signers) ?? [];
  const rpcSigners = signers.map((signer) => ({
    account: /^0x[0-9a-fA-F]{40}$/.test(signer.account) ? signer.account.toLowerCase() : signer.account,
    scopes: signer.scopes,
  }));
  const result = await neoService.testInvoke(scriptHash, operation, params, rpcSigners);
  return createSuccessResponse(shapeSimulation(result)) as Record<string, unknown>;
}

// --- Neo N3: construct -----------------------------------------------------

export async function handleN3BuildTransfer(
  input: Record<string, unknown>,
  neoService: NeoService
): Promise<Record<string, unknown>> {
  const network = resolveN3Network(input);
  const from = requireString(input.from, 'from');
  const to = requireString(input.to, 'to');
  const asset = requireString(input.asset, 'asset');
  const amount = requireString(input.amount, 'amount');

  const { scriptHash } = resolveNep17ScriptHash(asset);
  let decimals = defaultDecimalsForScriptHash(scriptHash);
  if (decimals === undefined) {
    if (input.decimals !== undefined) {
      const provided = Number(input.decimals);
      if (!Number.isSafeInteger(provided) || provided < 0 || provided > 255) {
        throw new ValidationError('decimals must be an integer between 0 and 255');
      }
      decimals = provided;
    } else {
      decimals = await fetchTokenDecimals(neoService, scriptHash);
    }
  }

  const proposal = buildN3TransferProposal({ network, from, to, asset, amount, decimals });
  const withSimulation = await attachSimulation(neoService, proposal);
  return createSuccessResponse(withSimulation) as Record<string, unknown>;
}

export async function handleN3BuildInvoke(
  input: Record<string, unknown>,
  neoService: NeoService
): Promise<Record<string, unknown>> {
  const network = resolveN3Network(input);
  const scriptHash = requireString(input.scriptHash, 'scriptHash');
  const operation = requireString(input.operation, 'operation');
  const from = requireString(input.from, 'from');
  const rawArgs = input.args === undefined ? [] : input.args;
  if (!Array.isArray(rawArgs)) {
    throw new ValidationError('args must be an array');
  }
  const signers = normalizeRpcSigners(input.signers);

  const proposal = buildN3InvokeProposal({
    network,
    scriptHash,
    operation,
    args: rawArgs,
    from,
    ...(signers ? { signers } : {}),
  });
  const withSimulation = await attachSimulation(neoService, proposal);
  return createSuccessResponse(withSimulation) as Record<string, unknown>;
}

// --- Neo X (EVM): simulate -------------------------------------------------

function resolveNeoxNetworkParam(input: Record<string, unknown>): NeoxEvmNetwork {
  const raw = typeof input.network === 'string' && input.network.trim().length > 0
    ? input.network
    : 'neox-mainnet';
  return resolveNeoxEvmNetwork(raw);
}

function buildEvmCallObject(input: {
  from?: string;
  to: string;
  data?: string;
  value?: string;
}): Record<string, string> {
  const call: Record<string, string> = { to: input.to };
  if (input.from) call.from = input.from;
  if (input.data && input.data !== '0x') call.data = input.data;
  if (input.value !== undefined) call.value = toHexQuantity(input.value);
  return call;
}

export async function handleXSimulateCall(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const network = resolveNeoxNetworkParam(input);
  const to = validateEvmAddress(requireString(input.to, 'to'));
  const from = input.from !== undefined ? validateEvmAddress(input.from as string) : undefined;
  const data = input.data !== undefined ? normalizeCalldata(input.data) : undefined;
  const value = input.value !== undefined
    ? validateEvmAmount(input.value, { allowZero: true })
    : undefined;

  const call = buildEvmCallObject({ from, to, data, value });

  let callResult: string | undefined;
  let revertReason: string | undefined;
  try {
    callResult = await callEvmRpc<string>(network, 'eth_call', [call, 'latest']);
  } catch (error) {
    revertReason = error instanceof Error ? error.message : 'eth_call reverted';
  }

  let gasEstimate: string | null = null;
  try {
    gasEstimate = await callEvmRpc<string>(network, 'eth_estimateGas', [call]);
  } catch (error) {
    if (!revertReason) {
      revertReason = error instanceof Error ? error.message : 'eth_estimateGas reverted';
    }
  }

  const gasPrice = await callEvmRpc<string>(network, 'eth_gasPrice', []);

  return createSuccessResponse({
    network,
    gasEstimate,
    gasPrice,
    ...(callResult !== undefined ? { callResult } : {}),
    ...(revertReason !== undefined ? { revertReason } : {}),
  }) as Record<string, unknown>;
}

// --- Neo X (EVM): construct ------------------------------------------------

export async function handleXBuildTransfer(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const network = resolveNeoxNetworkParam(input);
  const from = validateEvmAddress(requireString(input.from, 'from'));
  const to = validateEvmAddress(requireString(input.to, 'to'));
  const value = validateEvmAmount(requireString(input.amountWei, 'amountWei'));

  const call = buildEvmCallObject({ from, to, value });
  const gas = await callEvmRpc<string>(network, 'eth_estimateGas', [call]);
  const gasPrice = await callEvmRpc<string>(network, 'eth_gasPrice', []);
  const chainId = neoxChainId(network);

  const proposal = buildEvmTxProposal({
    network,
    from,
    to,
    valueWei: value,
    data: '0x',
    chainId,
    gas,
    gasPrice,
    summary: `Transfer ${value} wei from ${from} to ${to} on Neo X ${network}.`,
  });
  return createSuccessResponse(proposal) as Record<string, unknown>;
}

export async function handleXBuildContractCall(
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const network = resolveNeoxNetworkParam(input);
  const from = validateEvmAddress(requireString(input.from, 'from'));
  const to = validateEvmAddress(requireString(input.to, 'to'));

  let calldata: string;
  let encodedFrom: string | undefined;
  if (input.data !== undefined && input.data !== null && input.data !== '') {
    calldata = normalizeCalldata(input.data);
  } else if (input.functionSignature !== undefined) {
    const signature = requireString(input.functionSignature, 'functionSignature');
    const args = input.args === undefined ? [] : input.args;
    if (!Array.isArray(args)) {
      throw new ValidationError('args must be an array when using functionSignature');
    }
    calldata = encodeFunctionCall(signature, args);
    encodedFrom = signature;
  } else {
    throw new ValidationError('Provide either pre-encoded "data" or a "functionSignature" (+ args) to encode.');
  }

  const value = input.valueWei !== undefined
    ? validateEvmAmount(input.valueWei, { allowZero: true })
    : '0';

  const call = buildEvmCallObject({ from, to, data: calldata, value });
  const gas = await callEvmRpc<string>(network, 'eth_estimateGas', [call]);
  const gasPrice = await callEvmRpc<string>(network, 'eth_gasPrice', []);
  const chainId = neoxChainId(network);

  const proposal = buildEvmTxProposal({
    network,
    from,
    to,
    valueWei: value,
    data: calldata,
    chainId,
    gas,
    gasPrice,
    summary: encodedFrom
      ? `Call ${encodedFrom} on ${to} (Neo X ${network}), from ${from}.`
      : `Call ${to} with ${calldata.length / 2 - 1} bytes of calldata (Neo X ${network}), from ${from}.`,
  });
  return createSuccessResponse({ ...proposal, encodedCalldata: calldata }) as Record<string, unknown>;
}

// --- dispatch --------------------------------------------------------------

/** Construct/simulate tools that need a read-only NeoService (Neo N3). */
export const N3_PROPOSAL_TOOLS: ReadonlySet<string> = new Set([
  'n3_test_invoke',
  'n3_build_transfer',
  'n3_build_invoke',
]);

/** Construct/simulate tools that use the read-only EVM RPC client (Neo X). */
export const NEOX_PROPOSAL_TOOLS: ReadonlySet<string> = new Set([
  'x_simulate_call',
  'x_build_transfer',
  'x_build_contract_call',
]);

/** Dispatch a Neo N3 proposal/simulate tool (requires a NeoService). */
export async function dispatchN3ProposalTool(
  name: string,
  input: Record<string, unknown>,
  neoService: NeoService
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'n3_test_invoke':
      return handleN3TestInvoke(input, neoService);
    case 'n3_build_transfer':
      return handleN3BuildTransfer(input, neoService);
    case 'n3_build_invoke':
      return handleN3BuildInvoke(input, neoService);
    default:
      throw new ValidationError(`Unknown Neo N3 proposal tool: ${name}`);
  }
}

/** Dispatch a Neo X (EVM) proposal/simulate tool (uses the EVM RPC client). */
export async function dispatchNeoxProposalTool(
  name: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'x_simulate_call':
      return handleXSimulateCall(input);
    case 'x_build_transfer':
      return handleXBuildTransfer(input);
    case 'x_build_contract_call':
      return handleXBuildContractCall(input);
    default:
      throw new ValidationError(`Unknown Neo X proposal tool: ${name}`);
  }
}
