// Setup file for Node.js test environment

// Only mock axios for tests that need it
try {
  const axios = require('axios');
  if (axios) {
    jest.mock('axios');
  }
} catch (error) {
  console.warn('Axios not found, skipping mock');
}

// Global setup for all tests
beforeAll(() => {
  // Any global setup needed for Node.js tests
});

// Global teardown for all tests
afterAll(() => {
  // Any global teardown needed for Node.js tests
});
