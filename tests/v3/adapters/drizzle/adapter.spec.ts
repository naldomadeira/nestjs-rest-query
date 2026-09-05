import { QueryBuilderService } from '@core/query-builder.v3.service';
import { buildQueryPlan } from '@core/query-plan';
import type { PlanFilter } from '@core/semantic-validator';
import {
  DrizzleAdapter,
  DrizzleJoinPlanner,
  drizzleSource,
  scalarCondition,
  type DrizzleDatabase,
  type DrizzleColumnRef,
  type DrizzleSourceInput,
  type DrizzleStatement,
} from '@infra/adapters/drizzle';
import { defineQueryRules } from '@core/authorization';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import {
  companiesTable,
  userRelations,
  usersTable,
} from '../../fixtures/drizzle-tables';

function db(rows: readonly object[] = []): DrizzleDatabase {
  return {
    executeData: jest.fn().mockResolvedValue(rows),
    executeCount: jest.fn().mockResolvedValue(rows.length),
  };
}

function input(
  overrides: Partial<DrizzleSourceInput> = {}
): DrizzleSourceInput {
  return drizzleSource({
    db: db(),
    dialect: 'postgres',
    table: usersTable,
    relations: userRelations,
    ...overrides,
  }).input;
}

function compile(
  query: Parameters<typeof buildQueryPlan>[0],
  preset = 'user.deep',
  source: DrizzleSourceInput = input()
): { data: DrizzleStatement; count: DrizzleStatement } {
  const plan = buildQueryPlan(query, RULES_PRESETS[preset]);
  const compiled = new DrizzleAdapter().compile(plan, source);
  return { data: compiled.data, count: compiled.count };
}

describe('drizzleSource', () => {
  it('deriva o schema lógico das colunas declaradas', async () => {
    const source = drizzleSource({
      db: db(),
      dialect: 'postgres',
      table: usersTable,
      relations: userRelations,
    });

    const schema = await source.adapter.describe(source.input);

    expect(source.kind).toBe('drizzle');
    expect(schema.model).toBe('user');
    expect(schema.primaryKey).toEqual(['id']);
    expect(schema.fields.get('name')?.foldedField).toBe('name_folded');
    expect(schema.fields.get('name_folded')?.internal).toBe(true);
    expect(schema.fields.get('nickname')?.nullable).toBe(true);
  });

  it('mantém apenas relações de primeiro nível no schema do root', async () => {
    const source = drizzleSource({
      db: db(),
      dialect: 'postgres',
      table: usersTable,
      relations: userRelations,
    });

    const schema = await source.adapter.describe(source.input);

    expect([...schema.relations.keys()]).toEqual(['company', 'posts']);
    expect(schema.relations.get('posts')?.cardinality).toBe('many');
  });

  it('recusa um salto profundo sem o prefixo declarado', () => {
    expect(() =>
      drizzleSource({
        db: db(),
        dialect: 'postgres',
        table: usersTable,
        relations: {
          'company.owner': {
            target: usersTable,
            cardinality: 'one',
            nullable: true,
            sourceColumn: 'owner_id',
            targetColumn: 'id',
          },
        },
      })
    ).toThrow('has no declared parent company');
  });

  it('aceita source sem relações declaradas', async () => {
    const source = drizzleSource({
      db: db(),
      dialect: 'mysql',
      table: companiesTable,
    });

    const schema = await source.adapter.describe(source.input);
    expect(schema.relations.size).toBe(0);
  });
});

describe('DrizzleAdapter capabilities', () => {
  it('publica o dialeto da source e nega consistência transacional', () => {
    const adapter = new DrizzleAdapter();

    expect(adapter.capabilities(input())).toEqual({
      dialect: 'postgres',
      transactionalConsistency: false,
      escapeCharacter: '!',
    });
    expect(adapter.id).toBe('drizzle');
  });
});

