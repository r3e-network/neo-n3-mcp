# Neo N3 MCP Architecture

This document provides an overview of the architecture of the Neo N3 Model Context Protocol (MCP) implementation.

## Table of Contents

- [Overview](#overview)
- [Components](#components)
- [Data Flow](#data-flow)
- [Error Handling](#error-handling)
- [Security](#security)
- [Extensibility](#extensibility)

## Overview

The Neo N3 MCP is designed to provide a standardized way to interact with the Neo N3 blockchain. It follows a modular architecture that separates concerns and makes it easy to extend and maintain.

### Key Design Principles

1. **Modularity**: The implementation is divided into separate modules with clear responsibilities.
2. **Extensibility**: The architecture allows for easy addition of new features and tools.
3. **Security**: Security is a primary concern, especially for operations involving private keys and asset transfers.
4. **Error Handling**: Comprehensive error handling ensures that errors are properly reported and handled.
5. **Testability**: The architecture is designed to be easily testable.

## Components

The Neo N3 MCP consists of the following main components:

### MCP Protocol Handler

The MCP Protocol Handler is responsible for:
- Parsing MCP requests
- Routing requests to the appropriate service
- Formatting responses according to the MCP specification
- Handling errors

### Neo Service

The Neo Service is responsible for:
- Interacting with the Neo N3 blockchain
- Querying blockchain information
- Getting blocks and transactions
- Getting account balances

### Wallet Service

The Wallet Service is responsible for:
- Creating and importing wallets
- Managing wallet keys
- Signing transactions

### Contract Service

The Contract Service is responsible for:
- Managing famous contracts
- Providing contract information
- Invoking contract operations

### HTTP Server

The HTTP Server is responsible for:
- Exposing the MCP functionality via HTTP
- Handling HTTP requests and responses
- Setting CORS headers
- Handling preflight requests

## Data Flow

The data flow in the Neo N3 MCP is as follows:

1. The client sends an HTTP POST request to the MCP endpoint.
2. The HTTP Server receives the request and forwards it to the MCP Protocol Handler.
3. The MCP Protocol Handler parses the request and routes it to the appropriate service.
4. The service processes the request and returns a result or an error.
5. The MCP Protocol Handler formats the response according to the MCP specification.
6. The HTTP Server sends the response back to the client.

### Sequence Diagram

```
Client                HTTP Server           MCP Handler           Service
  |                       |                     |                    |
  | POST /mcp             |                     |                    |
  |---------------------->|                     |                    |
  |                       | handleMcpRequest    |                    |
  |                       |-------------------->|                    |
  |                       |                     | processRequest     |
  |                       |                     |------------------->|
  |                       |                     |                    |
  |                       |                     |      result        |
  |                       |                     |<-------------------|
  |                       |     response        |                    |
  |                       |<--------------------|                    |
  |       response        |                     |                    |
  |<----------------------|                     |                    |
  |                       |                     |                    |
```

## Error Handling

The Neo N3 MCP implements comprehensive error handling to ensure that errors are properly reported and handled.

### Error Types

The Neo N3 MCP defines the following error types:

- **InvalidRequestError**: The request is invalid (e.g., missing required parameters).
- **MethodNotFoundError**: The requested method is not found.
- **InvalidParamsError**: The parameters are invalid.
- **InternalError**: An internal error occurred.
- **ParseError**: The request could not be parsed.

### Error Propagation

Errors are propagated through the system as follows:

1. Services throw specific error types when they encounter errors.
2. The MCP Protocol Handler catches these errors and formats them according to the MCP specification.
3. The HTTP Server sends the error response back to the client.

## Security

The Neo N3 MCP implements several security measures to protect sensitive information and prevent unauthorized access.

### Key Management

- Private keys are never stored by the MCP.
- All sensitive operations require explicit confirmation.
- Wallet keys are encrypted with the user's password.

### Input Validation

- All input is validated before processing.
- Parameters are checked for correct types and values.
- Malformed requests are rejected with appropriate error messages.

### Network Security

- The HTTP Server sets appropriate CORS headers to prevent cross-origin attacks.
- The server can be configured to use HTTPS for secure communication.

## Extensibility

The Neo N3 MCP is designed to be easily extensible to support new features and tools.

### Adding New Tools

To add a new tool to the MCP:

1. Define the tool in the MCP Protocol Handler.
2. Implement the tool's functionality in the appropriate service.
3. Add the tool to the routing logic in the MCP Protocol Handler.
4. Add tests for the new tool.

### Supporting New Contracts

To add support for a new famous contract:

1. Define the contract in the Contract Service.
2. Implement the contract's operations.
3. Add the contract to the list of famous contracts.
4. Add tests for the new contract.

### Custom Extensions

The Neo N3 MCP can be extended with custom functionality by:

1. Creating a new service for the custom functionality.
2. Adding the service to the MCP Protocol Handler.
3. Implementing the necessary tools in the new service.
4. Adding the tools to the routing logic in the MCP Protocol Handler.
