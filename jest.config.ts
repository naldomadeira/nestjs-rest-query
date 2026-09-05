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
  // Seed fixo do `fast-check` (ver o arquivo): sem ele a cobertura oscila
  // entre execuções com a mesma contagem de testes, e um `coverageThreshold`
  // reprovaria de forma intermitente.
  setupFiles: ['<rootDir>/tests/v3/setup/fast-check.ts'],
  coverageReporters: ['json-summary', 'text', 'lcov', 'cobertura', 'html'],

  /**
   * Piso por área, não meta — e o número é o medido em 2026-09-04, arredondado
   * para baixo, não um alvo aspiracional.
   *
   * Não existe um único número para o repo porque as áreas não têm o mesmo
   * papel. Os adapters entram em **100%** de propósito: é a promessa de
   * paridade da §5 que passa por eles, foram medidos a 100% depois do PR5, e
   * catraca é o único regime que impede erosão silenciosa — ramo novo sem
   * teste reprova no mesmo PR que o introduziu.
   *
   * `src/api` a 62% de branches é o número honesto, não um descuido
   * escondido: é a superfície de Swagger, que não é caminho crítico do gate da
   * §23 e está nomeada como dívida em `docs/v3/status.md`. Declará-la aqui
   * pelo valor real é o que impede a área de piorar sem ninguém notar — que é
   * exatamente o que aconteceu enquanto ela não tinha piso nenhum.
   *
   * O `global` é catch-all: pega o que não casa nenhum grupo acima (hoje
   * `domain/operators` e `infra/structured-logger.ts`) e cobre diretório novo
   * que apareça sem piso próprio.
   *
   * Pré-requisito que não é opcional: o seed do `fast-check`
   * (`tests/v3/setup/fast-check.ts`). Sem ele a cobertura oscila entre
   * execuções com a mesma contagem de testes, e um piso reprovaria de forma
   * intermitente quem não mexeu em nada.
   */
  coverageThreshold: {
    './src/infra/adapters/': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/core/': {
      statements: 95,
      branches: 91,
      functions: 98,
      lines: 96,
    },
    './src/api/': {
      statements: 90,
      branches: 62,
      functions: 96,
      lines: 93,
    },
    global: {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
  },
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
    // O generator "prisma-client" emite import specifiers com `.js` (regra
    // NodeNext) para arquivos `.ts` — o próprio tsc resolve isso, mas o
    // resolver do Jest não. Sem este mapeamento, requerer o client Prisma
    // gerado falha com "Cannot find module './internal/class.js'".
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
