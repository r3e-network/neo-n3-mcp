module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
  ],
  // A bare `jest` must be deterministic and offline. The tests/mcp-* suites spawn the built
  // server and reach public Neo RPC, so they are opted back in explicitly by the test:mcp,
  // test:mcp:live and test:mcp:stress scripts, which override this list.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/mcp-'
  ],
  // Must stay above DEFAULT_NEO_RPC_TIMEOUT_MS (src/config.ts, 15s): the integration suites
  // call public Neo RPC, and a test killed at 10s reported a bare "Exceeded timeout" instead
  // of the RPC layer's own error, hiding which endpoint was slow. This is a ceiling, not a
  // delay — unit tests still finish in milliseconds.
  testTimeout: 45000
};