describe('DrizzleAdapter compile', () => {
  it('projeta o root com alias explícito e sem SELECT *', () => {
    const { data } = compile({ fields: 'id,name' }, 'user.default');

    expect(data.table).toBe('users');
    expect(data.alias).toBe('users');
    expect(data.select).toEqual([
      { alias: 'users', column: 'id', path: '' },
      { alias: 'users', column: 'name', path: '' },
    ]);
    expect(data.joins).toEqual([]);
  });

  it('junta relação one para filtro e para projeção, com um único alias', () => {
    const { data } = compile(
      {
        filter: { 'company.name': { eq: 'ACME' } },
        includes: 'company',
        fields: 'id,company.name',
      },
      'user.deep'
    );

    expect(data.joins).toEqual([
      {
        path: 'company',
        table: 'companies',
        alias: 'users__company',
        parentAlias: 'users',
        sourceColumn: 'company_id',
        targetColumn: 'id',
        kind: 'inner',
      },
    ]);
    expect(data.select).toContainEqual({
      alias: 'users__company',
      column: 'name',
      path: 'company',
    });
  });

  it('resolve cadeia profunda de relações one em junções encadeadas', () => {
    const { data } = compile(
      { includes: 'company,company.owner', fields: 'id,company.owner.name' },
      'user.deep'
    );

    expect(data.joins).toEqual([
      expect.objectContaining({ path: 'company', parentAlias: 'users' }),
      expect.objectContaining({
        path: 'company.owner',
        table: 'users',
        alias: 'users__company__owner',
        parentAlias: 'users__company',
        kind: 'left',
      }),
    ]);
    expect(data.select).toContainEqual({
      alias: 'users__company__owner',
      column: 'name',
      path: 'company.owner',
    });
  });

  it('usa junção left na apresentação e inner quando há predicado', () => {
    const presentation = compile(
      { includes: 'company', fields: 'id,company.name' },
      'user.deep'
    );
    const predicate = compile(
      {
        filter: { 'company.name': { eq: 'ACME' } },
        includes: 'company',
        fields: 'id,company.name',
      },
      'user.deep'
    );

    expect(presentation.data.joins[0].kind).toBe('left');
    expect(predicate.data.joins[0].kind).toBe('inner');
  });

  it('nunca junta relação many: filtro vira EXISTS correlacionado', () => {
    const { data } = compile(
      { filter: { 'posts.title': { eq: 'COBOL' } } },
      'user.deep'
    );

    expect(data.joins).toEqual([]);
    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'exists',
          relationPath: ['posts'],
          joins: [
            {
              path: 'posts',
              table: 'posts',
              alias: 'users__posts__x',
              parentAlias: 'users',
              sourceColumn: 'id',
              targetColumn: 'user_id',
              kind: 'inner',
            },
          ],
          where: {
            op: 'compare',
            ref: { alias: 'users__posts__x', column: 'title' },
            comparator: '=',
            value: 'COBOL',
          },
          negated: false,
        },
      ],
    });
  });

  it('trata isNull de relação many como EXISTS negado', () => {
    const { data } = compile({ filter: { posts: { isNull: 'true' } } });

    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'exists',
          relationPath: ['posts'],
          joins: [
            expect.objectContaining({ path: 'posts', parentAlias: 'users' }),
          ],
          negated: true,
        },
      ],
    });
  });

  it('mantém a relação terminal one dentro da subconsulta de presença', () => {
    const { data } = compile({ filter: { company: { isNull: 'false' } } });

    expect(data.joins).toEqual([]);
    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'exists',
          relationPath: ['company'],
          joins: [
            expect.objectContaining({
              path: 'company',
              alias: 'users__company__x',
              parentAlias: 'users',
            }),
          ],
          negated: false,
        },
      ],
    });
  });

  it('correlaciona a presença profunda a partir da junção do pai', () => {
    const deepPresence = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      filters: [{ path: 'company.owner', operators: ['isNull'] }],
      sorts: ['id'],
      fields: { root: { allowed: ['id'], default: ['id'] } },
    });
    const plan = buildQueryPlan(
      { filter: { 'company.owner': { isNull: 'true' } } },
      deepPresence
    );
    const { data } = new DrizzleAdapter().compile(plan, input());

    expect(data.joins).toEqual([
      expect.objectContaining({ path: 'company', kind: 'inner' }),
    ]);
    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'exists',
          relationPath: ['company', 'owner'],
          joins: [
            expect.objectContaining({
              path: 'company.owner',
              alias: 'users__company__owner__x',
              parentAlias: 'users__company',
            }),
          ],
          negated: true,
        },
      ],
    });
  });

  it('compara a coluna dobrada com LIKE escapado, nunca ILIKE', () => {
    const { data } = compile(
      { filter: { name: { ilike: '10%_A' } } },
      'user.deep'
    );

    expect(JSON.stringify(data)).not.toContain('ilike');
    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'like',
          ref: { alias: 'users', column: 'name_folded' },
          value: '%10!%!_a%',
          escape: '!',
          negated: false,
        },
      ],
    });
  });

  it('espalha o search em OR sobre as colunas dobradas', () => {
    const { data } = compile({ search: 'Ada' }, 'user.deep');

    expect(data.where).toEqual({
      op: 'and',
      terms: [
        {
          op: 'or',
          terms: [
            expect.objectContaining({
              ref: { alias: 'users', column: 'name_folded' },
              value: '%ada%',
            }),
            expect.objectContaining({
              ref: { alias: 'users', column: 'email_folded' },
              value: '%ada%',
            }),
          ],
        },
      ],
    });
  });

  it('converte in, between e isNull escalar', () => {
    const { data } = compile(
      {
        filter: {
          id: { in: '1,2', between: '4,9' },
          nickname: { isNull: 'true' },
        },
      },
      'user.default'
    );

    expect(data.where?.op).toBe('and');
    const terms = (data.where as unknown as { terms: unknown[] }).terms;
    expect(terms).toContainEqual({
      op: 'in',
      ref: { alias: 'users', column: 'id' },
      values: [1, 2],
    });
    expect(terms).toContainEqual({
      op: 'between',
      ref: { alias: 'users', column: 'id' },
      from: 4,
      to: 9,
    });
    expect(terms).toContainEqual({
      op: 'null',
      ref: { alias: 'users', column: 'nickname' },
      negated: false,
    });
  });

  it('marca in vazio como sempre falso e notIn vazio como sempre verdadeiro', () => {
    const alwaysFalse = compile({ filter: { id: { in: '' } } }, 'user.default');
    const alwaysTrue = compile(
      { filter: { id: { notIn: '' } } },
      'user.default'
    );

    expect(alwaysFalse.data.where).toEqual({
      op: 'and',
      terms: [{ op: 'alwaysFalse' }],
    });
    expect(alwaysTrue.data.where).toEqual({
      op: 'and',
      terms: [{ op: 'alwaysTrue' }],
    });
  });

  it('serializa bigint, decimal e data para valores de bind', () => {
    const { data } = compile(
      {
        filter: {
          score: { eq: '9007199254740993' },
          balance: { eq: '10.50' },
          born_on: { eq: '1815-12-10' },
        },
      },
      'user.default'
    );

    const terms = (data.where as unknown as { terms: { value: unknown }[] })
      .terms;
    expect(terms.map((term) => term.value)).toEqual([
      '9007199254740993',
      '10.50',
      '1815-12-10',
    ]);
  });

  it('ordena por sorts mais tie-break do plano', () => {
    const { data } = compile({ sort: '-name' }, 'user.default');

    expect(data.orderBy).toEqual([
      { alias: 'users', column: 'name', direction: 'desc' },
      { alias: 'users', column: 'id', direction: 'asc' },
    ]);
  });

  it('traduz page e perPage para limit e offset', () => {
    const { data, count } = compile(
      { page: '3', perPage: '5' },
      'user.default'
    );

    expect(data.limit).toBe(5);
    expect(data.offset).toBe(10);
    expect(count.countOnly).toBe(true);
    expect(count.limit).toBeUndefined();
    expect(count.orderBy).toEqual([]);
  });

  it('deixa o count só com as junções de predicado', () => {
    const { data, count } = compile(
      {
        filter: { 'company.name': { eq: 'ACME' } },
        includes: 'company,company.owner',
        fields: 'id,company.name,company.owner.name',
      },
      'user.deep'
    );

    expect(data.joins.map((join) => join.path)).toEqual([
      'company',
      'company.owner',
    ]);
    expect(count.joins.map((join) => join.path)).toEqual(['company']);
    expect(count.where).toEqual(data.where);
  });

  it('falha fechado ao projetar através de relação many', () => {
    expect(() =>
      compile({ includes: 'posts', fields: 'id,posts.title' }, 'user.deep')
    ).toThrow('cannot project through the to-many relation posts');
  });

  it('falha fechado quando a relação do plano não foi declarada na source', () => {
    const partial = drizzleSource({
      db: db(),
      dialect: 'postgres',
      table: usersTable,
      relations: {
        company: userRelations.company,
        'company.owner': userRelations['company.owner'],
      },
    }).input;

    expect(() =>
      compile({ filter: { 'posts.title': { eq: 'x' } } }, 'user.deep', partial)
    ).toThrow('has no relation declared for path posts');
  });
});

