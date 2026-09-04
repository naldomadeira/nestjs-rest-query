import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['ts', 'js'],
  testRegex: '.*\\.(spec|test)\\.ts$',
  // A integração real vive em jest.integration.config.ts: ela exige os bancos
  // do perfil certificado no ar, e deixá-la aqui reportaria 66 skips a cada
  // execução local.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.claude/',
    '/apps/',
    '/tests/v3/integration/',
  ],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  coverageReporters: ['json-summary', 'text', 'lcov', 'cobertura', 'html'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@domain/handlers$': '<rootDir>/src/domain/handlers/index.ts',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@contracts$': '<rootDir>/src/contracts/index.ts',
    '^@contracts/v3$': '<rootDir>/src/contracts/v3/index.ts',
    '^@contracts/(.*)$': '<rootDir>/src/contracts/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
  },
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/test/',
    '/tests/',
    'index.ts$',
    '.module.ts$',
    '.interface.ts$',
    '.dto.ts$',
    '.entity.ts$',
    '.mock.ts$',
    'main.ts$',
    '.config.ts$',
    'logger.util.ts$',
    'query-rules.decorator.ts$',
  ],
};

export default config;
