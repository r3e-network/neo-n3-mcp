/**
 * Configuration for the Neo N3 MCP server
 */
export const config = {
  // Neo N3 RPC URLs for different networks
  neoRpcUrl: process.env.NEO_RPC_URL || 'http://localhost:10332', // Default/Legacy config
  
  // Network-specific RPC URLs
  mainnetRpcUrl: process.env.NEO_MAINNET_RPC_URL || process.env.NEO_RPC_URL || 'http://seed1.neo.org:10332',
  testnetRpcUrl: process.env.NEO_TESTNET_RPC_URL || 'https://testnet1.neo.coz.io:443',
  
  // Path to wallet files
  walletPath: process.env.WALLET_PATH || './wallets',
  
  // Network type: 'mainnet', 'testnet', or 'private'
  network: process.env.NEO_NETWORK || 'mainnet',
  
  // Security settings
  security: {
    // Maximum number of requests per minute (rate limiting)
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60', 10),
    
    // Whether to require confirmation for sensitive operations
    requireConfirmation: process.env.REQUIRE_CONFIRMATION !== 'false',
  },
  
  // Logging settings
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: process.env.LOG_LEVEL || 'info',
    
    // Whether to log to console
    console: process.env.LOG_CONSOLE !== 'false',
    
    // Whether to log to file
    file: process.env.LOG_FILE === 'true',
    
    // Path to log file
    filePath: process.env.LOG_FILE_PATH || './logs/neo-n3-mcp.log',
  },
};
