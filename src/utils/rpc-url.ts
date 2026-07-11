const INVALID_RPC_URL_MESSAGE =
  'Invalid RPC URL. Expected HTTPS with a hostname and no embedded credentials; ' +
  'HTTP is allowed only for loopback or an explicit insecure-RPC override.';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return normalized === 'localhost' || normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

/**
 * Assert that an RPC endpoint is safe to pass to the HTTP transport.
 */
export function assertValidRpcUrl(
  rpcUrl: string,
  options: { allowInsecureRemote?: boolean } = {}
): void {
  let parsed: URL;

  try {
    parsed = new URL(rpcUrl);
  } catch {
    throw new Error(INVALID_RPC_URL_MESSAGE);
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    (parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname) && !options.allowInsecureRemote)
  ) {
    throw new Error(INVALID_RPC_URL_MESSAGE);
  }
}
