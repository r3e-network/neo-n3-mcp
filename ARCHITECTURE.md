# Neo N3 MCP Server Architecture

This document describes the architecture and design decisions of the Neo N3 MCP server.

## Overview

The Neo N3 MCP server is designed to provide seamless integration between Claude and the Neo N3 blockchain. It follows the Model Context Protocol (MCP) specification to expose Neo N3 functionality as tools and resources that Claude can use to interact with the blockchain.

## System Architecture

The architecture follows a modular design pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Interface Layer                      │
│                       (index.ts)                            │
└───────────────┬─────────────────────────┬──────────────────┘
                │                         │
                ▼                         ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     Tool Handlers       │   │    Resource Handlers    │
│                         │   │                         │
└──────────────┬──────────┘   └──────────┬──────────────┘
               │                         │
               ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Neo Service Layer                         │
│                 (neo-service.ts)                            │
└───────────────┬─────────────────────────┬──────────────────┘
                │                         │
                ▼                         ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      Validation         │   │     Error Handling      │
│    (validation.ts)      │   │    (error-handler.ts)   │
└─────────────────────────┘   └─────────────────────────┘
                │                         │
                ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Neo N3 SDK Layer                          │
│                (@cityofzion/neon-js)                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### MCP Interface Layer (index.ts)

The MCP Interface Layer is responsible for:

- Registering tools and resources with the MCP SDK
- Parsing incoming requests
- Routing requests to the appropriate handler
- Formatting responses according to the MCP specification

This layer acts as the entry point for all MCP interactions and ensures that the server adheres to the MCP protocol.

### Neo Service Layer (neo-service.ts)

The Neo Service Layer provides the core functionality for interacting with the Neo N3 blockchain. It includes:

- Blockchain information retrieval
- Block and transaction data access
- Account balance queries
- Wallet management
- Asset transfers
- Smart contract invocations

This layer abstracts the underlying Neo N3 SDK and provides a clean API for the MCP Interface Layer.

### Validation Layer (validation.ts)

The Validation Layer is responsible for:

- Validating input parameters
- Ensuring data consistency
- Preventing malformed requests
- Providing clear error messages for invalid inputs

All requests pass through this layer before being processed by the Neo Service Layer.

### Error Handling Layer (error-handler.ts)

The Error Handling Layer provides standardized error responses. It:

- Converts Neo N3 specific errors to user-friendly messages
- Masks sensitive information
- Ensures consistent error formatting
- Aids in debugging by logging detailed error information

### Neo N3 SDK Layer (@cityofzion/neon-js)

The Neo N3 SDK Layer is provided by the [neon-js](https://github.com/CityOfZion/neon-js) library from City of Zion. It handles the low-level interaction with the Neo N3 blockchain, including:

- RPC calls
- Transaction construction and signing
- Wallet creation and management
- Smart contract scripting

## Data Flow

The typical data flow for a request is as follows:

1. Claude sends a request to the MCP Interface Layer
2. The MCP Interface Layer parses the request and routes it to the appropriate handler
3. The handler validates the input parameters using the Validation Layer
4. If validation passes, the handler calls the Neo Service Layer
5. The Neo Service Layer interacts with the Neo N3 SDK Layer
6. The Neo N3 SDK Layer communicates with the Neo N3 blockchain
7. The response is passed back up through the layers
8. The MCP Interface Layer formats the response according to the MCP specification
9. The response is sent back to Claude

If an error occurs at any point, the Error Handling Layer formats an appropriate error response.

## Design Decisions

### Modular Architecture

The modular architecture was chosen to:

- Improve maintainability by separating concerns
- Allow for easier testing of individual components
- Facilitate future extensions and modifications
- Provide clear boundaries between layers

### Use of neon-js SDK

The [neon-js](https://github.com/CityOfZion/neon-js) SDK was chosen because:

- It is the official JavaScript SDK for Neo N3
- It is actively maintained by City of Zion
- It provides comprehensive support for all Neo N3 functionality
- It is well-documented and has a strong community

### MCP Integration

The MCP protocol was chosen as the integration point because:

- It provides a standardized way for Claude to interact with external systems
- It supports both tools (active operations) and resources (passive data retrieval)
- It handles authentication and authorization
- It provides a clear separation between the AI and the external system

### Error Handling Strategy

The centralized error handling strategy was chosen to:

- Ensure consistent error formatting
- Prevent sensitive information leakage
- Provide clear, actionable error messages
- Simplify debugging and troubleshooting

### Configuration Approach

The configuration system uses environment variables and command-line arguments to:

- Support deployment in various environments (development, testing, production)
- Allow for runtime configuration changes
- Follow the twelve-factor app methodology
- Facilitate containerization with Docker

## Security Considerations

The architecture includes several security-focused design elements:

- **Input Validation**: All input is validated before processing
- **Private Key Protection**: Private keys are never exposed in responses
- **Confirmation Flag**: Sensitive operations require explicit confirmation
- **Error Masking**: Error messages do not reveal sensitive information
- **Rate Limiting**: Requests are rate-limited to prevent abuse
- **Secure Wallet Storage**: Wallet files are stored securely and encrypted

## Testing Strategy

The testing strategy follows a multi-layered approach:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test the interaction between components
- **End-to-End Tests**: Test the entire system from request to response
- **Simplified Test Runner**: Provides a quick way to verify core functionality

Tests are designed to run both with Jest (for TypeScript) and with a simplified JavaScript test runner.

## Future Enhancements

The architecture is designed to support future enhancements, including:

- **Multi-Network Support**: Simultaneous connection to multiple Neo N3 networks
- **Enhanced Authentication**: Support for API keys and OAuth
- **Plugin System**: Allow for extension through plugins
- **WebSocket Support**: Real-time updates of blockchain state
- **Caching Layer**: Improve performance by caching frequently-accessed data
- **Metrics Collection**: Detailed performance and usage metrics

## Conclusion

The Neo N3 MCP server architecture provides a robust, secure, and maintainable solution for integrating Claude with the Neo N3 blockchain. The modular design ensures that the system can evolve to meet future requirements while maintaining its core functionality and security properties.

The use of standard libraries and protocols ensures that the server is compatible with the broader ecosystem and can be easily integrated into existing workflows. 