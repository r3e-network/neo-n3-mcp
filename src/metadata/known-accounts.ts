import * as neonJs from '@cityofzion/neon-js';
import { ContractNetwork, FAMOUS_CONTRACTS } from '../contracts/contracts';

export interface KnownAccountMetadata {
  id: string;
  name: string;
  kind: 'native_token' | 'contract' | 'account';
  logo: string;
  symbol?: string;
  scriptHash?: string;
  address?: string;
}

interface KnownAccountDefinition {
  id: string;
  name: string;
  kind: 'native_token' | 'contract' | 'account';
  symbol?: string;
  logoText: string;
  background: string;
  foreground?: string;
  scriptHashes?: Partial<Record<'mainnet' | 'testnet', string | undefined>>;
}

const NEO_TOKEN_SCRIPT_HASH = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
const GAS_TOKEN_SCRIPT_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';

function buildMonogramLogo(text: string, background: string, foreground = '#ffffff'): string {
  const safeText = text.trim().slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${safeText} logo"><rect width="64" height="64" rx="16" fill="${background}"/><text x="32" y="38" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="${foreground}">${safeText}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const BUILTIN_KNOWN_ACCOUNTS: KnownAccountDefinition[] = [
  {
    id: 'neo-token',
    name: 'NeoToken',
    symbol: 'NEO',
    kind: 'native_token',
    logoText: 'NEO',
    background: '#58BF00',
    scriptHashes: {
      mainnet: NEO_TOKEN_SCRIPT_HASH,
      testnet: NEO_TOKEN_SCRIPT_HASH,
    },
  },
  {
    id: 'gas-token',
    name: 'GasToken',
    symbol: 'GAS',
    kind: 'native_token',
    logoText: 'GAS',
    background: '#3B82F6',
    scriptHashes: {
      mainnet: GAS_TOKEN_SCRIPT_HASH,
      testnet: GAS_TOKEN_SCRIPT_HASH,
    },
  },
  {
    id: 'neofs',
    name: 'NeoFS',
    kind: 'contract',
    logoText: 'NFS',
    background: '#2563EB',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.neofs.scriptHash[ContractNetwork.MAINNET],
      testnet: FAMOUS_CONTRACTS.neofs.scriptHash[ContractNetwork.TESTNET],
    },
  },
  {
    id: 'neoburger',
    name: 'NeoBurger',
    kind: 'contract',
    logoText: 'NBG',
    background: '#F97316',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.neoburger.scriptHash[ContractNetwork.MAINNET],
    },
  },
  {
    id: 'flamingo',
    name: 'Flamingo',
    kind: 'contract',
    logoText: 'FLM',
    background: '#E11D48',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.flamingo.scriptHash[ContractNetwork.MAINNET],
    },
  },
  {
    id: 'neocompound',
    name: 'NeoCompound',
    kind: 'contract',
    logoText: 'NCP',
    background: '#7C3AED',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.neocompound.scriptHash[ContractNetwork.MAINNET],
    },
  },
  {
    id: 'grandshare',
    name: 'GrandShare',
    kind: 'contract',
    logoText: 'GSH',
    background: '#0891B2',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.grandshare.scriptHash[ContractNetwork.MAINNET],
    },
  },
  {
    id: 'ghostmarket',
    name: 'GhostMarket',
    kind: 'contract',
    logoText: 'GST',
    background: '#111827',
    scriptHashes: {
      mainnet: FAMOUS_CONTRACTS.ghostmarket.scriptHash[ContractNetwork.MAINNET],
    },
  },
];

export function normalizeScriptHash(value: string | undefined | null): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(normalized)) {
    return normalized;
  }
  if (/^[0-9a-f]{40}$/.test(normalized)) {
    return `0x${normalized}`;
  }

  return null;
}

export function tryGetScriptHashFromAddress(address: string | undefined | null): string | null {
  if (!address || typeof address !== 'string') {
    return null;
  }

  try {
    return normalizeScriptHash(neonJs.wallet.getScriptHashFromAddress(address));
  } catch {
    return null;
  }
}

export function tryGetAddressFromScriptHash(scriptHash: string | undefined | null): string | null {
  const normalized = normalizeScriptHash(scriptHash);
  if (!normalized) {
    return null;
  }

  try {
    return neonJs.wallet.getAddressFromScriptHash(normalized);
  } catch {
    return null;
  }
}

export function resolveKnownAccount(reference: string | undefined | null, network: 'mainnet' | 'testnet'): KnownAccountMetadata | null {
  const normalizedScriptHash = normalizeScriptHash(reference) ?? tryGetScriptHashFromAddress(reference);
  if (!normalizedScriptHash) {
    return null;
  }

  for (const entry of BUILTIN_KNOWN_ACCOUNTS) {
    const networkScriptHash = normalizeScriptHash(entry.scriptHashes?.[network]);
    if (!networkScriptHash || networkScriptHash !== normalizedScriptHash) {
      continue;
    }

    return {
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      symbol: entry.symbol,
      scriptHash: networkScriptHash,
      address: tryGetAddressFromScriptHash(networkScriptHash) ?? undefined,
      logo: buildMonogramLogo(entry.logoText, entry.background, entry.foreground),
    };
  }

  return null;
}
