import { buildQueryPlan } from '@core/query-plan';
import { RULES_PRESETS } from '../../fixtures/rules';
import {
  DrizzleAdapter,
  createDrizzleTable,
  drizzleSource,
  type DrizzleDatabase,
  type DrizzleTable,
} from '@infra/adapters/drizzle';

const users = createDrizzleTable({
  name: 'users',
  model: 'user',
  columns: {
    id: { name: 'id', kind: 'integer', primaryKey: true, nullable: false },
    name: {
      name: 'name',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      foldedField: 'name_folded',
    },
    name_folded: {
      name: 'name_folded',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      internal: true,
    },
    email: {
      name: 'email',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      foldedField: 'email_folded',
    },
    email_folded: {
      name: 'email_folded',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      internal: true,
    },
  },
});

const posts = createDrizzleTable({
  name: 'posts',
  model: 'post',
  columns: {
    id: { name: 'id', kind: 'uuid', primaryKey: true, nullable: false },
    title: {
      name: 'title',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      foldedField: 'title_folded',
    },
    title_folded: {
      name: 'title_folded',
      kind: 'string',
      primaryKey: false,
      nullable: false,
      internal: true,
    },
    user_id: {
      name: 'user_id',
      kind: 'integer',
      primaryKey: false,
      nullable: false,
    },
  },
});

function db(rows: readonly object[] = []): DrizzleDatabase {
  return {
    executeData: jest.fn().mockResolvedValue(rows),
    executeCount: jest.fn().mockResolvedValue(rows.length),
  };
}

function source(database = db()): ReturnType<typeof drizzleSource> {
  return drizzleSource({
    db: database,
    dialect: 'mysql',
    table: users,
    relations: {
      posts: {
        target: posts,
        cardinality: 'many',
        nullable: true,
        sourceColumn: 'id',
        targetColumn: 'user_id',
      },
    },
  });
}

describe('DrizzleAdapter', () => {
  it('cria source discriminada com schema derivado de tabela e relações explícitas', async () => {
    const created = source();

    expect(created.kind).toBe('drizzle');
    await expect(
      created.adapter.describe(created.input)
    ).resolves.toMatchObject({
      model: 'user',
      primaryKey: ['id'],
    });
  });

  it('compila busca e ilike em MySQL usando folded field e LIKE literal, nunca ILIKE', () => {
    const adapter = new DrizzleAdapter();
    const plan = buildQueryPlan(
      {
        filter: { name: { ilike: 'Ada' } },
        search: 'Grace',
        sort: '-name',
      },
      RULES_PRESETS['user.default']
    );

    const compiled = adapter.compile(plan, source().input);
    const serialized = JSON.stringify(compiled.data);

    expect(serialized).not.toContain('ILIKE');
    expect(compiled.data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'like',
          column: 'users.name_folded',
          value: '%ada%',
          escape: '!',
          negated: false,
        },
        {
          op: 'or',
          terms: [
            {
              op: 'like',
              column: 'users.name_folded',
              value: '%grace%',
              escape: '!',
              negated: false,
            },
            {
              op: 'like',
              column: 'users.email_folded',
              value: '%grace%',
              escape: '!',
              negated: false,
            },
          ],
        },
      ],
    });
  });

  it('compila relação many como condição existencial', () => {
    const adapter = new DrizzleAdapter();
    const plan = buildQueryPlan(
      { filter: { 'posts.title': { eq: 'COBOL' } } },
      RULES_PRESETS['user.deep']
    );

    expect(adapter.compile(plan, source().input).data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'exists',
          relation: 'posts',
          sourceColumn: 'users.id',
          targetColumn: 'posts.user_id',
          where: {
            op: 'compare',
            column: 'posts.title',
            comparator: '=',
            value: 'COBOL',
          },
          negated: false,
        },
      ],
    });
  });

  it('executa data e count com o mesmo statement pós-customização', async () => {
    const database = db([{ id: 1, name: 'Ada' }]);
    const created = source(database);
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const adapter = new DrizzleAdapter();
    const compiled = adapter.compile(plan, created.input);

    adapter.customize(compiled, (native) => {
      native.statement.where = {
        op: 'compare',
        column: 'users.active',
        comparator: '=',
        value: true,
      };
    });

    const result = await adapter.execute(compiled);

    expect(database.executeData).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          op: 'compare',
          column: 'users.active',
          comparator: '=',
          value: true,
        },
      })
    );
    expect(database.executeCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          op: 'compare',
          column: 'users.active',
          comparator: '=',
          value: true,
        },
      })
    );
    expect(result).toEqual({
      rows: [{ id: 1, name: 'Ada' }],
      total: 1,
      queryCount: 2,
    });
  });
});
