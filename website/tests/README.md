# Neo N3 MCP Website Tests

This directory contains automated tests for the Neo N3 MCP website, focusing on both the Netlify Functions (backend) and the frontend components.

## Test Structure

- `functions/` - Tests for Netlify Functions
  - `api-playground.test.js` - Tests for the API Playground function
  - `balance-checker.test.js` - Tests for the Balance Checker function
  - `block-explorer.test.js` - Tests for the Block Explorer function
  - `code-generator.test.js` - Tests for the Code Generator function
  - `test-function.test.js` - Tests for the test function

- `frontend/` - Tests for frontend components
  - `api-playground.test.js` - Tests for the API Playground UI
  - `block-explorer.test.js` - Tests for the Block Explorer UI

- `mocks/` - Mock files for testing
  - `fileMock.js` - Mock for file imports
  - `styleMock.js` - Mock for CSS imports

- `setupTests.js` - Jest setup file
- `jest.config.js` - Jest configuration
- `package.json` - Test dependencies

## Running Tests

From the `website` directory, you can run:

```bash
# Run all tests
npm test

# Run only function tests
npm run test:functions

# Run only frontend tests
npm run test:frontend

# Run tests in watch mode (for development)
npm run test:watch
```

## Continuous Integration

These tests are automatically run on GitHub Actions when changes are made to the website code. See the workflow configuration in `.github/workflows/website-tests.yml`.

## Test Coverage

The tests cover:

1. **Function Tests**: These test the Netlify Functions that provide backend API functionality for the website. They verify:
   - Proper handling of requests and responses
   - Error handling
   - Network switching between mainnet and testnet
   - Data formatting and transformation

2. **Frontend Tests**: These test the browser-based components of the website. They verify:
   - Component initialization
   - UI updates in response to user actions
   - Data fetching and display
   - Error handling and retry mechanisms

## Adding New Tests

When adding new functionality to the website, please add corresponding tests:

1. For new Netlify Functions, add tests to `functions/`.
2. For new frontend components, add tests to `frontend/`.

Use the existing tests as templates for the proper structure and mocking approach. 