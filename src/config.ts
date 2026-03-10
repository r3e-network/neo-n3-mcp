/**
 * Configuration for the Neo N3 MCP server
 */

export enum NetworkMode {
  MAINNET_ONLY = 'mainnet_only',
  TESTNET_ONLY = 'testnet_only',
  BOTH = 'both'
}

const DEFAULT_MAINNET_RPC = 'https://mainnet1.neo.coz.io:443';
const DEFAULT_TESTNET_RPC = 'http://seed1t5.neo.org:20332';
const DEFAULT_NETWORK_MODE = NetworkMode.BOTH;
const DEFAULT_N3INDEX_BASE_URL = 'https://api.n3index.dev';

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readBooleanEnv(...keys: string[]): boolean | undefined {
  const value = readEnv(...keys);
  if (value === undefined) {
    return undefined;
  }

  switch (value.toLowerCase()) {
    case 'true':
    case '1':
    case 'yes':
    case 'on':
      return true;
    case 'false':
    case '0':
    case 'no':
    case 'off':
      return false;
    default:
      return undefined;
  }
}

function parseNetworkMode(value: string | undefined): NetworkMode {
  if (!value) return DEFAULT_NETWORK_MODE;

  switch (value.toLowerCase()) {
    case 'mainnet':
    case 'mainnet_only':
      return NetworkMode.MAINNET_ONLY;
    case 'testnet':
    case 'testnet_only':
      return NetworkMode.TESTNET_ONLY;
    case 'both':
    default:
      return NetworkMode.BOTH;
  }
}

const logFilePath = readEnv('LOG_FILE') || './logs/neo-n3-mcp.log';
const logToConsole = readBooleanEnv('LOG_CONSOLE');
const isTestLikeEnvironment = (process.env.NODE_ENV || '').toLowerCase().includes('test');

export const config = {
  mainnetRpcUrl: readEnv('NEO_MAINNET_RPC', 'NEO_MAINNET_RPC_URL') || DEFAULT_MAINNET_RPC,
  testnetRpcUrl: readEnv('NEO_TESTNET_RPC', 'NEO_TESTNET_RPC_URL') || DEFAULT_TESTNET_RPC,
  networkMode: parseNetworkMode(readEnv('NEO_NETWORK', 'NEO_NETWORK_MODE')),
  n3index: {
    baseUrl: readEnv('N3INDEX_API_BASE_URL') || DEFAULT_N3INDEX_BASE_URL,
    enabled: readBooleanEnv('N3INDEX_ENABLED') ?? true,
  },

  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10),
    maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || '1000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    console: logToConsole ?? !isTestLikeEnvironment,
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true' || Boolean(readEnv('LOG_FILE')),
    filePath: logFilePath,
  },
};