describe('scalarCondition', () => {
  const ref: DrizzleColumnRef = { alias: 'users', column: 'score' };

  function filterWith(overrides: Partial<PlanFilter>): PlanFilter {
    return {
      path: 'score',
      target: 'scalar',
      relationPath: [],
      column: 'score',
      field: null,
      relation: null,
      operator: 'eq',
      value: 1,
      existential: false,
      literalPattern: false,
      alwaysFalse: false,
      alwaysTrue: false,
      ...overrides,
    } as PlanFilter;
  }

  it.each([
    ['eq', '='],
    ['ne', '<>'],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
  ] as const)('mapeia %s para o comparador %s', (operator, comparator) => {
    expect(scalarCondition(ref, filterWith({ operator }), '!')).toEqual({
      op: 'compare',
      ref,
      comparator,
      value: 1,
    });
  });

  it.each(['notIn', 'in'] as const)('mapeia %s para lista', (operator) => {
    expect(
      scalarCondition(ref, filterWith({ operator, value: [1, 2] }), '!')
    ).toEqual({ op: operator, ref, values: [1, 2] });
  });

  it.each(['notLike', 'notIlike'] as const)(
    'nega o padrão em %s',
    (operator) => {
      expect(
        scalarCondition(ref, filterWith({ operator, value: 'a%' }), '!')
      ).toEqual({
        op: 'like',
        ref,
        value: '%a!%%',
        escape: '!',
        negated: true,
      });
    }
  );

  it('recusa operador que o adapter não compila', () => {
    expect(() =>
      scalarCondition(
        ref,
        filterWith({ operator: 'search' as PlanFilter['operator'] }),
        '!'
      )
    ).toThrow('Drizzle adapter cannot compile operator search');
  });
});

