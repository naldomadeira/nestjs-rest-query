import { QueryBuilderService } from '@core/query-builder.v3.service';
import { buildQueryPlan } from '@core/query-plan';
import type { SchemaRegistry } from '@core/schema';
import type { PlanFilter } from '@core/semantic-validator';
import {
  PrismaAdapter,
  compileFilter,
  nestThroughRelations,
  relationParentModel,
  scalarCondition,
  createPrismaManifest,
  prismaSource,
  type PrismaDelegate,
  type PrismaManifest,
  type PrismaQueryArgs,
  type PrismaSourceInput,
} from '@infra/adapters/prisma';
import { defineQueryRules } from '@core/authorization';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';

/**
 * Escape de um dialeto que tem default (Postgres/MySQL).
 *
 * Os casos deste arquivo que não são sobre escape usam este, porque o modo
 * `unsupported` recusa os operadores de padrão antes de chegar ao que eles
 * querem exercitar.
 */
const NATIVE_ESCAPE = {
  patternEscape: 'native',
  escapeCharacter: '\\',
} as const;

function manifest(registry: SchemaRegistry = CORPUS_SCHEMAS): PrismaManifest {
  return createPrismaManifest({
    provider: 'postgresql',
    registry,
    models: {
      user: { delegate: 'user' },
      company: { delegate: 'company' },
      post: { delegate: 'post' },
      tag: { delegate: 'tag' },
    },
  });
}

function delegate(rows: readonly object[] = []): PrismaDelegate {
  return {
    findMany: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(rows.length),
  };
}

function input(): PrismaSourceInput {
  return {
    client: { user: delegate() },
    delegate: delegate(),
    model: 'user',
    manifest: manifest(),
  };
}

function compile(
  query: Parameters<typeof buildQueryPlan>[0],
  preset = 'user.deep'
): PrismaQueryArgs {
  const plan = buildQueryPlan(query, RULES_PRESETS[preset]);
  return new PrismaAdapter().compile(plan, input()).data;
}

describe('createPrismaManifest', () => {
  it('congela o manifesto validado', () => {
    const built = manifest();

    expect(Object.isFrozen(built)).toBe(true);
    expect(Object.isFrozen(built.models)).toBe(true);
    expect(built.provider).toBe('postgresql');
  });

  it('recusa model sem schema lógico', () => {
    expect(() =>
      createPrismaManifest({
        provider: 'postgresql',
        registry: CORPUS_SCHEMAS,
        models: { ghost: { delegate: 'ghost' } },
      })
    ).toThrow('Prisma manifest model ghost has no schema entry');
  });

  it('recusa model sem delegate', () => {
    expect(() =>
      createPrismaManifest({
        provider: 'postgresql',
        registry: CORPUS_SCHEMAS,
        models: { user: { delegate: '' } },
      })
    ).toThrow('Prisma manifest model user has no delegate');
  });
});

describe('prismaSource', () => {
  it('cria source discriminada a partir do manifesto', async () => {
    const source = prismaSource({
      client: { user: delegate() },
      model: 'user',
      manifest: manifest(),
    });

    expect(source.kind).toBe('prisma');
    await expect(source.adapter.describe(source.input)).resolves.toEqual(
      CORPUS_SCHEMAS.get('user')
    );
  });

  it('recusa model ausente do manifesto antes de consultar o client', () => {
    expect(() =>
      prismaSource({ client: {}, model: 'missing', manifest: manifest() })
    ).toThrow('Prisma model missing is not present in the manifest');
  });

  it('recusa delegate ausente do client gerado', () => {
    expect(() =>
      prismaSource({ client: {}, model: 'user', manifest: manifest() })
    ).toThrow('Prisma delegate user for model user is missing from the client');
  });

  /**
   * O tipo do client passou a ser `object` para que o `PrismaClient` gerado
   * seja atribuível sem cast (era `Readonly<Record<string, PrismaDelegate>>`,
   * e classe não recebe index signature implícita). O que o tipo deixou de
   * garantir, estes dois casos garantem: quem valida a forma do delegate é
   * `prismaSource`, na construção, não a primeira request.
   */
  it('recusa objeto que tem a propriedade mas não é delegate', () => {
    expect(() =>
      prismaSource({
        client: { user: { findMany: 'não é função' } },
        model: 'user',
        manifest: manifest(),
      })
    ).toThrow('Prisma delegate user for model user is missing from the client');
  });

  it('recusa delegate sem count, que só falharia ao paginar', () => {
    // `findMany` sozinho passaria a primeira consulta e estouraria só na
    // contagem — ou seja, só em request paginada, longe da configuração.
    expect(() =>
      prismaSource({
        client: { user: { findMany: jest.fn() } },
        model: 'user',
        manifest: manifest(),
      })
    ).toThrow('Prisma delegate user for model user is missing from the client');
  });

  it('reporta model do manifesto sem schema no describe', async () => {
    const adapter = new PrismaAdapter();
    const broken = { ...input(), model: 'ghost' };

    await expect(adapter.describe(broken)).rejects.toThrow(
      'Prisma model ghost is not present in the manifest'
    );
  });
});

