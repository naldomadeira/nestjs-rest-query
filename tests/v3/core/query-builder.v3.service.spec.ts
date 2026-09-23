import { BadRequestException } from '@nestjs/common';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { calls, fakeSource } from '../fixtures/fake-adapter';
import { RULES_PRESETS } from '../fixtures/rules';
import { defineQuerySchema } from '@core/schema';
import type { ProfileFacts } from '@core/portability';
import { defineQueryRules } from '@core/authorization';
import { CORPUS_SCHEMAS } from '../fixtures/schemas';

const rules = RULES_PRESETS['user.default'];

const validProfile: ProfileFacts = {
  dialect: 'postgres',
  serverVersion: '18.0',
  encoding: 'UTF8',
  sessionTimeZone: 'UTC',
  clientDateTimeIsUtc: true,
  strictMode: true,
  textColumns: [
    { table: 'users', column: 'name', collation: 'C' },
    { table: 'users', column: 'name_folded', collation: 'C' },
  ],
  indexes: ['users_name_folded_idx'],
  requiredIndexes: ['users_name_folded_idx'],
};

describe('QueryBuilderService (v3)', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('executa o plano e devolve QueryResult canônico', async () => {
    const service = new QueryBuilderService({});
    const result = await service.execute(fakeSource(), {}, rules);
    expect(result).toEqual({
      data: [{ id: 1, name: 'Ada' }],
      page: 1,
      perPage: 10,
      total: 1,
      lastPage: 1,
    });
  });

  it('transformPlan roda antes do compile e é comum a todos os adapters', async () => {
    const service = new QueryBuilderService({});
    await service.execute(fakeSource(), {}, rules, {
      transformPlan: (plan) => ({
        ...plan,
        includes: [...plan.includes, 'company'],
      }),
    });

    const compile = calls.find((c) => c.kind === 'compile');
    expect(compile).toBeDefined();
    expect(compile!.kind === 'compile' ? compile!.plan.includes : []).toEqual([
      'company',
    ]);
  });

  it('congela o plano depois de transformPlan', async () => {
    const service = new QueryBuilderService({});
    await service.execute(fakeSource(), {}, rules, {
      transformPlan: (plan) => ({ ...plan }),
    });
    const compile = calls.find((c) => c.kind === 'compile');
    expect(Object.isFrozen(compile!.kind === 'compile' && compile!.plan)).toBe(
      true
    );
  });

  it('customize declara escopo e o default seguro é both', async () => {
    const service = new QueryBuilderService({});
    await service.execute(fakeSource(), {}, rules, {
      customize: () => undefined,
    });
    expect(calls.find((c) => c.kind === 'customize')).toEqual({
      kind: 'customize',
      scope: 'both',
    });
  });

  it('customize com escopo parcial emite warning estruturado', async () => {
    const warn = jest.fn();
    const service = new QueryBuilderService({
      logging: {
        enabled: true,
        level: 'warn',
        logger: { warn, error: jest.fn(), log: jest.fn(), debug: jest.fn() },
      },
    });

    await service.execute(fakeSource(), {}, rules, {
      customize: () => undefined,
      customizeScope: 'data',
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('customize'),
      expect.objectContaining({ scope: 'data' })
    );
  });

  it('não emite warning quando o escopo é both', async () => {
    const warn = jest.fn();
    const service = new QueryBuilderService({
      logging: {
        enabled: true,
        level: 'warn',
        logger: { warn, error: jest.fn(), log: jest.fn(), debug: jest.fn() },
      },
    });
    await service.execute(fakeSource(), {}, rules, {
      customize: () => undefined,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('paginate=false devolve apenas data', async () => {
    const service = new QueryBuilderService({});
    const result = await service.execute(
      fakeSource(),
      { paginate: 'false' },
      rules
    );
    expect(Object.keys(result)).toEqual(['data']);
  });

  it('consistency transactional falha cedo quando o adapter não oferece', async () => {
    const service = new QueryBuilderService({ consistency: 'transactional' });
    await expect(
      service.execute(
        fakeSource({ transactionalConsistency: false }),
        {},
        rules
      )
    ).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }),
      })
    );
  });

  it('consistency transactional passa quando o adapter oferece', async () => {
    const service = new QueryBuilderService({ consistency: 'transactional' });
    await expect(
      service.execute(fakeSource(), {}, rules)
    ).resolves.toBeDefined();
  });

  it('valida a source descrita pelo adapter antes de compilar', async () => {
    const service = new QueryBuilderService({});
    await service.execute(fakeSource(), {}, rules);

    expect(calls.map((call) => call.kind)).toEqual([
      'describe',
      'compile',
      'execute',
    ]);
  });

  it('falha fechado quando o model físico da source não corresponde às regras', async () => {
    const service = new QueryBuilderService({});
    const wrongSchema = defineQuerySchema({
      model: 'company',
      primaryKey: ['id'],
      fields: [
        { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
      ],
      relations: [],
    });

    await expect(
      service.execute(fakeSource({}, wrongSchema), {}, rules)
    ).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'SOURCE_CONFIGURATION_INVALID',
        }),
      })
    );
    expect(calls.map((call) => call.kind)).toEqual(['describe']);
  });

  it('trata model físico incompatível como erro de configuração da source', async () => {
    const service = new QueryBuilderService({});
    const wrongSchema = defineQuerySchema({
      model: 'company',
      primaryKey: ['id'],
      fields: [
        { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
      ],
      relations: [],
    });

    await expect(
      service.execute(fakeSource({}, wrongSchema), {}, rules)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 500,
        code: 'SOURCE_CONFIGURATION_INVALID',
      }),
    });
    expect(calls.map((call) => call.kind)).toEqual(['describe']);
  });

  it('reaproveita a validação da mesma source em execuções seguintes', async () => {
    const service = new QueryBuilderService({});
    const source = fakeSource();

    await service.execute(source, {}, rules);
    await service.execute(source, {}, rules);

    expect(calls.filter((call) => call.kind === 'describe')).toHaveLength(1);
    expect(calls.filter((call) => call.kind === 'compile')).toHaveLength(2);
  });

  it('valida o perfil portável quando a configuração exige paridade certificada', async () => {
    const service = new QueryBuilderService({
      portability: { enforce: true },
    });

    await service.execute(fakeSource({}, undefined, validProfile), {}, rules);

    expect(calls.map((call) => call.kind)).toEqual([
      'describe',
      'compile',
      'execute',
    ]);
  });

  it('falha cedo quando paridade certificada é exigida sem profile na source', async () => {
    const service = new QueryBuilderService({
      portability: { enforce: true },
    });

    await expect(service.execute(fakeSource(), {}, rules)).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'PORTABILITY_PROFILE_MISMATCH',
        }),
      })
    );
    expect(calls.map((call) => call.kind)).toEqual(['describe']);
  });

  it('falha cedo quando o profile portável tem violações', async () => {
    const service = new QueryBuilderService({
      portability: { enforce: true },
    });

    await expect(
      service.execute(
        fakeSource({}, undefined, {
          ...validProfile,
          sessionTimeZone: 'America/Fortaleza',
        }),
        {},
        rules
      )
    ).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'PORTABILITY_PROFILE_MISMATCH',
        }),
      })
    );
    expect(calls.map((call) => call.kind)).toEqual(['describe']);
  });

  it('converte erro de input em BadRequestException com o envelope', async () => {
    const service = new QueryBuilderService({});
    await expect(
      service.execute(fakeSource(), { page: '0' }, rules)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redige valores no log por default', async () => {
    const debug = jest.fn();
    const service = new QueryBuilderService({
      logging: {
        enabled: true,
        level: 'debug',
        logger: { debug, warn: jest.fn(), error: jest.fn(), log: jest.fn() },
      },
    });

    await service.execute(
      fakeSource(),
      { filter: { name: { eq: 'segredo' } }, search: 'outro-segredo' },
      rules
    );

    const logged = JSON.stringify(debug.mock.calls);
    expect(logged).not.toContain('segredo');
    expect(logged).toContain('name:eq');
  });

  it('respeita a paginação da configuração global', async () => {
    const service = new QueryBuilderService({
      pagination: { defaultPerPage: 5, maxPerPage: 10 },
    });
    const result = await service.execute(fakeSource(), {}, rules);
    expect(result.perPage).toBe(5);
  });

  it('buildPlan expõe o plano sem executar nada', () => {
    const service = new QueryBuilderService({});
    const plan = service.buildPlan({ sort: 'name' }, rules);
    expect(plan.sorts).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });
});

