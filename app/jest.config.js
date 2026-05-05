/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/lib/'],
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Redireciona QUALQUER import de config/firebase para o mock
    '^.*/config/firebase$': '<rootDir>/src/__tests__/__mocks__/firebase-module',
  },
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/dev.ts',
    '!src/dev-tunnel.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
};

module.exports = config;
