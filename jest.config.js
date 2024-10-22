/** @type {import('ts-jest').JestConfigWithTsJest} */
const baseConfig = {
  preset: 'ts-jest',
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
  ],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '^main/(.*)$': '<rootDir>/src/main/$1',
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '^shim/(.*)$': '<rootDir>/src/shim/$1',
  },
  setupFilesAfterEnv: [
    './scripts/setup-jest.ts',
  ],
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  transform: {
    '\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  maxWorkers: 1,
};

module.exports = {
  projects: [
    {
      ...baseConfig,
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/main/**/*.test.ts',
      ],
    },
    {
      ...baseConfig,
      displayName: 'renderer',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/renderer/**/*.test.ts',
      ],
    },
  ],
};