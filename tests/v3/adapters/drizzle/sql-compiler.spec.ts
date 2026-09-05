import { SQLiteDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm/sql/sql';
import { buildQueryPlan } from '@core/query-plan';
import {
  DrizzleAdapter,
  assertDrizzleClient,
  buildSourceSchema,
  createDrizzleTable,
  drizzleDatabase,
  drizzleSource,
  toCountSql,
  toDataSql,
  toManySql,
  type DrizzleClientLike,
  type DrizzleRelationMap,
  type DrizzleStatement,
} from '@infra/adapters/drizzle';
import { defineQueryRules } from '@core/authorization';
import type { SchemaRegistry } from '@core/schema';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import {
  postRelations,
  userRelations,
  usersTable,
} from '../../fixtures/drizzle-tables';

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
  // O executor tem de materializar o mesmo dialeto que a source declara:
  // `drizzleSource` falha fechado na divergência. `all()` só existe na família
  // SQLite; os outros dialetos expõem `execute()`.
  const client: DrizzleClientLike =
    sqlDialect === 'sqlite' ? { all: () => [] } : { execute: () => [] };
  const source = drizzleSource({
    db: drizzleDatabase({ client, dialect: sqlDialect }),
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

  it('emite is not null quando isNull vem false', () => {
    const { data } = statementFor(
      { filter: { nickname: { isNull: 'false' } } },
      'user.default'
    );

    const { sql } = render(toDataSql(data));

    // `isNull=false` é "tem valor". Cair no ramo positivo devolveria o
    // conjunto complementar — resultado errado, não erro — e nenhum outro
    // caso distingue os dois lados desta condição.
    expect(sql).toContain('"users"."nickname" is not null');
    expect(sql).not.toContain('not (');
  });

  it('rende grupo booleano vazio como tautologia, não como parêntese vazio', () => {
    const { data } = statementFor({}, 'user.default');

    // `where` é o único campo mutável do statement: é por ele que `customize`
    // entra. Um consumidor que monte o AND a partir de uma lista que acabou
    // vazia produziria `where ()`, erro de sintaxe no banco; a redução mantém
    // o statement válido e sem efeito sobre o conjunto.
    data.where = { op: 'and', terms: [] };

    expect(render(toDataSql(data)).sql).toContain('where 1 = 1');
  });

  it('encadeia o join dentro do EXISTS quando o filtro cruza duas coleções', () => {
    const twoCollections = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      filters: [{ path: 'posts.tags.label', operators: ['eq'] }],
      sorts: ['id'],
      fields: { root: { allowed: ['id'], default: ['id'] } },
    });
    const source = drizzleSource({
      db: drizzleDatabase({ client: { all: () => [] }, dialect: 'sqlite' }),
      dialect: 'sqlite',
      table: usersTable,
      // A cadeia `posts.tags` precisa estar declarada na source; o mapa do
      // corpus para o root `user` só vai até `posts`.
      relations: { ...userRelations, 'posts.tags': postRelations.tags },
    }).input;
    const { data } = new DrizzleAdapter().compile(
      buildQueryPlan(
        { filter: { 'posts.tags.label': { eq: 'urgent' } } },
        twoCollections
      ),
      source
    );

    const { sql } = render(toDataSql(data));

    // Um único EXISTS, correlacionado com o root uma só vez, e o segundo salto
    // como join *dentro* da subconsulta. Correlacionar o segundo salto por
    // fora inflaria os roots e estragaria o `total` — que é justamente o que
    // o EXISTS existe para evitar.
    expect(sql).toContain(
      'exists (select 1 from "posts" as "users__posts__x" inner join "tags" as "users__posts__tags__x" on "users__posts__x"."id" = "users__posts__tags__x"."post_id" where "users"."id" = "users__posts__x"."user_id" and "users__posts__tags__x"."label" = ?'
    );
    expect(sql).not.toContain('join "tags" as "users__posts__tags"');
  });

  it('pagina do começo quando o statement traz limit sem offset', () => {
    const { data } = statementFor(
      { page: '2', perPage: '5' },
      'user.default',
      'postgres'
    );
    // `limit` e `offset` são opcionais e independentes no tipo do statement:
    // um statement montado à mão pode trazer só o limite. Sem o default, o
    // `offset` iria para o bind como `undefined` e o driver erraria tarde.
    const { offset, ...withoutOffset } = data;

    const { sql, params } = render(toDataSql(withoutOffset));

    expect(offset).toBe(5);
    expect(sql).toContain('limit ? offset ?');
    expect(params.slice(-2)).toEqual([5, 0]);
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
    const rows = await drizzleDatabase({
      client,
      dialect: 'sqlite',
    }).executeData(data);

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
    const rows = await drizzleDatabase({
      client,
      dialect: 'sqlite',
    }).executeData(data);

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
    const rows = await drizzleDatabase({
      client,
      dialect: 'sqlite',
    }).executeData(data);

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
      projection.columns.forEach((projected, index) => {
        row[`c${index}`] = { id, title, user_id: userId }[projected.field];
      });
      return row;
    };

    const { client } = clientReturning(
      [{ [`c${rootIndex}`]: 1 }, { [`c${rootIndex}`]: 2 }],
      [child('p1', 'A', 1), child('p2', 'B', 1)]
    );
    const rows = (await drizzleDatabase({
      client,
      dialect: 'sqlite',
    }).executeData(data)) as {
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

    await drizzleDatabase({ client, dialect: 'sqlite' }).executeData(data);

    expect(all).toHaveBeenCalledTimes(1);
  });

  it('não consulta a coleção quando nenhum root tem a chave de correlação', async () => {
    const { data } = statementFor({
      includes: 'posts',
      fields: 'id,nickname,posts.title',
    });
    // Uma coleção pode ser declarada sobre coluna anulável (`sourceColumn` é
    // qualquer coluna do root). Aqui `nickname` faz esse papel: nenhum root da
    // página tem valor, então não existe chave para o `IN`.
    const overNullable: DrizzleStatement = {
      ...data,
      manyProjections: [
        { ...data.manyProjections[0], sourceField: 'nickname' },
      ],
    };
    const raw = (id: number): Record<string, unknown> => {
      const row: Record<string, unknown> = {};
      data.select.forEach((selection, index) => {
        row[`c${index}`] = selection.column === 'nickname' ? null : id;
      });
      return row;
    };
    const { client, all } = clientReturning([raw(1), raw(2)]);

    const rows = await drizzleDatabase({
      client,
      dialect: 'sqlite',
    }).executeData(overNullable);

    // A coleção vazia é a resposta certa, e `toManySql` recusa lista de chaves
    // vazia: sem esta saída o root sem chave viraria erro de contrato.
    expect(all).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      { id: 1, nickname: null, posts: [] },
      { id: 2, nickname: null, posts: [] },
    ]);
  });

  it('devolve zero quando a contagem não traz linha', async () => {
    const { count } = statementFor({}, 'user.default');
    const { client } = clientReturning([]);

    await expect(
      drizzleDatabase({ client, dialect: 'sqlite' }).executeCount(count)
    ).resolves.toBe(0);
  });

  it('lê o total da linha de contagem', async () => {
    const { count } = statementFor({}, 'user.default');
    const { client } = clientReturning([{ total: 11 }]);

    await expect(
      drizzleDatabase({ client, dialect: 'sqlite' }).executeCount(count)
    ).resolves.toBe(11);
  });
});

