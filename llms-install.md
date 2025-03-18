# Neo N3 MCP Server Installation Guide for LLMs

This guide provides step-by-step instructions for installing and configuring the Neo N3 MCP server. It's specifically designed to help AI assistants like Cline set up the server correctly.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Git

## Installation Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/neo-n3-mcp.git
   cd neo-n3-mcp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Add to MCP settings**

   ```bash
   npm run add-to-mcp
   ```

   This will automatically add the Neo N3 MCP server to the Claude MCP settings file.

## Docker Installation (Alternative)

If you prefer using Docker:

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/neo-n3-mcp.git
   cd neo-n3-mcp
   ```

2. **Start with Docker Compose**

   ```bash
   docker-compose up -d
   ```

## Configuration

The Neo N3 MCP server can be configured using environment variables:

- `NEO_RPC_URL`: URL of the Neo N3 RPC node (default: http://localhost:10332)
- `WALLET_PATH`: Path to the wallet files (default: ./wallets)
- `NEO_NETWORK`: Network type: 'mainnet', 'testnet', or 'private' (default: mainnet)

You can set these environment variables in the MCP settings file or in the Docker Compose file.

## Verification

To verify that the Neo N3 MCP server is running correctly:

1. Check that the server appears in the Claude MCP settings
2. Try using one of the Neo N3 tools, such as `get_blockchain_info`

## Troubleshooting

- **Connection issues**: Make sure the Neo N3 RPC node is running and accessible
- **Permission issues**: Ensure the wallet directory is writable
- **MCP settings issues**: Check that the MCP settings file exists and is correctly formatted

## Additional Resources

- [Neo N3 Documentation](https://docs.neo.org/)
- [Neo N3 RPC API Reference](https://docs.neo.org/docs/en-us/reference/rpc/latest-version/api.html)
- [MCP Protocol Documentation](https://github.com/modelcontextprotocol)
