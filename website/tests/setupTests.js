// Mock functions for browser globals
global.console = {
  ...console,
  // Make console.error throw for testing
  error: jest.fn(),
  // Silence console.log during tests
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock fetch for testing
global.fetch = jest.fn();

// Setup and teardown hooks
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up global mocks after each test
  if (global.fetch.mockRestore) {
    global.fetch.mockRestore();
  }
}); 