describe('PrismaAdapter capabilities', () => {
  /**
   * O escape declarado tem de ser o que o adapter realmente faz.
   *
   * O Prisma nunca emite cláusula `ESCAPE`, então `clause` seria mentira em
   * qualquer dialeto. Onde o banco tem escape default (`\` em Postgres e
   * MySQL) o modo é `native`; onde não tem (SQLite e SQL Server) é
   * `unsupported`, e o caractere fica vazio porque não existe escape possível.
   */
  it.each([
    ['postgresql', 'postgres', 'native', '\\'],
    ['mysql', 'mysql', 'native', '\\'],
    ['sqlserver', 'mssql', 'unsupported', ''],
    ['sqlite', 'sqlite', 'unsupported', ''],
  ] as const)(
    'mapeia o provider %s para o dialeto %s com escape %s',
    (provider, dialect, patternEscape, escapeCharacter) => {
      const adapter = new PrismaAdapter();
      const source = {
        ...input(),
        manifest: { ...manifest(), provider },
      };

      expect(adapter.capabilities(source)).toEqual({
        dialect,
        transactionalConsistency: false,
        escapeCharacter,
        patternEscape,
      });
      expect(adapter.id).toBe('prisma');
    }
  );

  it('nunca declara caractere de escape quando não há escape possível', () => {
    const adapter = new PrismaAdapter();

    for (const provider of [
      'postgresql',
      'mysql',
      'sqlserver',
      'sqlite',
    ] as const) {
      const capabilities = adapter.capabilities({
        ...input(),
        manifest: { ...manifest(), provider },
      });

      // A invariante que impede a capability de voltar a mentir.
      expect(capabilities.patternEscape === 'unsupported').toBe(
        capabilities.escapeCharacter === ''
      );
    }
  });
});

/**
 * `findMany` chega ao adapter como `Promise<unknown>` — preço de o delegate
 * aceitar o client gerado. Estes casos provam que o estreitamento é checagem
 * e não afirmação: dado fora do protocolo do Prisma é recusado aqui, perto da
 * causa, em vez de seguir para o normalizador.
 */
describe('PrismaAdapter execute', () => {
  it('recusa retorno que não é lista', async () => {
    const adapter = new PrismaAdapter();
    const compiled = {
      delegate: {
        findMany: jest.fn().mockResolvedValue({ id: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
      data: {},
      count: {},
      paginate: false,
    };

    await expect(adapter.execute(compiled)).rejects.toThrow(
      'Prisma findMany did not return an array of rows'
    );
  });

  it('recusa lista com item que não é linha', async () => {
    const adapter = new PrismaAdapter();
    const compiled = {
      delegate: {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }, null]),
        count: jest.fn().mockResolvedValue(2),
      },
      data: {},
      count: {},
      paginate: false,
    };

    await expect(adapter.execute(compiled)).rejects.toThrow(
      'Prisma findMany did not return an array of rows'
    );
  });
});

