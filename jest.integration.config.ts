import type { Config } from 'jest';
import base from './jest.config';

/**
 * Suíte de integração real (spec §19).
 *
 * Separada da suíte padrão porque exige os bancos do perfil certificado no ar.
 * Sem coverage: o que importa aqui é o resultado observável, medido pelo
 * corpus, não a cobertura de linhas.
 */
const config: Config = {
  ...base,
  collectCoverage: false,
  testRegex: undefined,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testMatch: ['<rootDir>/tests/v3/integration/**/*.spec.ts'],
  testTimeout: 60_000,
  reporters: ['default', ['jest-junit', { outputName: 'integration.xml' }]],
};

export default config;
