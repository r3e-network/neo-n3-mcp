/**
 * Configuration for the Neo N3 MCP server
 */
export const config = {
  // Neo N3 RPC URL (default is localhost, can be overridden with environment variable)
  neoRpcUrl: process.env.NEO_RPC_URL || 'http://localhost:10332',
  
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
