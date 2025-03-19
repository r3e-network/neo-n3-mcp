# Neo N3 MCP Server Version 1.0.8 Summary

## Overview

Version 1.0.8 of the Neo N3 MCP Server enhances reliability and user experience with significant improvements to RPC connectivity, documentation, and website interface. This release focuses on standardizing the use of secure HTTPS endpoints and providing comprehensive documentation through a new website.

## Key Improvements

### Enhanced RPC Reliability

- Updated default RPC URLs to use secure HTTPS endpoints:
  - Mainnet: `https://mainnet1.neo.coz.io:443`
  - Testnet: `https://testnet1.neo.coz.io:443`
- Standardized environment variable naming and usage
- Improved RPC connection resilience

### Comprehensive Website

- Added a complete website with extensive documentation
- Included detailed user guides and integration examples
- Created interactive code samples and demos
- Implemented modern UI with responsive design

### Development Tools

- Added website rebuild scripts for easier maintenance
- Implemented dark mode support for better accessibility
- Created automated SVG generation for visual components
- Enhanced documentation organization and readability

### Documentation Improvements

- Standardized configuration examples across all documentation
- Corrected environment variable naming in examples
- Fixed SVG image rendering issues in documentation
- Updated all RPC URLs in code examples
- Enhanced network architecture documentation with best practices

## Configuration Changes

Environment variables standardized across the codebase:

```bash
# Previously
NEO_RPC_URL=http://localhost:10332

# Now
NEO_MAINNET_RPC_URL=https://mainnet1.neo.coz.io:443
NEO_TESTNET_RPC_URL=https://testnet1.neo.coz.io:443
NEO_NETWORK=mainnet
```

Configuration file format updated:

```json
{
  "port": 3000,
  "network": "mainnet",
  "mainnetRpcUrl": "https://mainnet1.neo.coz.io:443",
  "testnetRpcUrl": "https://testnet1.neo.coz.io:443",
  "walletPath": "./wallets"
}
```

## Upgrading

This update is fully backwards compatible. To upgrade:

1. Update via npm: `npm update @r3e/neo-n3-mcp`
2. If using Docker: `docker pull r3e/neo-n3-mcp:latest`
3. Check the [updated documentation](https://neo-n3-mcp.netlify.app) for new features 