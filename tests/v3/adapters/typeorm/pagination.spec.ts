import type { ObjectLiteral } from 'typeorm';
import { buildQueryPlan } from '@core/query-plan';
import {
  compilePlan,
  executeCompiled,
  TypeOrmAdapter,
} from '@infra/adapters/typeorm';
import { normalizeResult } from '@core/result-normalizer';
import { RULES_PRESETS } from '../../fixtures/rules';
import { seedCorpus } from '../../fixtures/corpus-runner';
import {
  closeSqlite,
  corpusEntities,
  ESCAPE_CHARACTER,
  openSqlite,
  repositoryFor,
} from './helpers';

beforeAll(async () => {
  const dataSource = await openSqlite();
  await seedCorpus(dataSource, corpusEntities());
}, 60_000);

afterAll(closeSqlite);

async function run(
  query: Record<string, unknown>,
  preset = 'user.default'
): Promise<{
  queryCount: number;
  total?: number;
  lastPage?: number;
  data: Record<string, unknown>[];
}> {
  const plan = buildQueryPlan(query, RULES_PRESETS[preset]);
  const compiled = compilePlan(plan, repositoryFor(preset), ESCAPE_CHARACTER);
  const result = await executeCompiled(compiled);
  const normalized = normalizeResult<ObjectLiteral>(
    result.rows,
    result.total,
    plan
  );

  return {
    queryCount: result.queryCount!,
    total: normalized.total,
    lastPage: normalized.lastPage,
    data: normalized.data as Record<string, unknown>[],
  };
}

describe('paginação TypeORM', () => {
  it('sem join many usa uma query de dados e uma de count', async () => {
    const result = await run({ perPage: '2' });
    expect(result.queryCount).toBe(2);
    expect(result.total).toBe(11);
    expect(result.lastPage).toBe(6);
    expect(result.data).toHaveLength(2);
  });

  it('com join many usa duas de dados mais uma de count', async () => {
    const result = await run({ includes: 'posts', perPage: '2' }, 'user.deep');
    expect(result.queryCount).toBe(3);
  });

  it('total conta roots distintos, não linhas de join', async () => {
    const result = await run(
      { includes: 'posts', perPage: '100' },
      'user.deep'
    );
    expect(result.total).toBe(11);
    expect(result.data).toHaveLength(11);
  });

  it('a segunda fase preserva a ordem escolhida pela primeira', async () => {
    const result = await run(
      { includes: 'posts', sort: '-code', perPage: '5' },
      'user.deep'
    );
    expect(result.data.map((row) => row.id)).toEqual([11, 10, 9, 8, 7]);
  });

  it('desempate por PK torna a ordem estável entre páginas', async () => {
    const first = await run({ sort: 'name', perPage: '4', page: '1' });
    const second = await run({ sort: 'name', perPage: '4', page: '2' });
    const third = await run({ sort: 'name', perPage: '4', page: '3' });

    const ids = [...first.data, ...second.data, ...third.data].map(
      (row) => row.id
    );
    expect(new Set(ids).size).toBe(11);
  });

  it('paginate=false não emite count', async () => {
    const result = await run({ paginate: 'false' });
    expect(result.queryCount).toBe(1);
    expect(result.total).toBeUndefined();
  });

  it('relação many vem hidratada e aninhada', async () => {
    const result = await run(
      { filter: { id: { eq: '1' } }, includes: 'posts' },
      'user.deep'
    );
    const posts = result.data[0].posts as unknown[];
    expect(Array.isArray(posts)).toBe(true);
    expect(posts).toHaveLength(3);
  });

  it('root sem itens na relação many recebe array vazio', async () => {
    const result = await run(
      { filter: { id: { eq: '5' } }, includes: 'posts' },
      'user.deep'
    );
    expect(result.data[0].posts).toEqual([]);
  });

  it('não introduz N+1 por include', async () => {
    const result = await run(
      { includes: 'company,posts', perPage: '5' },
      'user.deep'
    );
    expect(result.queryCount).toBeLessThanOrEqual(3);
  });

  it('customize também restringe a fase de keys da paginação many', async () => {
    const plan = buildQueryPlan(
      { includes: 'posts', perPage: '1', page: '1' },
      RULES_PRESETS['user.deep']
    );
    const repository = repositoryFor('user.deep');
    const adapter = new TypeOrmAdapter();
    const compiled = adapter.compile(plan, { repository });

    adapter.customize(
      compiled,
      (qb) => qb.andWhere('"root"."id" = :customizedId', { customizedId: 3 }),
      'data'
    );

    const result = await executeCompiled(compiled);
    const normalized = normalizeResult<ObjectLiteral>(
      result.rows,
      result.total,
      plan
    );

    expect(normalized.total).toBe(11);
    expect(
      (normalized.data as Record<string, unknown>[]).map((row) => row.id)
    ).toEqual([3]);
  });

  it('página além do fim devolve lista vazia com total correto', async () => {
    const result = await run({ page: '99', perPage: '5' });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(11);
    expect(result.lastPage).toBe(3);
  });

  it('página além do fim com join many também devolve lista vazia', async () => {
    const result = await run(
      { page: '99', perPage: '5', includes: 'posts' },
      'user.deep'
    );
    expect(result.data).toEqual([]);
    expect(result.total).toBe(11);
  });

  it('PK composta pagina de forma estável', async () => {
    const first = await run({ perPage: '2', page: '1' }, 'tag.default');
    const second = await run({ perPage: '2', page: '2' }, 'tag.default');
    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(1);
    expect(first.total).toBe(3);
  });
});
