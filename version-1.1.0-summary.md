# Neo N3 MCP Server Version 1.1.0 Summary

## Overview

Version 1.1.0 of the Neo N3 MCP Server introduces the `get_block_count` operation to retrieve the current block height from the Neo N3 blockchain. This enhances the functionality of AI assistants and applications by providing direct access to one of the most commonly requested blockchain metrics.

## Key Improvements

### New Block Height Operation

- Added `get_block_count` operation that calls the Neo RPC method `getblockcount`
- Implemented with proper error handling and network parameter support
- Returns a standardized response format compatible with existing tools

### Documentation Enhancements

- Created a comprehensive MCP Operations section in the documentation
- Added detailed examples for how to use `get_block_count` in various scenarios
- Improved AI integration guides with more precise operation usage examples
- Enhanced website organization for better user experience

### Reliability Improvements

- Added network connectivity checks before making RPC calls
- Enhanced error messages for better diagnostic capabilities
- Fixed operation mapping issues in MCP bridge implementation
- Improved parameter validation across all operations

### AI Integration

- Updated AI system message to include the new operation
- Enhanced chat examples with proper operation syntax
- Added troubleshooting guides specific to block height queries
- Expanded AI integration documentation for multiple platforms

## Usage Examples

### Direct API Call

```javascript
const result = await client.callTool('get_block_count', {
  network: 'mainnet'
});
console.log(`Current block height: ${result.count}`);
```

### AI Chat Integration

When users ask about the current block height, the AI can now execute:

```
{{mcp:get_block_count:{"network":"mainnet"}}}
```

### Response Format

```json
{
  "count": 5123456,
  "network": "mainnet"
}
```

## Upgrading

This update is fully backwards compatible and provides new functionality without breaking existing integrations. To upgrade:

1. Update via npm: `npm update @r3e/neo-n3-mcp@1.1.0`
2. If using Docker: `docker pull r3e/neo-n3-mcp:1.1.0`
3. Check the [updated documentation](https://neo-n3-mcp.netlify.app) for new features
4. Update any AI assistant system messages to include the new operation (see [AI Integration Guide](https://neo-n3-mcp.netlify.app/user-guide.html#ai-integration)) 