/**
 * Uma forma de retorno por dialeto (ADR-001, fato 2).
 *
 * `all()` só existe na família SQLite do `drizzle-orm` 1.x; os outros três
 * dialetos expõem `execute()` e devolvem formas diferentes. Estes casos são o
 * que substitui o `as unknown as DrizzleClientLike` que antes deixava um
 * corpus verde em SQLite parecer cobertura dos quatro.
 */
describe('drizzleDatabase por dialeto', () => {
  const countRows = [{ total: 3 }];

  it.each([
    ['sqlite' as const, 'all' as const, countRows],
    ['postgres' as const, 'execute' as const, { rows: countRows }],
    // `postgres-js` devolve um RowList, que já é o array de linhas.
    ['postgres' as const, 'execute' as const, countRows],
    ['mysql' as const, 'execute' as const, [countRows, []]],
    ['mssql' as const, 'execute' as const, { recordset: countRows }],
  ])('lê as linhas de %s via %s()', async (dialect, method, result) => {
    const call = jest.fn().mockResolvedValue(result);
    const { count } = statementFor({});

    await expect(
      drizzleDatabase({ client: { [method]: call }, dialect }).executeCount(
        count
      )
    ).resolves.toBe(3);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('exige o método do dialeto, não qualquer método', () => {
    // Um `db` de Postgres é um database válido do Drizzle que não tem `all()`.
    expect(() =>
      drizzleDatabase({ client: { execute: () => [] }, dialect: 'sqlite' })
    ).toThrow('does not expose all()');

    expect(() =>
      drizzleDatabase({ client: { all: () => [] }, dialect: 'postgres' })
    ).toThrow('does not expose execute()');
  });

  it('acusa contrato quebrado quando o driver não devolve linhas', async () => {
    const { count } = statementFor({});

    await expect(
      drizzleDatabase({
        client: { execute: () => ({ nada: true }) },
        dialect: 'mssql',
      }).executeCount(count)
    ).rejects.toThrow('did not return a row array');
  });
});

describe('assertDrizzleClient', () => {
  it('aceita um client com o método do dialeto', () => {
    expect(() =>
      assertDrizzleClient({ all: () => [] }, 'sqlite')
    ).not.toThrow();
    expect(() =>
      assertDrizzleClient({ execute: () => [] }, 'mysql')
    ).not.toThrow();
  });

  it('nomeia o método esperado, para não mandar procurar no lugar errado', () => {
    expect(() => assertDrizzleClient({}, 'sqlite')).toThrow(
      'Drizzle client for sqlite does not expose all()'
    );
    expect(() => assertDrizzleClient({}, 'mssql')).toThrow(
      'Drizzle client for mssql does not expose execute()'
    );
  });

  /**
   * O único ponto de validação do client precisa cobrir também o dialeto sem
   * leitor: `SqlDialect` é fechado no tipo, mas o valor chega de configuração e
   * pode vir de um `as`. Sem este caso, `drizzleDatabase` leria `undefined` e
   * quebraria em `client[reader.method]` com um TypeError cru.
   */
  it('recusa dialeto para o qual não existe leitor de linhas', () => {
    expect(() =>
      assertDrizzleClient({ all: () => [] }, 'oracle' as never)
    ).toThrow('Drizzle adapter does not support dialect oracle');
  });
});

/**
 * Chave lógica e nome físico divergentes.
 *
 * Até o PR5 o compilador emitia a **chave** do mapa `columns` como
 * identificador e nunca lia `DrizzleColumn.name`: um descritor
 * `{ companyId: { name: 'company_id' } }` compilava, passava em
 * `assertSourceMatchesRules`, a aplicação subia, e a primeira consulta morria
 * no banco com `column "companyId" does not exist`. As duas identidades vivem
 * agora em campos separados — `field` para o JSON e para as regras, `column`
 * para o SQL —, e este bloco é o que trava a diferença: nenhuma das tabelas
 * abaixo tem uma única coluna cujo nome físico coincida com a chave lógica, de
 * modo que qualquer volta atrás aparece como identificador errado no SQL.
 */
describe('nome físico distinto da chave lógica', () => {
  const orgsTable = createDrizzleTable({
    name: 'orgs',
    model: 'org',
    columns: {
      id: {
        name: 'org_id',
        kind: 'integer',
        nullable: false,
        primaryKey: true,
      },
      tradeName: {
        name: 'trade_name',
        kind: 'string',
        nullable: false,
        primaryKey: false,
      },
    },
  });

  const notesTable = createDrizzleTable({
    name: 'notes',
    model: 'note',
    columns: {
      id: {
        name: 'note_id',
        kind: 'integer',
        nullable: false,
        primaryKey: true,
      },
      body: {
        name: 'note_body',
        kind: 'string',
        nullable: false,
        primaryKey: false,
      },
      accountId: {
        name: 'account_id',
        kind: 'integer',
        nullable: false,
        primaryKey: false,
      },
    },
  });

  const accountsTable = createDrizzleTable({
    name: 'accounts',
    model: 'account',
    columns: {
      id: {
        name: 'account_id',
        kind: 'integer',
        nullable: false,
        primaryKey: true,
      },
      fullName: {
        name: 'full_name',
        kind: 'string',
        nullable: false,
        primaryKey: false,
        foldedField: 'fullNameFolded',
      },
      fullNameFolded: {
        name: 'full_name_folded',
        kind: 'string',
        nullable: false,
        primaryKey: false,
        internal: true,
      },
      companyId: {
        name: 'company_id',
        kind: 'integer',
        nullable: true,
        primaryKey: false,
      },
    },
  });

  const relations: DrizzleRelationMap = {
    // As colunas de junção também são chaves lógicas: escrevê-las com o nome
    // físico é erro de configuração, não configuração alternativa.
    company: {
      target: orgsTable,
      cardinality: 'one',
      nullable: true,
      sourceColumn: 'companyId',
      targetColumn: 'id',
    },
    notes: {
      target: notesTable,
      cardinality: 'many',
      nullable: true,
      sourceColumn: 'id',
      targetColumn: 'accountId',
    },
  };

  const schemas: SchemaRegistry = new Map([
    ['account', buildSourceSchema(accountsTable, relations)],
    ['org', buildSourceSchema(orgsTable, {})],
    ['note', buildSourceSchema(notesTable, {})],
  ]);

  const rules = defineQueryRules(schemas, 'account', {
    filters: [
      { path: 'companyId', operators: ['eq'] },
      { path: 'company.tradeName', operators: ['eq'] },
      { path: 'notes.body', operators: ['eq'] },
    ],
    sorts: ['fullName'],
    fields: {
      root: {
        allowed: ['id', 'fullName', 'companyId'],
        default: ['id', 'fullName'],
      },
      relations: {
        company: { allowed: ['tradeName'], default: ['tradeName'] },
        notes: { allowed: ['body'], default: ['body'] },
      },
    },
    includes: ['company', 'notes'],
    search: ['fullName'],
  });

  function compileAccounts(query: Parameters<typeof buildQueryPlan>[0]) {
    const source = drizzleSource({
      db: drizzleDatabase({ client: { all: () => [] }, dialect: 'sqlite' }),
      dialect: 'sqlite',
      table: accountsTable,
      relations,
    }).input;
    return new DrizzleAdapter().compile(buildQueryPlan(query, rules), source);
  }

  it('emite o nome físico em select, join, where e order by', () => {
    const { data } = compileAccounts({
      filter: { 'company.tradeName': { eq: 'ACME' } },
      includes: 'company',
      fields: 'id,fullName,company.tradeName',
      sort: 'fullName',
    });

    const { sql } = render(toDataSql(data));

    expect(sql).toContain('"accounts"."account_id" as "c0"');
    expect(sql).toContain('"accounts"."full_name" as "c1"');
    expect(sql).toContain(
      'inner join "orgs" as "accounts__company" on "accounts"."company_id" = "accounts__company"."org_id"'
    );
    expect(sql).toContain('"accounts__company"."trade_name" = ?');
    expect(sql).toContain(
      'order by "accounts"."full_name" asc, "accounts"."account_id" asc'
    );
    // Nenhuma chave lógica pode vazar para o SQL: é exatamente esse vazamento
    // que subia a aplicação e quebrava no banco.
    expect(sql).not.toContain('"fullName"');
    expect(sql).not.toContain('"companyId"');
    expect(sql).not.toContain('"tradeName"');
  });

  it('traduz a coluna dobrada da busca e a correlação do EXISTS', () => {
    const { data } = compileAccounts({
      search: 'ana',
      filter: { 'notes.body': { eq: 'urgente' } },
    });

    const { sql } = render(toDataSql(data));

    expect(sql).toContain('"accounts"."full_name_folded" like ? escape ?');
    expect(sql).toContain(
      'exists (select 1 from "notes" as "accounts__notes__x" where "accounts"."account_id" = "accounts__notes__x"."account_id" and "accounts__notes__x"."note_body" = ?'
    );
  });

  it('traduz a segunda consulta da coleção, inclusive a ordenação', () => {
    const { data } = compileAccounts({
      includes: 'notes',
      fields: 'id,notes.body',
    });

    const { sql } = render(toManySql(data.manyProjections[0], [1]));

    // `note_id` entra pela projeção interna do plano, e a ordenação da coleção
    // sai da PK do alvo: as três colunas passam pela mesma tradução.
    expect(sql).toContain(
      'select "notes"."note_id" as "c0", "notes"."note_body" as "c1", "notes"."account_id" as "c2" from "notes" where "notes"."account_id" in (?)'
    );
    expect(sql).toContain('order by "notes"."note_id" asc');
  });

  it('hidrata a linha pelas chaves lógicas, não pelos nomes do banco', async () => {
    const { data } = compileAccounts({
      includes: 'company,notes',
      fields: 'id,fullName,company.tradeName,notes.body',
    });
    const root: Record<string, unknown> = {};
    data.select.forEach((selection, index) => {
      root[`c${index}`] = selection.path === '' ? 7 : 'ACME';
    });
    const child: Record<string, unknown> = { c0: 3, c1: 'nota', c2: 7 };

    const all = jest
      .fn()
      .mockResolvedValueOnce([root])
      .mockResolvedValueOnce([child]);
    const rows = await drizzleDatabase({
      client: { all },
      dialect: 'sqlite',
    }).executeData(data);

    // O JSON é a fronteira pública: quem pediu `fullName` recebe `fullName`,
    // não `full_name`, mesmo com a coluna renomeada no banco.
    expect(rows[0]).toEqual({
      id: 7,
      fullName: 7,
      company: { id: 'ACME', tradeName: 'ACME' },
      notes: [{ id: 3, body: 'nota', accountId: 7 }],
    });
  });

  it('recusa relação cuja coluna de junção não é um campo declarado', () => {
    expect(() =>
      buildSourceSchema(accountsTable, {
        // `company_id` é o nome físico; a relação fala em campo lógico. Antes
        // do conserto isto compilava SQL válido contra a coluna certa por
        // acidente, e o mesmo descritor com `name` divergente compilava SQL
        // contra uma coluna inexistente.
        company: {
          target: orgsTable,
          cardinality: 'one',
          nullable: true,
          sourceColumn: 'company_id',
          targetColumn: 'id',
        },
      })
    ).toThrow(
      'Drizzle table accounts has no column declared for field company_id'
    );
  });

  it('recusa campo que o registry conhece e a tabela do alvo não declara', () => {
    const ghostRules = defineQueryRules(
      new Map([
        ...schemas,
        [
          'org',
          buildSourceSchema(
            createDrizzleTable({
              ...orgsTable,
              columns: {
                ...orgsTable.columns,
                slogan: {
                  name: 'slogan',
                  kind: 'string',
                  nullable: true,
                  primaryKey: false,
                },
              },
            }),
            {}
          ),
        ],
      ]),
      'account',
      {
        filters: [{ path: 'company.slogan', operators: ['eq'] }],
        sorts: ['fullName'],
        fields: { root: { allowed: ['id'], default: ['id'] } },
      }
    );
    const source = drizzleSource({
      db: drizzleDatabase({ client: { all: () => [] }, dialect: 'sqlite' }),
      dialect: 'sqlite',
      table: accountsTable,
      relations,
    }).input;

    // O registry das regras e a tabela do adapter são declarações separadas:
    // um campo que só existe na primeira precisa falhar como configuração, e
    // não virar identificador inexistente no SQL.
    expect(() =>
      new DrizzleAdapter().compile(
        buildQueryPlan(
          { filter: { 'company.slogan': { eq: 'x' } } },
          ghostRules
        ),
        source
      )
    ).toThrow('Drizzle table orgs has no column declared for field slogan');
  });
});