/**
 * Bug #6 do relato de consumidor externo: `GET /v1/products?paginate=false`
 * devolvia a tabela inteira (`ORDER BY` sem `LIMIT`), ignorando `maxPerPage`, e
 * nenhuma regra de endpoint conseguia desligar isso.
 */
describe('regression: unpaginated global cap (consumer report #6) — service', () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: `u${index + 1}`,
    }));

  /** Adapter que ignora `maxRows` e devolve o que o banco tiver. */
  function sourceReturning(count: number) {
    const source = fakeSource();
    return {
      ...source,
      adapter: {
        ...source.adapter,
        execute: async () => ({ rows: rows(count), queryCount: 1 }),
      },
    };
  }

  const endpoint = (pagination?: {
    allowUnpaginated?: boolean;
    maxUnpaginatedRows?: number;
  }) =>
    defineQueryRules(CORPUS_SCHEMAS, 'user', {
      sorts: ['id'],
      fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
      ...(pagination ? { pagination } : {}),
    });

  const refusal = (maxRows?: number) =>
    expect.objectContaining({
      response: expect.objectContaining({
        code: 'PAGINATION_INVALID',
        details: maxRows
          ? { param: 'paginate', maxRows }
          : { param: 'paginate' },
      }),
    });

  it('sem configuração, o teto é o maxPerPage default (100)', async () => {
    const service = new QueryBuilderService({});

    await expect(
      service.execute(sourceReturning(100), { paginate: 'false' }, endpoint())
    ).resolves.toEqual({ data: rows(100) });
    await expect(
      service.execute(sourceReturning(101), { paginate: 'false' }, endpoint())
    ).rejects.toEqual(refusal(100));
  });

  it('o teto global de forRoot vale para todo endpoint', async () => {
    const service = new QueryBuilderService({
      pagination: { maxUnpaginatedRows: 3 },
    });

    await expect(
      service.execute(sourceReturning(4), { paginate: 'false' }, endpoint())
    ).rejects.toEqual(refusal(3));
  });

  it('o endpoint substitui o teto global', async () => {
    const service = new QueryBuilderService({
      pagination: { maxUnpaginatedRows: 3 },
    });

    await expect(
      service.execute(
        sourceReturning(4),
        { paginate: 'false' },
        endpoint({ maxUnpaginatedRows: 10 })
      )
    ).resolves.toEqual({ data: rows(4) });
  });

  it('o endpoint pode proibir paginate=false, e nada chega ao adapter', async () => {
    const service = new QueryBuilderService({});

    await expect(
      service.execute(
        sourceReturning(1),
        { paginate: 'false' },
        endpoint({ allowUnpaginated: false })
      )
    ).rejects.toEqual(refusal());
    expect(calls.some((call) => call.kind === 'execute')).toBe(false);
  });

  it('forRoot pode proibir paginate=false e um endpoint reabrir', async () => {
    const service = new QueryBuilderService({
      pagination: { allowUnpaginated: false },
    });

    await expect(
      service.execute(sourceReturning(1), { paginate: 'false' }, endpoint())
    ).rejects.toEqual(refusal());
    await expect(
      service.execute(
        sourceReturning(1),
        { paginate: 'false' },
        endpoint({ allowUnpaginated: true })
      )
    ).resolves.toEqual({ data: rows(1) });
  });

  it('respostas paginadas não são afetadas pelo teto', async () => {
    const service = new QueryBuilderService({
      pagination: { maxUnpaginatedRows: 1 },
    });

    await expect(
      service.execute(sourceReturning(1), { perPage: '50' }, endpoint())
    ).resolves.toEqual(expect.objectContaining({ perPage: 50 }));
  });
});
