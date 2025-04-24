module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  // Set different test environments for different test files
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '**/tests/**/*.test.ts',
        '**/tests/utils/**/*.test.js',
        '**/tests/contracts/**/*.test.js',
        '**/tests/network-*.test.js',
        '**/tests/server-*.test.js',
        '**/website/tests/functions/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-node.js'],
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/website/tests/frontend/**/*.test.js',
        '**/tests/integration/**/*.test.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-jsdom.js'],
    },
  ],
};
