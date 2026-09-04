import { SQLiteDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm/sql/sql';
import { buildQueryPlan } from '@core/query-plan';
import {
  DrizzleAdapter,
  assertDrizzleClient,
  drizzleDatabase,
  drizzleSource,
  toCountSql,
  toDataSql,
  toManySql,
  type DrizzleClientLike,
  type DrizzleStatement,
} from '@infra/adapters/drizzle';
import { RULES_PRESETS } from '../../fixtures/rules';
import { userRelations, usersTable } from '../../fixtures/drizzle-tables';

const dialect = new SQLiteDialect();

/** Renderiza para texto. As aspas são do SQLite; a forma é o que se testa. */
function render(query: SQL): { sql: string; params: readonly unknown[] } {
  const { sql, params } = dialect.sqlToQuery(query);
  return { sql, params };
}

function statementFor(
  query: Parameters<typeof buildQueryPlan>[0],
  preset = 'user.deep',
  sqlDialect: 'sqlite' | 'mssql' | 'postgres' = 'sqlite'
): { data: DrizzleStatement; count: DrizzleStatement } {
  const source = drizzleSource({
    db: drizzleDatabase({ client: { all: () => [] } }),
    dialect: sqlDialect,
    table: usersTable,
    relations: userRelations,
  }).input;
  const compiled = new DrizzleAdapter().compile(
    buildQueryPlan(query, RULES_PRESETS[preset]),
    source
  );
  return { data: compiled.data, count: compiled.count };
}

describe('toDataSql', () => {
  it('cita identificadores e mantém todo valor em bind', () => {
    const { data } = statementFor(
      { filter: { name: { eq: "O'Brien" } }, fields: 'id,name' },
      'user.default'
    );

    const { sql, params } = render(toDataSql(data));

    expect(sql).toContain('"users"."name" = ?');
    expect(sql).not.toContain("O'Brien");
    expect(params).toContain("O'Brien");
  });

  it('emite left join na apresentação e inner no predicado', () => {
    const presentation = statementFor({
      includes: 'company',
      fields: 'id,company.name',
    });
    const predicate = statementFor({
      filter: { 'company.name': { eq: 'ACME' } },
      includes: 'company',
      fields: 'id,company.name',
    });

    expect(render(toDataSql(presentation.data)).sql).toContain(
      'left join "companies" as "users__company" on "users"."company_id" = "users__company"."id"'
    );
    expect(render(toDataSql(predicate.data)).sql).toContain(
      'inner join "companies" as "users__company"'
    );
  });

  it('emite EXISTS correlacionado para relação many', () => {
    const { data } = statementFor({
      filter: { 'posts.title': { eq: 'COBOL' } },
    });

    const { sql } = render(toDataSql(data));

    expect(sql).toContain(
      'exists (select 1 from "posts" as "users__posts__x" where "users"."id" = "users__posts__x"."user_id"'
    );
    expect(sql).not.toContain('join "posts"');
  });

  it('nega o EXISTS quando a coleção precisa estar vazia', () => {
    const { data } = statementFor({ filter: { posts: { isNull: 'true' } } });

    expect(render(toDataSql(data)).sql).toContain('not exists (select 1');
  });

  it('emite LIKE com ESCAPE explícito, nunca ILIKE', () => {
    const { data } = statementFor({ filter: { name: { ilike: '10%' } } });
    const { sql, params } = render(toDataSql(data));

    expect(sql).toContain('"users"."name_folded" like ? escape ?');
    expect(sql).not.toContain('ilike');
    expect(params).toEqual(expect.arrayContaining(['%10!%%', '!']));
  });

  it('nega o LIKE em notLike sem duplicar o padrão', () => {
    const { data } = statementFor(
      { filter: { name: { notLike: 'a' } } },
      'user.default'
    );

    expect(render(toDataSql(data)).sql).toContain('not ("users"."name" like ?');
  });

  it('reduz in vazio a uma condição sempre falsa', () => {
    const { data } = statementFor(
      { filter: { id: { in: '' } } },
      'user.default'
    );

    expect(render(toDataSql(data)).sql).toContain('1 = 0');
  });

  it('reduz notIn vazio a uma condição sempre verdadeira', () => {
    const { data } = statementFor(
      { filter: { id: { notIn: '' } } },
      'user.default'
    );

    expect(render(toDataSql(data)).sql).toContain('1 = 1');
  });

  it('traduz in, between e null', () => {
    const { data } = statementFor(
      {
        filter: {
          id: { in: '1,2', between: '3,9' },
          nickname: { isNull: 'true' },
        },
      },
      'user.default'
    );
    const { sql } = render(toDataSql(data));

    expect(sql).toContain('"users"."id" in (?, ?)');
    expect(sql).toContain('"users"."id" between ? and ?');
    expect(sql).toContain('"users"."nickname" is null');
  });

  it('pagina com limit e offset fora do SQL Server', () => {
    const { data } = statementFor(
      { page: '3', perPage: '5' },
      'user.default',
      'postgres'
    );

    const { sql, params } = render(toDataSql(data));
    expect(sql).toContain('limit ? offset ?');
    expect(params.slice(-2)).toEqual([5, 10]);
  });

  it('pagina com OFFSET FETCH no SQL Server', () => {
    const { data } = statementFor(
      { page: '3', perPage: '5' },
      'user.default',
      'mssql'
    );

    const { sql, params } = render(toDataSql(data));
    expect(sql).toContain('offset ? rows fetch next ? rows only');
    expect(params.slice(-2)).toEqual([10, 5]);
  });

  it('recusa paginar no SQL Server sem ordenação', () => {
    const { data } = statementFor(
      { page: '2', perPage: '5' },
      'user.default',
      'mssql'
    );
    const unordered: DrizzleStatement = { ...data, orderBy: [] };

    expect(() => toDataSql(unordered)).toThrow(
      'SQL Server cannot paginate without an order by clause'
    );
  });

  it('omite a paginação quando o plano não pagina', () => {
    const { data } = statementFor({ paginate: 'false' }, 'user.default');

    expect(render(toDataSql(data)).sql).not.toContain('limit');
  });
});

describe('toCountSql', () => {
  it('conta roots mantendo apenas as junções de predicado', () => {
    const { count } = statementFor({
      filter: { 'company.name': { eq: 'ACME' } },
      includes: 'company,company.owner',
      fields: 'id,company.name,company.owner.name',
    });

    const { sql } = render(toCountSql(count));

    expect(sql).toContain('select count(*) as "total"');
    expect(sql).toContain('inner join "companies"');
    expect(sql).not.toContain('users__company__owner');
    expect(sql).not.toContain('order by');
  });
});

describe('toManySql', () => {
  it('busca a coleção restrita aos roots da página', () => {
    const { data } = statementFor({
      includes: 'posts',
      fields: 'id,posts.title',
    });

    const { sql, params } = render(toManySql(data.manyProjections[0], [1, 2]));

    expect(sql).toContain('from "posts" where "posts"."user_id" in (?, ?)');
    expect(sql).toContain('order by "posts"."id" asc');
    expect(params).toEqual([1, 2]);
  });

  it('recusa hidratar sem chaves de root', () => {
    const { data } = statementFor({
      includes: 'posts',
      fields: 'id,posts.title',
    });

    expect(() => toManySql(data.manyProjections[0], [])).toThrow(
      'cannot hydrate posts without root keys'
    );
  });
});

describe('drizzleDatabase', () => {
  function clientReturning(...batches: readonly Record<string, unknown>[][]) {
    const all = jest.fn();
    for (const batch of batches) all.mockResolvedValueOnce(batch);
    return { client: { all } as DrizzleClientLike, all };
  }

  it('aninha as colunas das relações one na resposta', async () => {
    const { data } = statementFor({
      includes: 'company,company.owner',
      fields: 'id,company.name,company.owner.name',
    });
    const raw: Record<string, unknown> = {};
    data.select.forEach((selection, index) => {
      raw[`c${index}`] =
        selection.path === '' ? 7 : `${selection.path}:${selection.column}`;
    });

    const { client } = clientReturning([raw]);
    const rows = await drizzleDatabase({ client }).executeData(data);

    expect(rows[0]).toMatchObject({
      id: 7,
      company: {
        name: 'company:name',
        owner: { name: 'company.owner:name' },
      },
    });
  });

  it('colapsa a relação one sem correspondência para null', async () => {
    const { data } = statementFor({
      includes: 'company,company.owner',
      fields: 'id,company.name,company.owner.name',
    });
    const raw: Record<string, unknown> = {};
    data.select.forEach((selection, index) => {
      raw[`c${index}`] = selection.path === '' ? 7 : null;
    });

    const { client } = clientReturning([raw]);
    const rows = await drizzleDatabase({ client }).executeData(data);

    expect(rows[0]).toEqual({ id: 7, company: null });
  });

  it('mantém o pai quando só o neto está ausente', async () => {
    const { data } = statementFor({
      includes: 'company,company.owner',
      fields: 'id,company.name,company.owner.name',
    });
    const raw: Record<string, unknown> = {};
    data.select.forEach((selection, index) => {
      if (selection.path === '') raw[`c${index}`] = 7;
      else if (selection.path === 'company') raw[`c${index}`] = 'ACME';
      else raw[`c${index}`] = null;
    });

    const { client } = clientReturning([raw]);
    const rows = await drizzleDatabase({ client }).executeData(data);

    // `company.id` entra pela projeção interna, para hidratar e deduplicar.
    expect(rows[0]).toEqual({
      id: 7,
      company: { id: 'ACME', name: 'ACME', owner: null },
    });
  });

  it('agrupa a coleção pelos roots e devolve lista vazia sem filhos', async () => {
    const { data } = statementFor({
      includes: 'posts',
      fields: 'id,posts.title',
    });
    const rootIndex = data.select.findIndex(
      (selection) => selection.column === 'id'
    );
    const projection = data.manyProjections[0];
    const child = (id: string, title: string, userId: number) => {
      const row: Record<string, unknown> = {};
      projection.columns.forEach((column, index) => {
        row[`c${index}`] = { id, title, user_id: userId }[column];
      });
      return row;
    };

    const { client } = clientReturning(
      [{ [`c${rootIndex}`]: 1 }, { [`c${rootIndex}`]: 2 }],
      [child('p1', 'A', 1), child('p2', 'B', 1)]
    );
    const rows = (await drizzleDatabase({ client }).executeData(data)) as {
      posts: unknown[];
    }[];

    expect(rows[0].posts).toHaveLength(2);
    expect(rows[1].posts).toEqual([]);
  });

  it('não consulta a coleção quando não há roots', async () => {
    const { data } = statementFor({
      includes: 'posts',
      fields: 'id,posts.title',
    });
    const { client, all } = clientReturning([]);

    await drizzleDatabase({ client }).executeData(data);

    expect(all).toHaveBeenCalledTimes(1);
  });

  it('devolve zero quando a contagem não traz linha', async () => {
    const { count } = statementFor({}, 'user.default');
    const { client } = clientReturning([]);

    await expect(drizzleDatabase({ client }).executeCount(count)).resolves.toBe(
      0
    );
  });

  it('lê o total da linha de contagem', async () => {
    const { count } = statementFor({}, 'user.default');
    const { client } = clientReturning([{ total: 11 }]);

    await expect(drizzleDatabase({ client }).executeCount(count)).resolves.toBe(
      11
    );
  });
});

describe('assertDrizzleClient', () => {
  it('aceita um client com all()', () => {
    expect(() => assertDrizzleClient({ all: () => [] })).not.toThrow();
  });

  it('recusa um objeto que não é um database do Drizzle', () => {
    expect(() => assertDrizzleClient({})).toThrow(
      'Drizzle client does not expose all()'
    );
  });
});
