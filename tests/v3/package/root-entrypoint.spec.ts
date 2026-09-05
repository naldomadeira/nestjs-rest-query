describe('entrypoint raiz', () => {
  it('não carrega nenhum peer de ORM', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../../src/index');
    });

    const loaded = Object.keys(require.cache).join('\n');
    expect(loaded).not.toMatch(/node_modules[\\/].*[\\/]typeorm[\\/]/);
    expect(loaded).not.toMatch(/node_modules[\\/].*[\\/]drizzle-orm[\\/]/);
    expect(loaded).not.toMatch(/node_modules[\\/].*[\\/]@prisma[\\/]/);
  });

  it('não exporta classes runtime de adapter', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('../../../src/index') as Record<string, unknown>;
    for (const name of ['TypeOrmAdapter', 'DrizzleAdapter', 'PrismaAdapter']) {
      expect(api[name]).toBeUndefined();
    }
  });

  it('exporta a superfície v3 documentada', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('../../../src/index') as Record<string, unknown>;
    for (const name of [
      'DynamicQueryBuilderModule',
      'QueryBuilderService',
      'defineQuerySchema',
      'defineQueryRules',
      'buildQueryPlan',
      'foldText',
      'RestQueryError',
      'RestQueryErrorCode',
      'toHttpException',
      'checkPortabilityProfile',
      'CivilDate',
      'DecimalValue',
      'ApiDynamicQuery',
      'DynamicQuery',
      'QueryRules',
      'ApiPaginatedResponse',
      'DynamicQueryDto',
      'Operator',
      'ALL_OPERATORS',
    ]) {
      expect(api[name]).toBeDefined();
    }
  });

  it('não exporta a superfície removida da v2', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('../../../src/index') as Record<string, unknown>;
    for (const name of ['ErrorMessages', 'operatorRegistry']) {
      expect(api[name]).toBeUndefined();
    }
  });
});
