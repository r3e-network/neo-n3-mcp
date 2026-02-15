# Testing the Neo N3 MCP

This document provides information on how to test the Neo N3 Model Context Protocol (MCP) implementation.

## Table of Contents

- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Manual Testing](#manual-testing)
- [Test Coverage](#test-coverage)
- [Troubleshooting](#troubleshooting)

## Unit Tests

The Neo N3 MCP includes comprehensive unit tests to ensure that individual components work correctly. These tests use Jest as the testing framework.

### Running Unit Tests

To run all unit tests:

```bash
npm test
```

This will run all the tests in the `tests` directory.

### Running Specific Tests

To run specific tests, you can use the following commands:

```bash
# Run simple tests
npm run test:simple

# Run network tests
npm run test:network

# Run transaction status tests
npm run test:tx-status
```

### Test Structure

The unit tests are organized as follows:

- `tests/mcp/mcp-protocol.test.ts`: Tests for the MCP protocol implementation
- `tests/services/neo-service.test.ts`: Tests for the Neo service
- `tests/services/wallet-service.test.ts`: Tests for the wallet service
- `tests/contracts/contract-service.test.ts`: Tests for the contract service

## Integration Tests

Integration tests verify that different components of the Neo N3 MCP work together correctly.

### Running Integration Tests

To run the integration tests:

```bash
npm run test:integration
```

This will run all the tests in the `tests/integration` directory.

### Test Structure

The integration tests are organized as follows:

- `tests/integration/mcp-integration.test.ts`: Tests for the MCP integration with Neo N3 services
- `tests/integration/contract-integration.test.ts`: Tests for contract integration

## Manual Testing

You can also test the Neo N3 MCP manually using the HTTP server and example scripts.

### Starting the HTTP Server

To start the HTTP server:

```bash
npm run start:http
```

This will start the HTTP server on port 5000 (or the port specified in the PORT environment variable).

### Running the Example Script

To run the example script:

```bash
npm run example:simple
```

This will run the `examples/simple-mcp-example.js` script, which demonstrates how to use the Neo N3 MCP.

### Using cURL

You can also test the Neo N3 MCP using cURL:

```bash
# Get blockchain information
curl -X POST http://localhost:5000/mcp -H "Content-Type: application/json" -d '{"name":"get_blockchain_info","arguments":{"network":"mainnet"}}'

# Create a wallet
curl -X POST http://localhost:5000/mcp -H "Content-Type: application/json" -d '{"name":"create_wallet","arguments":{"password":"test-password-123","network":"testnet"}}'

# List famous contracts
curl -X POST http://localhost:5000/mcp -H "Content-Type: application/json" -d '{"name":"list_famous_contracts","arguments":{"network":"mainnet"}}'

# Get contract information
curl -X POST http://localhost:5000/mcp -H "Content-Type: application/json" -d '{"name":"get_contract_info","arguments":{"contractName":"NeoFS","network":"mainnet"}}'
```

## Test Coverage

The Neo N3 MCP aims for high test coverage to ensure that the implementation is robust and reliable.

### Checking Test Coverage

To check the test coverage:

```bash
npm test -- --coverage
```

This will run all the tests and generate a coverage report.

### Coverage Goals

The Neo N3 MCP aims for the following coverage goals:

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

## Troubleshooting

### Common Issues

#### Tests Failing Due to Network Issues

If tests are failing due to network issues, you can try the following:

1. Check your internet connection
2. Verify that the Neo N3 RPC nodes are accessible
3. Try running the tests with a different network (mainnet or testnet)

#### Tests Failing Due to Timeouts

If tests are failing due to timeouts, you can try increasing the timeout value:

```bash
npm test -- --testTimeout=30000
```

This will increase the timeout to 30 seconds.

#### Tests Failing Due to Missing Dependencies

If tests are failing due to missing dependencies, make sure you have installed all the required dependencies:

```bash
npm install
```

### Getting Help

If you encounter issues that you cannot resolve, please:

1. Check the [Neo N3 MCP documentation](https://docs.neo.org/mcp)
2. Join the [Neo Discord community](https://discord.gg/neo)
3. Open an issue on the [Neo N3 MCP GitHub repository](https://github.com/neo-project/neo-n3-mcp)
