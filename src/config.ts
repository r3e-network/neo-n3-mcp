/**
 * Configuration for the Neo N3 MCP server
 */

// Define valid network modes
export enum NetworkMode {
  MAINNET_ONLY = 'mainnet_only',
  TESTNET_ONLY = 'testnet_only',
  BOTH = 'both'
}

// Default configuration values - simplified to reduce reliance on environment variables
const DEFAULT_MAINNET_RPC = 'https://mainnet1.neo.coz.io:443';
const DEFAULT_TESTNET_RPC = 'https://testnet1.neo.coz.io:443';
const DEFAULT_NETWORK_MODE = NetworkMode.BOTH;

// Helper function remains for potential advanced override, but not used by default config
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

export const config = {
  // Use hardcoded defaults, allowing optional override via environment variables
  // if absolutely necessary for advanced use cases, but primarily rely on defaults.
  mainnetRpcUrl: process.env.NEO_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC,
  testnetRpcUrl: process.env.NEO_TESTNET_RPC_URL || DEFAULT_TESTNET_RPC,
  networkMode: parseNetworkMode(process.env.NEO_NETWORK_MODE), // Keep parsing for potential override

  // Rate limiting configuration
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED !== 'false', // Default enabled
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10),
    maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR || '1000', 10),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/neo-mcp.log',
    console: process.env.LOG_CONSOLE !== 'false', // Default enabled
  },

  // Port for the *optional* HTTP server - KEEPING this, as http-mcp-server.js might be added back later or used differently
  // port: parseInt(process.env.PORT || '5000', 10),

  // Other settings (like walletPath, security, logging) are removed from this primary export
  // to simplify basic usage. They might still exist internally or be added back if needed.
};

// Example of accessing the simplified config:
// import { config } from './config';
// console.log(config.mainnetRpcUrl);
// console.log(config.networkMode);
