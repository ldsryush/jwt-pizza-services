module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config.js',
    '!src/version.json'
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  testMatch: ['**/*.test.js'],
  verbose: true
};
