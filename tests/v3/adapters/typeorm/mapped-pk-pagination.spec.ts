import { DataSource, EntitySchema, type ObjectLiteral } from 'typeorm';
import { defineQueryRules } from '@core/authorization';
import { buildQueryPlan } from '@core/query-plan';
import { normalizeResult } from '@core/result-normalizer';
import {
  buildSchemaRegistry,
  compilePlan,
  executeCompiled,
} from '@infra/adapters/typeorm';
import { ESCAPE_CHARACTER } from './helpers';

/**
 * Paginação em duas fases com PK cujo nome físico difere da propriedade.
 *
 * `getRawMany` nomeia as colunas cruas por `alias_<databaseName>`, não por
 * `alias_<propertyName>`. Com `userId` mapeado para `user_id`, ler a chave da
 * fase 1 pelo nome da propriedade dava `[undefined]`, a fase 2 restringia por
 * `undefined` e a página voltava vazia com `total` certo.
 */
const member = new EntitySchema<ObjectLiteral>({
  name: 'member',
  tableName: 'members',
  columns: {
    userId: {
      type: 'integer',
      primary: true,
      generated: 'increment',
      name: 'user_id',
    },
    displayName: { type: 'varchar', name: 'display_name' },
  },
  relations: {
    badges: { type: 'one-to-many', target: 'badge', inverseSide: 'member' },
  },
});

const badge = new EntitySchema<ObjectLiteral>({
  name: 'badge',
  tableName: 'badges',
  columns: {
    badgeId: { type: 'integer', primary: true, name: 'badge_id' },
    title: { type: 'varchar' },
  },
  relations: {
    member: {
      type: 'many-to-one',
      target: 'member',
      inverseSide: 'badges',
      nullable: false,
      joinColumn: { name: 'member_user_id', referencedColumnName: 'userId' },
    },
  },
});

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: [member, badge],
  });
  await dataSource.initialize();

  await dataSource
    .getRepository(member)
    .insert([
      { displayName: 'ana' },
      { displayName: 'bia' },
      { displayName: 'caio' },
    ]);
  await dataSource.getRepository(badge).insert([
    { badgeId: 1, title: 'first', member: { userId: 1 } },
    { badgeId: 2, title: 'second', member: { userId: 1 } },
    { badgeId: 3, title: 'third', member: { userId: 3 } },
  ]);
}, 60_000);

afterAll(async () => {
  if (dataSource?.isInitialized) await dataSource.destroy();
});

async function run(query: Record<string, unknown>) {
  const repository = dataSource.getRepository(member);
  const rules = defineQueryRules(buildSchemaRegistry(repository), 'member', {
    sorts: ['userId', 'displayName'],
    fields: {
      root: {
        allowed: ['userId', 'displayName'],
        default: ['userId', 'displayName'],
      },
      relations: {
        badges: { allowed: ['badgeId', 'title'], default: ['badgeId'] },
      },
    },
    includes: ['badges'],
  });
  const plan = buildQueryPlan(query, rules);
  const compiled = compilePlan(plan, repository, ESCAPE_CHARACTER);
  const result = await executeCompiled(compiled);
  return normalizeResult<Record<string, unknown>>(
    result.rows,
    result.total,
    plan
  );
}

describe('paginação em duas fases com PK de nome físico diferente', () => {
  it('devolve os roots da página, não uma página vazia', async () => {
    const result = await run({ includes: 'badges', page: '1', perPage: '2' });

    expect(result.total).toBe(3);
    expect(result.data.map((row) => row.userId)).toEqual([1, 2]);
    expect(result.data[0].badges).toEqual([{ badgeId: 1 }, { badgeId: 2 }]);
    expect(result.data[1].badges).toEqual([]);
  });

  it('mantém a ordem da fase 1 na página seguinte', async () => {
    const result = await run({
      includes: 'badges',
      sort: '-displayName',
      page: '1',
      perPage: '2',
    });

    expect(result.data.map((row) => row.displayName)).toEqual(['caio', 'bia']);
    expect(result.data[0].badges).toEqual([{ badgeId: 3 }]);
  });
});
