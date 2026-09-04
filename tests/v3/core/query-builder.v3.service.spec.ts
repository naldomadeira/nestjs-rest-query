import { BadRequestException } from '@nestjs/common';
import { QueryBuilderService } from '@core/query-builder.v3.service';
import { calls, fakeSource } from '../fixtures/fake-adapter';
import { RULES_PRESETS } from '../fixtures/rules';

const rules = RULES_PRESETS['user.default'];

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
      perPage: 20,
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
