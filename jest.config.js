module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['./tests/setup.js'],
  setupFilesAfterEnv: ['./tests/setupAfterEnv.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'shared/**/*.js',
    'background.js',
    '!**/node_modules/**',
    '!jest.config.js',
  ],
};