describe('PrismaAdapter compile', () => {
  it('compila where, search, select, orderBy e paginação sem mode insensitive', () => {
    const data = compile(
      {
        filter: { 'company.name': { ilike: 'ACME' } },
        search: 'Ada',
        includes: 'company',
        fields: 'id,name,company.name',
        sort: '-name',
        page: '2',
        perPage: '3',
      },
      'user.default'
    );

    expect(JSON.stringify(data)).not.toContain('"mode"');
    expect(data).toEqual({
      where: {
        AND: [
          { company: { is: { name_folded: { contains: 'acme' } } } },
          {
            OR: [
              { name_folded: { contains: 'ada' } },
              { email_folded: { contains: 'ada' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'desc' }, { id: 'asc' }],
      skip: 3,
      take: 3,
    });
  });

  it('usa some para escalar através de relação many', () => {
    expect(
      compile({ filter: { 'posts.title': { eq: 'COBOL' } } }).where
    ).toEqual({ AND: [{ posts: { some: { title: { equals: 'COBOL' } } } }] });
  });

  it('usa some e none para presença de relação many', () => {
    expect(compile({ filter: { posts: { isNull: 'true' } } }).where).toEqual({
      AND: [{ posts: { none: {} } }],
    });
    expect(compile({ filter: { posts: { isNull: 'false' } } }).where).toEqual({
      AND: [{ posts: { some: {} } }],
    });
  });

  it('aninha a presença de uma relação profunda sob o pai correto', () => {
    // Regressão: `relationPath` para antes da relação alvo, então tratar
    // `company.owner` por ele produzia a presença de `company` no root.
    const deepPresence = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      filters: [{ path: 'company.owner', operators: ['isNull'] }],
      sorts: ['id'],
      fields: { root: { allowed: ['id'], default: ['id'] } },
    });
    const plan = buildQueryPlan(
      { filter: { 'company.owner': { isNull: 'true' } } },
      deepPresence
    );

    expect(new PrismaAdapter().compile(plan, input()).data.where).toEqual({
      AND: [{ company: { is: { owner: { is: null } } } }],
    });
  });

  it('usa is e isNot para presença de relação one', () => {
    expect(compile({ filter: { company: { isNull: 'true' } } }).where).toEqual({
      AND: [{ company: { is: null } }],
    });
    expect(compile({ filter: { company: { isNull: 'false' } } }).where).toEqual(
      {
        AND: [{ company: { isNot: null } }],
      }
    );
  });

  it('aninha o select recursivamente em cadeia profunda', () => {
    const data = compile({
      includes: 'company,company.owner',
      fields: 'id,company.name,company.owner.name',
    });

    expect(data.select).toEqual({
      id: true,
      company: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, name: true } },
        },
      },
    });
  });

  it('aninha orderBy pela cadeia de relações', () => {
    // O caso que antes tinha este nome ordenava por `-name`, coluna do root:
    // nunca passou pelo aninhamento, e metade do compilador de ordenação
    // ficava sem execução nenhuma. Ordenar por relação `one` é da §14 — o
    // plano só recusa quando o caminho cruza uma relação `many`.
    const relationSort = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      filters: [{ path: 'id', operators: ['eq'] }],
      sorts: ['company.name', 'id'],
      fields: {
        root: { allowed: ['id', 'name'], default: ['id', 'name'] },
        relations: {
          company: { allowed: ['id', 'name'], default: ['id', 'name'] },
        },
      },
      includes: ['company'],
    });
    const nested = new PrismaAdapter().compile(
      buildQueryPlan({ sort: '-company.name' }, relationSort),
      input()
    );
    const rootOnly = new PrismaAdapter().compile(
      buildQueryPlan({ sort: '-name' }, RULES_PRESETS['user.deep']),
      input()
    );

    // A relação vira objeto aninhado, e o tie-break por PK continua no root:
    // achatar `company.name` numa chave de coluna faria o Prisma recusar o
    // argumento, e usar o path inteiro como coluna ordenaria pela coisa errada.
    expect(nested.data.orderBy).toEqual([
      { company: { name: 'desc' } },
      { id: 'asc' },
    ]);
    expect(rootOnly.data.orderBy).toEqual([{ name: 'desc' }, { id: 'asc' }]);
  });

  it('traduz todos os operadores escalares', () => {
    const data = compile(
      {
        filter: {
          id: { in: '1,2', notIn: '3', between: '4,9', gte: '1', lte: '9' },
          name: { ne: 'Ada', notLike: 'x', notIlike: 'y' },
          nickname: { isNull: 'false' },
        },
      },
      'user.default'
    );

    expect((data.where as { AND: unknown[] }).AND).toEqual([
      { id: { in: [1, 2] } },
      { id: { notIn: [3] } },
      { id: { gte: 4, lte: 9 } },
      { id: { gte: 1 } },
      { id: { lte: 9 } },
      { name: { not: 'Ada' } },
      { name: { not: { contains: 'x' } } },
      { name_folded: { not: { contains: 'y' } } },
      { nickname: { not: null } },
    ]);
  });

  it('repassa gt, gte, lt e lte com o próprio nome do operador', () => {
    // Os quatro caem no mesmo ramo do compilador, e o nome do operador é a
    // própria chave do Prisma. Sem `gt` medido, trocar a chave por outra
    // passaria: os demais casos do arquivo só usam três dos quatro.
    expect(
      compile(
        { filter: { id: { gt: '1', gte: '2', lt: '3', lte: '4' } } },
        'user.default'
      ).where
    ).toEqual({
      AND: [
        { id: { gt: 1 } },
        { id: { gte: 2 } },
        { id: { lt: 3 } },
        { id: { lte: 4 } },
      ],
    });
  });

  it('marca in vazio como sempre falso e omite notIn vazio', () => {
    // `in: []`, e não `OR: []`: o Prisma reduz um `OR` vazio isolado a `1=0`,
    // mas ignora o mesmo `OR` dentro de um `AND` — e é sempre dentro de um
    // `AND` que os filtros saem daqui.
    expect(
      compile({ filter: { id: { in: '' } } }, 'user.default').where
    ).toEqual({ AND: [{ id: { in: [] } }] });
    expect(
      compile({ filter: { id: { notIn: '' } } }, 'user.default').where
    ).toBeUndefined();
  });

  it('serializa bigint, decimal e data para valores do client', () => {
    const data = compile(
      {
        filter: {
          score: { eq: '9007199254740993' },
          balance: { eq: '10.50' },
          born_on: { eq: '1815-12-10' },
        },
      },
      'user.default'
    );

    expect((data.where as { AND: unknown[] }).AND).toEqual([
      { score: { equals: '9007199254740993' } },
      { balance: { equals: '10.50' } },
      // Data civil vira `Date` em meia-noite UTC: o client gerado recusa a
      // string ISO num campo `DateTime` com erro de validação.
      { born_on: { equals: new Date('1815-12-10T00:00:00.000Z') } },
    ]);
  });

  it('omite skip e take quando o plano não pagina', () => {
    const data = compile({ paginate: 'false' }, 'user.default');

    expect(data.skip).toBeUndefined();
    expect(data.take).toBeUndefined();
  });
});

