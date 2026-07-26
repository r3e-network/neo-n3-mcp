/**
 * Chain identity and network resolution for the unified tool surface.
 *
 * The tool surface exposes two orthogonal axes to callers:
 *
 *   chain:   'n3' | 'neox'
 *   network: 'mainnet' | 'testnet'
 *
 * Neither axis leaks a backend-specific identifier. This module is the single
 * place that maps the pair onto the identifier each backend actually wants:
 * `NeoNetwork` for Neo N3, `NeoxEvmNetwork` ('neox-mainnet' | 'neox-testnet')
 * for Neo X. Keeping the mapping here means a chain mix-up is a validation
 * error at the boundary instead of a request that silently lands on the wrong
 * network.
 */

import { NeoxEvmNetwork } from '../contracts/evm-rpc-client';
import { NeoNetwork } from '../services/neo-service';
import { ValidationError } from '../utils/errors';

/** Every chain the server speaks, in a stable order for tool descriptions. */
export const CHAIN_IDS = ['n3', 'neox'] as const;

export type ChainId = (typeof CHAIN_IDS)[number];

/**
 * The backends a tool can be served from. `node` is a live RPC node, `explorer`
 * is an indexer (n3index for Neo N3, Blockscout for Neo X), `wallet` is the
 * local key-handling surface that only ever exists for Neo N3 stdio sessions.
 */
export const CHAIN_BACKENDS = ['node', 'explorer', 'wallet'] as const;

export type ChainBackend = (typeof CHAIN_BACKENDS)[number];

/** Human-readable chain names, used in errors and tool descriptions. */
const CHAIN_DISPLAY_NAMES: Readonly<Record<ChainId, string>> = Object.freeze({
  n3: 'Neo N3',
  neox: 'Neo X',
});

/**
 * Which backends each chain can serve.
 *
 * `wallet` is Neo N3 only: Neo X transactions are always proposed unsigned and
 * signed by the user's own wallet, so the server has no Neo X key surface to
 * expose. Adding `neox: wallet` here would be a non-custodial regression.
 */
const CHAIN_BACKEND_SUPPORT: Readonly<Record<ChainId, ReadonlySet<ChainBackend>>> = Object.freeze({
  n3: new Set<ChainBackend>(['node', 'explorer', 'wallet']),
  neox: new Set<ChainBackend>(['node', 'explorer']),
});

/** The orthogonal network axis exposed to callers. */
export const CHAIN_NETWORKS = ['mainnet', 'testnet'] as const;

export type ChainNetwork = (typeof CHAIN_NETWORKS)[number];

export function isChainId(value: unknown): value is ChainId {
  return typeof value === 'string' && (CHAIN_IDS as readonly string[]).includes(value);
}

export function chainDisplayName(chain: ChainId): string {
  return CHAIN_DISPLAY_NAMES[chain] ?? String(chain);
}

/**
 * Asserts a value is a known chain id, naming the supported set on failure.
 */
export function assertChainId(value: unknown): ChainId {
  if (!isChainId(value)) {
    throw new ValidationError(
      `Invalid chain: ${String(value)}. Must be one of: ${CHAIN_IDS.join(', ')}`,
    );
  }
  return value;
}

/**
 * Normalizes the caller-supplied network name. Whitespace and case are
 * tolerated because the value often comes from a model-generated tool call;
 * anything else is rejected rather than coerced.
 */
function normalizeNetworkInput(network: string | undefined): string | undefined {
  if (network === undefined || network === null) {
    return undefined;
  }
  const trimmed = String(network).trim().toLowerCase();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Resolves the Neo N3 network. Neo X network ids are rejected instead of being
 * mapped, so calling an N3 tool with `neox-testnet` fails loudly rather than
 * quietly running against N3 mainnet.
 */
export function resolveN3Network(network?: string): NeoNetwork {
  const normalized = normalizeNetworkInput(network);
  if (normalized === undefined) {
    return NeoNetwork.MAINNET;
  }
  if (normalized === NeoNetwork.MAINNET) {
    return NeoNetwork.MAINNET;
  }
  if (normalized === NeoNetwork.TESTNET) {
    return NeoNetwork.TESTNET;
  }
  throw new ValidationError(
    `Invalid Neo N3 network: ${network}. Must be one of: ${CHAIN_NETWORKS.join(', ')}`,
  );
}

/**
 * Resolves the Neo X network onto the EVM network id. Both the orthogonal
 * names ('mainnet' | 'testnet') and the explicit legacy ids
 * ('neox-mainnet' | 'neox-testnet') are accepted, so existing `x_*` callers
 * keep working through the unified surface.
 */
export function resolveNeoxNetwork(network?: string): NeoxEvmNetwork {
  const normalized = normalizeNetworkInput(network);
  if (normalized === undefined) {
    return 'neox-mainnet';
  }
  if (normalized === 'mainnet' || normalized === 'neox-mainnet') {
    return 'neox-mainnet';
  }
  if (normalized === 'testnet' || normalized === 'neox-testnet') {
    return 'neox-testnet';
  }
  throw new ValidationError(
    `Invalid Neo X network: ${network}. Must be one of: ${CHAIN_NETWORKS.join(', ')}`,
  );
}

/**
 * The network identifier a chain's backend expects: `NeoNetwork` for Neo N3,
 * `NeoxEvmNetwork` for Neo X.
 */
export type ResolvedChainNetwork = NeoNetwork | NeoxEvmNetwork;

/**
 * Resolves the (chain, network) pair onto the backend network identifier. The
 * chain is validated first so an unknown chain never reaches a network parser.
 */
export function resolveChainNetwork(chain: ChainId, network?: string): ResolvedChainNetwork {
  const validated = assertChainId(chain);
  return validated === 'n3' ? resolveN3Network(network) : resolveNeoxNetwork(network);
}

export function supportsBackend(chain: ChainId, backend: ChainBackend): boolean {
  if (!isChainId(chain)) {
    return false;
  }
  return CHAIN_BACKEND_SUPPORT[chain].has(backend);
}

/**
 * Asserts a chain can serve a backend, naming both in the failure so the caller
 * (or the model driving it) can pick a supported combination.
 */
export function assertChainSupportsBackend(chain: ChainId, backend: ChainBackend): void {
  const validated = assertChainId(chain);
  if (!supportsBackend(validated, backend)) {
    const supported = CHAIN_IDS.filter((candidate) => supportsBackend(candidate, backend));
    const supportedNames =
      supported.length > 0
        ? supported.map((candidate) => chainDisplayName(candidate)).join(', ')
        : 'none';
    throw new ValidationError(
      `${chainDisplayName(validated)} does not support the ${backend} backend. ` +
        `Supported chains for ${backend}: ${supportedNames}`,
    );
  }
}
