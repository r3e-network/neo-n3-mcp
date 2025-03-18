# Testing the Neo N3 MCP Server

This document provides detailed information about testing the Neo N3 MCP server. It covers both the Jest-based TypeScript tests and the simplified JavaScript test runner.

## Test Architecture

The Neo N3 MCP server uses a combination of:

1. **Unit Tests**: Testing individual components in isolation
2. **Integration Tests**: Testing components working together
3. **Mock Testing**: Using mock objects to simulate Neo N3 blockchain interactions

## Testing with Jest

Jest is the primary testing framework used for TypeScript tests. 

### Setup

To run the Jest tests:

```bash
# Install dependencies
npm install

# Run tests
npm test
```

### Test Structure

The Jest tests are organized to test the NeoService class, which is the core component responsible for interacting with the Neo N3 blockchain. The tests use mock objects to simulate the Neo N3 blockchain API responses.

#### Test Files

- `tests/neo-service.test.ts`: Tests for the NeoService class

#### Test Coverage

The Jest tests cover all core functionality of the NeoService class:

1. **Blockchain Information**
   - Getting blockchain height and validators

2. **Block Data**
   - Retrieving block details by height or hash

3. **Transaction Data**
   - Retrieving transaction details by hash

4. **Account Management**
   - Checking account balances
   - Creating new wallets
   - Importing existing wallets

5. **Asset Operations**
   - Transferring assets between addresses

6. **Smart Contract Interaction**
   - Invoking smart contract methods

### Mocking Approach

The tests use Jest's mocking capabilities to mock the `@cityofzion/neon-js` library. This allows the tests to run without connecting to an actual Neo N3 blockchain. The mock implementation provides predefined responses for each method, allowing the tests to verify that the NeoService processes the responses correctly.

```typescript
// Example of the Neo N3 mock implementation
jest.mock('@cityofzion/neon-js', () => ({
  rpc: {
    RPCClient: jest.fn().mockImplementation(() => ({
      getBlockCount: jest.fn().mockResolvedValue(12345),
      // Other methods...
    })),
  },
  // Other components...
}));
```

## Simplified JavaScript Test Runner

In addition to the Jest tests, a simplified JavaScript test runner is provided for quick testing without requiring TypeScript compilation or Jest dependencies.

### Setup

To run the simplified JavaScript tests:

```bash
# Run the test
node tests/simple-test.js
```

### Test Structure

The simplified test runner defines a mock Neo N3 blockchain API and tests the same functionality as the Jest tests. It uses Node.js's built-in `assert` module for assertions.

### Output

The simplified test runner provides detailed logs of each operation, making it easier to understand what's happening during the tests. Each test outputs:

- The method being called
- The parameters used
- The result returned
- Whether the test passed or failed

Example output:

```
Script started
Defined mock objects
Defined TestNeoService class
Defined runTests function
Starting test execution
Running Neo Service tests...
TestNeoService constructor with URL: http://localhost:10332
Creating mock RPCClient with URL: http://localhost:10332
Testing getBlockchainInfo...
TestNeoService.getBlockchainInfo called
Mock getBlockCount called
Mock getValidators called
getBlockchainInfo result: {"height":12345,"validators":[{"publickey":"key1","votes":"100","active":true},{"publickey":"key2","votes":"200","active":true}]}
✅ getBlockchainInfo test passed
...
```

## Testing for Docker Build

To test the Docker build process:

```bash
# Build the Docker image
docker build -t mcp/neo-n3 .

# Run the container in interactive mode
docker run --rm -i mcp/neo-n3
```

This will build the Docker image and run the container, allowing you to test that the Neo N3 MCP server starts correctly in a Docker environment.

## Testing the NPM Package

To test the NPM package:

```bash
# Create the package
npm pack

# Install the package in a test project
npm install path/to/r3e-server-neo-n3-0.1.0.tgz
```

This allows you to verify that the NPM package is correctly structured and can be installed in other projects.

## Manual Integration Testing

For manual integration testing with an actual Neo N3 blockchain:

1. Start a Neo N3 blockchain node:
   ```bash
   docker-compose up -d neo-node
   ```

2. Set the Neo RPC URL environment variable:
   ```bash
   export NEO_RPC_URL=http://localhost:10332
   ```

3. Run the Neo N3 MCP server:
   ```bash
   npm start
   ```

4. Test the connection using the provided examples:
   ```bash
   node examples/client-example.js
   ```

## Troubleshooting

If you encounter issues while testing:

1. **Jest Tests Fail**:
   - Check that all dependencies are installed: `npm install`
   - Verify that TypeScript compilation is working: `npm run build`
   - Run Jest in debug mode: `npx jest --debug`

2. **Simplified Tests Fail**:
   - Check for ES module compatibility issues
   - Run Node.js with `--trace-warnings` flag for more details

3. **Docker Build Issues**:
   - Verify Docker is installed and running
   - Check for network connectivity issues
   - Run Docker with verbose output: `docker build --progress=plain -t mcp/neo-n3 .`

## Adding New Tests

When adding new functionality, follow these guidelines for adding tests:

1. Add Jest tests in the `tests` directory
2. Update the simplified JavaScript test runner if needed
3. Ensure the tests cover all essential functionality
4. Check for edge cases and error conditions
5. Add both successful and failure test cases 