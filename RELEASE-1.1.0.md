# Neo N3 MCP Server 1.1.0 Release Notes

We're excited to announce the release of Neo N3 MCP Server version 1.1.0!

## What's New

This release adds the `get_block_count` operation to retrieve the current block height from the Neo N3 blockchain. This highly requested feature enables AI assistants and applications to access one of the most fundamental blockchain metrics directly.

## Key Features

- **Block Height Operation**: New `get_block_count` operation using the Neo RPC method `getblockcount`
- **Improved Documentation**: Comprehensive MCP Operations reference section in the documentation
- **Enhanced Reliability**: Better error handling and network connectivity checks
- **Updated AI Integration**: Expanded examples and troubleshooting guides

## Usage Example

```javascript
const result = await client.callTool('get_block_count', {
  network: 'mainnet'
});
console.log(`Current block height: ${result.count}`);
```

## AI Chat Integration

When users ask about the current block height, the AI can now execute:

```
{{mcp:get_block_count:{"network":"mainnet"}}}
```

## Installation & Upgrade

### NPM

```bash
# New installation
npm install @r3e/neo-n3-mcp

# Upgrade from previous version
npm update @r3e/neo-n3-mcp@1.1.0
```

### Docker

```bash
docker pull r3e/neo-n3-mcp:1.1.0
```

## Configuration

No configuration changes are required for this update. The new operation works seamlessly with existing configurations.

## Documentation

Visit our [website](https://neo-n3-mcp.netlify.app) for complete documentation, including:

- [User Guide](https://neo-n3-mcp.netlify.app/user-guide.html)
- [API Reference](https://neo-n3-mcp.netlify.app/documentation.html#mcp-operations)
- [AI Integration Guide](https://neo-n3-mcp.netlify.app/user-guide.html#ai-integration)

## Compatibility

This release is fully backward compatible with previous versions. No breaking changes have been introduced. 