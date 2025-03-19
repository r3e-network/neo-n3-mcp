module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/functions/**/*.test.js',
    '**/frontend/**/*.test.js'
  ],
  moduleNameMapper: {
    // For static assets in tests
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/mocks/fileMock.js',
    '\\.(css|less|scss)$': '<rootDir>/mocks/styleMock.js'
  },
  testPathIgnorePatterns: ['/node_modules/'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  watchPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  transform: {},
  // Configure different test environments for different test paths
  projects: [
    {
      displayName: 'functions',
      testMatch: ['<rootDir>/functions/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/frontend/**/*.test.js'],
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        url: 'http://localhost/'
      }
    }
  ]
}; 