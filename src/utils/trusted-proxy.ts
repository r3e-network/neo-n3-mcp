import { BlockList, isIP } from 'net';

type IpFamily = 'ipv4' | 'ipv6';

function normalizeAddress(value: string): { address: string; family: IpFamily } | null {
  const trimmed = value.trim();
  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed)?.[1];
  const address = mappedIpv4 ?? trimmed;
  const version = isIP(address);
  if (version === 4) return { address, family: 'ipv4' };
  if (version === 6) return { address, family: 'ipv6' };
  return null;
}

export function createTrustedProxyBlockList(entries: string[]): BlockList {
  const blockList = new BlockList();

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    const slashIndex = entry.lastIndexOf('/');
    const addressText = slashIndex === -1 ? entry : entry.slice(0, slashIndex);
    const prefixText = slashIndex === -1 ? undefined : entry.slice(slashIndex + 1);
    const normalized = normalizeAddress(addressText);
    if (!normalized) {
      throw new Error(`Invalid trusted proxy address: ${rawEntry}`);
    }

    if (prefixText === undefined) {
      blockList.addAddress(normalized.address, normalized.family);
      continue;
    }
    if (!/^\d+$/.test(prefixText)) {
      throw new Error(`Invalid trusted proxy prefix: ${rawEntry}`);
    }
    const prefix = Number(prefixText);
    const maxPrefix = normalized.family === 'ipv4' ? 32 : 128;
    if (!Number.isSafeInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
      throw new Error(`Invalid trusted proxy prefix: ${rawEntry}`);
    }
    blockList.addSubnet(normalized.address, prefix, normalized.family);
  }

  return blockList;
}

export function resolveForwardedClientAddress(
  remoteAddress: string,
  forwardedHeader: string | undefined,
  trustedProxies: BlockList,
): string {
  const remote = normalizeAddress(remoteAddress);
  if (!remote || !trustedProxies.check(remote.address, remote.family) || !forwardedHeader) {
    return remote?.address ?? remoteAddress;
  }

  const chain = forwardedHeader.split(',').map((entry) => normalizeAddress(entry));
  if (chain.some((entry) => entry === null)) {
    return remote.address;
  }

  const addresses = chain as Array<{ address: string; family: IpFamily }>;
  for (let index = addresses.length - 1; index >= 0; index -= 1) {
    const candidate = addresses[index];
    if (!trustedProxies.check(candidate.address, candidate.family)) {
      return candidate.address;
    }
  }

  return addresses[0]?.address ?? remote.address;
}
