import { NeoNetwork } from '../services/neo-service';
import { validateScriptHash } from '../utils/validation';

interface N3IndexContractMetadataCacheRow {
  contract_hash: string;
  display_name: string;
  symbol: string;
  logo_url?: string;
  network: string;
  source?: string;
}

interface N3IndexContractRow {
  network: string;
  contract_hash: string;
  update_counter?: number;
  manifest?: {
    name?: string;
    abi?: {
      methods?: Array<{
        name?: string;
        parameters?: Array<{ name?: string; type?: string }>;
      }>;
      events?: unknown[];
    };
    extra?: Record<string, unknown>;
  };
  first_seen_block?: number;
  last_seen_block?: number;
}

export interface N3IndexResolvedContract {
  contractHash: string;
  network: NeoNetwork;
  displayName?: string;
  symbol?: string;
  logoUrl?: string;
  source: 'contract_metadata_cache' | 'contracts_manifest';
  manifestName?: string;
  updateCounter?: number;
  firstSeenBlock?: number;
  lastSeenBlock?: number;
}

type FetchLike = typeof fetch;

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_MANIFEST_SCAN_PAGES = 3;
const DEFAULT_MAX_METADATA_SCAN_PAGES = 10;
const DEFAULT_FETCH_TIMEOUT_MS = 3000;

function normalizeName(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

function buildEqNetwork(network: NeoNetwork): string {
  return `eq.${network}`;
}

export class N3IndexClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly metadataCache = new Map<NeoNetwork, N3IndexContractMetadataCacheRow[]>();
  private readonly metadataRequests = new Map<NeoNetwork, Promise<N3IndexContractMetadataCacheRow[]>>();

  constructor(baseUrl: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private async fetchJson<T>(pathname: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${pathname}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)
      : null;

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`N3Index request timed out for ${url.pathname}`);
      }
      throw error;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`N3Index request failed (${response.status}) for ${url.pathname}`);
    }

    return await response.json() as T;
  }

  private async getContractMetadataCache(network: NeoNetwork): Promise<N3IndexContractMetadataCacheRow[]> {
    const cachedRows = this.metadataCache.get(network);
    if (cachedRows) {
      return cachedRows;
    }

    const inFlightRequest = this.metadataRequests.get(network);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = (async () => {
      try {
        const rows: N3IndexContractMetadataCacheRow[] = [];

        for (let page = 0; page < DEFAULT_MAX_METADATA_SCAN_PAGES; page += 1) {
          const offset = page * DEFAULT_PAGE_SIZE;
          const pageRows = await this.fetchJson<N3IndexContractMetadataCacheRow[]>('/rest/v1/contract_metadata_cache', {
            network: buildEqNetwork(network),
            limit: String(DEFAULT_PAGE_SIZE),
            offset: String(offset),
            select: 'contract_hash,display_name,symbol,logo_url,network,source',
            order: 'display_name.asc.nullslast',
          });

          rows.push(...pageRows);

          if (pageRows.length < DEFAULT_PAGE_SIZE) {
            break;
          }
        }

        this.metadataCache.set(network, rows);
        return rows;
      } finally {
        this.metadataRequests.delete(network);
      }
    })();

    this.metadataRequests.set(network, request);
    return request;
  }

  async resolveByName(network: NeoNetwork, reference: string): Promise<N3IndexResolvedContract | null> {
    const normalizedReference = normalizeName(reference);
    if (!normalizedReference) {
      return null;
    }

    const metadataRows = await this.getContractMetadataCache(network);
    const exactMetadataMatch = metadataRows.find((row) =>
      normalizeName(row.display_name) === normalizedReference || normalizeName(row.symbol) === normalizedReference
    );

    if (exactMetadataMatch) {
      return {
        contractHash: validateScriptHash(exactMetadataMatch.contract_hash),
        network,
        displayName: exactMetadataMatch.display_name || undefined,
        symbol: exactMetadataMatch.symbol || undefined,
        logoUrl: exactMetadataMatch.logo_url || undefined,
        source: 'contract_metadata_cache',
      };
    }

    // Skip manifest scan for short, all-lowercase names (e.g. "gas", "neo") — these are
    // handled by the famous contracts list. Only scan N3Index manifests for longer names
    // (likely full contract names) or names with uppercase/spaces (e.g. "NeoFS", "Ghost Market").
    const shouldScanManifestFallback = reference.trim().length >= 8 || /[\sA-Z]/.test(reference);
    if (!shouldScanManifestFallback) {
      return null;
    }

    for (let page = 0; page < DEFAULT_MAX_MANIFEST_SCAN_PAGES; page += 1) {
      const offset = page * DEFAULT_PAGE_SIZE;
      const rows = await this.fetchJson<N3IndexContractRow[]>('/rest/v1/contracts', {
        network: buildEqNetwork(network),
        select: 'network,contract_hash,update_counter,first_seen_block,last_seen_block,manifest',
        order: 'last_seen_block.desc.nullslast',
        limit: String(DEFAULT_PAGE_SIZE),
        offset: String(offset),
      });

      if (rows.length === 0) {
        break;
      }

      const match = rows.find((row) => normalizeName(row.manifest?.name) === normalizedReference);

      if (match) {
        return {
          contractHash: validateScriptHash(match.contract_hash),
          network,
          displayName: match.manifest?.name || undefined,
          manifestName: match.manifest?.name || undefined,
          source: 'contracts_manifest',
          updateCounter: match.update_counter,
          firstSeenBlock: match.first_seen_block,
          lastSeenBlock: match.last_seen_block,
        };
      }

      if (rows.length < DEFAULT_PAGE_SIZE) {
        break;
      }
    }

    return null;
  }

  async getContractByHash(network: NeoNetwork, contractHash: string): Promise<N3IndexResolvedContract | null> {
    const normalizedHash = validateScriptHash(contractHash);
    const rows = await this.fetchJson<N3IndexContractRow[]>('/rest/v1/contracts', {
      network: buildEqNetwork(network),
      contract_hash: `eq.${normalizedHash}`,
      select: 'network,contract_hash,update_counter,first_seen_block,last_seen_block,manifest',
      limit: '1',
    });

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const metadataRows = await this.fetchJson<N3IndexContractMetadataCacheRow[]>('/rest/v1/contract_metadata_cache', {
      network: buildEqNetwork(network),
      contract_hash: `eq.${normalizedHash}`,
      select: 'contract_hash,display_name,symbol,logo_url,network,source',
      limit: '1',
    });
    const metadata = metadataRows[0];

    return {
      contractHash: normalizedHash,
      network,
      displayName: metadata?.display_name || row.manifest?.name || undefined,
      symbol: metadata?.symbol || undefined,
      logoUrl: metadata?.logo_url || undefined,
      manifestName: row.manifest?.name || undefined,
      source: metadata ? 'contract_metadata_cache' : 'contracts_manifest',
      updateCounter: row.update_counter,
      firstSeenBlock: row.first_seen_block,
      lastSeenBlock: row.last_seen_block,
    };
  }
}