describe('fail-closed do compiler', () => {
  const plan = buildQueryPlan({}, RULES_PRESETS['user.deep']);

  function filterWith(overrides: Partial<PlanFilter>): PlanFilter {
    return {
      path: 'id',
      target: 'scalar',
      relationPath: [],
      column: 'id',
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

  it('recusa operador que o adapter não compila', () => {
    expect(() =>
      scalarCondition(
        filterWith({ operator: 'search' as PlanFilter['operator'] }),
        NATIVE_ESCAPE
      )
    ).toThrow('Prisma adapter cannot compile operator search');
  });

  it('recusa relação inexistente ao aninhar uma condição', () => {
    expect(() => nestThroughRelations(plan, 'user', ['ghost'], {})).toThrow(
      'No Prisma relation ghost on user'
    );
  });

  it('recusa relação inexistente ao caminhar até o pai', () => {
    expect(() => relationParentModel(plan, ['ghost'])).toThrow(
      'No Prisma relation ghost on user'
    );
  });

  it('recusa presença de uma relação que o registry não conhece', () => {
    expect(() =>
      compileFilter(
        plan,
        filterWith({ target: 'relation', path: 'ghost', value: true }),
        NATIVE_ESCAPE
      )
    ).toThrow('No Prisma relation ghost on user');
  });
});

describe('PrismaAdapter execute', () => {
  it('executa findMany e count a partir do mesmo where customizável', async () => {
    const userDelegate = delegate([{ id: 1, name: 'Ada' }]);
    const source = prismaSource({
      client: { user: userDelegate },
      model: 'user',
      manifest: manifest(),
    });
    const service = new QueryBuilderService({});

    const result = await service.execute(
      source,
      {},
      RULES_PRESETS['user.default'],
      {
        customize: (native) => {
          native.args.where = native.args.where
            ? { AND: [native.args.where, { active: true }] }
            : { active: true };
        },
      }
    );

    expect(userDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
    expect(userDelegate.count).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(result.data).toEqual([{ id: 1, name: 'Ada' }]);
    expect(result.total).toBe(1);
  });

  it('não consulta o count quando o plano não pagina', async () => {
    const userDelegate = delegate([{ id: 1, name: 'Ada' }]);
    const adapter = new PrismaAdapter();
    const plan = buildQueryPlan(
      { paginate: 'false' },
      RULES_PRESETS['user.default']
    );
    const compiled = adapter.compile(plan, {
      ...input(),
      delegate: userDelegate,
    });

    const result = await adapter.execute(compiled);

    expect(userDelegate.count).not.toHaveBeenCalled();
    expect(result.total).toBeUndefined();
    expect(result.queryCount).toBe(1);
  });

  it('customize sem escopo alcança data e count', () => {
    const adapter = new PrismaAdapter();
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());
    const seen: string[] = [];

    // O default é `both`: quem chama `customize(compiled, cb)` sem escopo
    // espera o filtro extra também no count, senão `total` conta linhas que a
    // página nunca devolve.
    adapter.customize(compiled, (native) => seen.push(native.kind));

    expect(seen).toEqual(['data', 'count']);
  });

  it('customize com escopo data não toca o count', () => {
    const adapter = new PrismaAdapter();
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());
    const seen: string[] = [];

    adapter.customize(compiled, (native) => seen.push(native.kind), 'data');
    expect(seen).toEqual(['data']);

    adapter.customize(compiled, (native) => seen.push(native.kind), 'count');
    expect(seen).toEqual(['data', 'count']);
  });
});
