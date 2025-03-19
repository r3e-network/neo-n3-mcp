# Neo N3 MCP Netlify Functions

This directory contains serverless functions that enhance the Neo N3 MCP website with interactive features.

## Available Functions

### API Playground (`api-playground.js`)
Provides a proxy to Neo N3 blockchain RPC endpoints for testing API capabilities.

### Block Explorer (`block-explorer.js`) 
A streamlined block explorer function that fetches and displays blockchain data including blocks, transactions, and network statistics.

### Balance Checker (`balance-checker.js`)
Allows users to check balances of Neo N3 addresses with formatted token information.

### Code Generator (`code-generator.js`)
Generates code snippets for common Neo N3 MCP operations in various programming languages.

## Development

To test these functions locally:

1. Install the Netlify CLI:
   ```
   npm install -g netlify-cli
   ```

2. Run the site with functions:
   ```
   netlify dev
   ```

Functions will be available at paths like `/.netlify/functions/api-playground`.

## Dependencies

These functions require:
- Node.js 16+
- axios for HTTP requests
- node-fetch for fetch API support 