describe('DrizzleJoinPlanner', () => {
  it('recusa juntar através de uma relação many', () => {
    const planner = new DrizzleJoinPlanner(usersTable, userRelations);

    expect(() => planner.join(['posts'], 'predicate')).toThrow(
      'cannot join through the to-many relation posts'
    );
  });
});

describe('DrizzleAdapter execute', () => {
  it('executa data e count e aplica customize às duas queries', async () => {
    const database = db([{ id: 1, name: 'Ada' }]);
    const source = drizzleSource({
      db: database,
      dialect: 'postgres',
      table: usersTable,
      relations: userRelations,
    });
    const service = new QueryBuilderService({});

    const result = await service.execute(
      source,
      { fields: 'id,name' },
      RULES_PRESETS['user.default'],
      {
        customize: (native) => {
          native.statement.where = {
            op: 'compare',
            ref: { alias: 'users', column: 'active' },
            comparator: '=',
            value: true,
          };
        },
      }
    );

    expect(database.executeData).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ op: 'compare' }),
      })
    );
    expect(database.executeCount).toHaveBeenCalledWith(
      expect.objectContaining({ countOnly: true })
    );
    expect(result.data).toEqual([{ id: 1, name: 'Ada' }]);
    expect(result.total).toBe(1);
  });

  it('customize com escopo único atinge apenas aquela query', () => {
    const adapter = new DrizzleAdapter();
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());
    const seen: string[] = [];

    adapter.customize(compiled, (native) => seen.push(native.kind), 'data');
    adapter.customize(compiled, (native) => seen.push(native.kind), 'count');

    expect(seen).toEqual(['data', 'count']);
  });

  it('não consulta o count quando o plano não pagina', async () => {
    const database = db([{ id: 1, name: 'Ada' }]);
    const plan = buildQueryPlan(
      { paginate: 'false' },
      RULES_PRESETS['user.default']
    );
    const adapter = new DrizzleAdapter();
    const compiled = adapter.compile(
      plan,
      input({ db: database } as Partial<DrizzleSourceInput>)
    );

    const result = await adapter.execute({ ...compiled, db: database });

    expect(database.executeCount).not.toHaveBeenCalled();
    expect(result.total).toBeUndefined();
    expect(result.queryCount).toBe(1);
  });
});
