import { DataSource, EntitySchema, type ObjectLiteral } from 'typeorm';
import { defineQueryRules, type CompiledQueryRules } from '@core/authorization';
import { DecimalValue } from '@core/coercion';
import { buildQueryPlan } from '@core/query-plan';
import { foldText } from '@core/text-profile';
import {
  buildSchemaRegistry,
  compilePlan,
  executeCompiled,
} from '@infra/adapters/typeorm';
import { isolatedCoercion } from '../../fixtures/published-layout';
import { ESCAPE_CHARACTER } from './helpers';

/**
 * Regressões do relato de consumidor externo (`3.0.0-alpha.0`), na forma exata
 * em que o consumidor as encontrou: NestJS 11 + TypeORM + PostgreSQL, entidade
 * camelCase sobre colunas snake_case (`@Column({ name })`), num schema que não
 * é o `public`.
 *
 * O corpus mede a paridade dos três adapters com os mesmos bugs
 * (`regression/*` em `tests/v3/corpus/cases.ts`); aqui fica o que é próprio do
 * TypeORM — a forma do SQL que ele emite — e a reprodução literal do relato.
 */

/** `@Entity({ schema: 'catalog' })` com `@Column({ name })` em tudo. */
function catalogEntities(schema?: string) {
  const brand = new EntitySchema<ObjectLiteral>({
    name: 'brand',
    tableName: 'brands',
    ...(schema ? { schema } : {}),
    columns: {
      id: { type: 'integer', primary: true },
      name: { type: 'varchar' },
    },
    relations: {
      products: {
        type: 'one-to-many',
        target: 'product',
        inverseSide: 'brand',
      },
    },
  });

  const product = new EntitySchema<ObjectLiteral>({
    name: 'product',
    tableName: 'products',
    ...(schema ? { schema } : {}),
    columns: {
      id: { type: 'integer', primary: true },
      name: { type: 'varchar' },
      // Busca por relação `many` precisa da coluna dobrada — e ela também tem
      // nome físico próprio.
      name_folded: { type: 'varchar', name: 'name_search' },
      price: { type: 'decimal', precision: 12, scale: 2 },
      isAccessory: { type: 'boolean', name: 'is_accessory' },
      brandId: { type: 'integer', name: 'brand_id' },
    },
    relations: {
      brand: {
        type: 'many-to-one',
        target: 'brand',
        inverseSide: 'products',
        nullable: false,
        joinColumn: { name: 'brand_id' },
      },
    },
  });

  return { brand, product };
}

function brandRules(dataSource: DataSource): CompiledQueryRules {
  const registry = buildSchemaRegistry(dataSource.getRepository('brand'));
  return defineQueryRules(registry, 'brand', {
    filters: [
      { path: 'products.isAccessory', operators: ['eq'] },
      { path: 'products.price', operators: ['gte', 'between'] },
    ],
    sorts: ['id'],
    fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
    search: ['products.name'],
  });
}

function productRules(dataSource: DataSource): CompiledQueryRules {
  const registry = buildSchemaRegistry(dataSource.getRepository('product'));
  return defineQueryRules(registry, 'product', {
    filters: [{ path: 'price', operators: ['eq', 'gte', 'lte', 'between'] }],
    sorts: ['id'],
    fields: {
      root: { allowed: ['id', 'name', 'price'], default: ['id', 'price'] },
    },
  });
}

describe('regression: many-relation filter column mapping (consumer report #2)', () => {
  /**
   * Metadata de PostgreSQL com `schema: 'catalog'`, sem abrir conexão: é a
   * forma do SQL que está em jogo, e só o driver do Postgres a produz.
   */
  let postgres: DataSource;

  beforeAll(async () => {
    const { brand, product } = catalogEntities('catalog');
    postgres = new DataSource({
      type: 'postgres',
      entities: [brand, product],
    });
    await (
      postgres as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  const sqlFor = (query: Record<string, unknown>): string => {
    const plan = buildQueryPlan(query, brandRules(postgres));
    return compilePlan(
      plan,
      postgres.getRepository('brand'),
      ESCAPE_CHARACTER
    ).data.getQuery();
  };

  it('usa a coluna física, citada, e a tabela com schema (a query do relato)', () => {
    // Antes: EXISTS (SELECT 1 FROM products dqb_ex_products WHERE
    //   dqb_ex_products.brand_id = "root"."id" AND
    //   dqb_ex_products.isAccessory = $1)
    // -> 500: column dqb_ex_products.isaccessory does not exist
    expect(
      sqlFor({ filter: { 'products.isAccessory': { eq: 'true' } } })
    ).toContain(
      'EXISTS (SELECT 1 FROM "catalog"."products" "dqb_ex_products" ' +
        'WHERE "dqb_ex_products"."brand_id" = "root"."id" ' +
        'AND "dqb_ex_products"."is_accessory" = :dqb_0)'
    );
  });

  it('a busca por relação many usa o nome físico da coluna dobrada', () => {
    expect(sqlFor({ search: 'Cabo' })).toContain(
      `"dqb_ex_products"."name_search" LIKE :dqb_0 ESCAPE '${ESCAPE_CHARACTER}'`
    );
  });

  it('nenhum identificador da subquery sai cru', () => {
    const sql = sqlFor({
      filter: {
        'products.isAccessory': { eq: 'true' },
        'products.price': { gte: '10.00' },
      },
    });
    const subqueries = sql.match(/EXISTS \(SELECT 1 FROM [^)]*\)/g) ?? [];
    expect(subqueries).toHaveLength(2);
    for (const subquery of subqueries) {
      // Todo identificador qualificado tem aspas nos dois lados do ponto.
      expect(subquery).not.toMatch(/[\w]\.[\w]/);
      expect(subquery).not.toMatch(/isAccessory|brandId/);
    }
  });

  it('entidade sem schema explícito continua sem prefixo de schema', async () => {
    const { brand, product } = catalogEntities();
    const plain = new DataSource({
      type: 'postgres',
      entities: [brand, product],
    });
    await (
      plain as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();

    const plan = buildQueryPlan(
      { filter: { 'products.isAccessory': { eq: 'true' } } },
      brandRules(plain)
    );
    const sql = compilePlan(
      plan,
      plain.getRepository('brand'),
      ESCAPE_CHARACTER
    ).data.getQuery();

    expect(sql).toContain('FROM "products" "dqb_ex_products"');
  });

  it('propriedade sem coluna na entidade falha fechado', () => {
    // Um plano cujo registry diverge da entidade é defeito de contrato, e o
    // `execute()` já o recusa antes de compilar; chamar o compilador direto
    // não pode produzir SQL com o nome da propriedade.
    const registry = buildSchemaRegistry(postgres.getRepository('brand'));
    const productSchema = registry.get('product')!;
    const drifted = new Map(registry);
    drifted.set('product', {
      ...productSchema,
      fields: new Map([
        ...productSchema.fields,
        [
          'ghost',
          {
            path: 'ghost',
            kind: 'boolean',
            nullable: false,
            primaryKey: false,
          },
        ],
      ]),
    });
    const rules = defineQueryRules(drifted, 'brand', {
      filters: [{ path: 'products.ghost', operators: ['eq'] }],
      sorts: ['id'],
      fields: { root: { allowed: ['id'], default: ['id'] } },
    });

    expect(() =>
      compilePlan(
        buildQueryPlan({ filter: { 'products.ghost': { eq: 'true' } } }, rules),
        postgres.getRepository('brand'),
        ESCAPE_CHARACTER
      )
    ).toThrow(expect.objectContaining({ code: 'ADAPTER_CONTRACT_VIOLATION' }));
  });
});

describe('regression: decimal filter binding (consumer report #1)', () => {
  let sqlite: DataSource;

  beforeAll(async () => {
    const { brand, product } = catalogEntities();
    sqlite = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      entities: [brand, product],
    });
    await sqlite.initialize();
    await sqlite.getRepository('brand').insert([
      { id: 1, name: 'Multi' },
      { id: 2, name: 'Pulse' },
    ]);
    await sqlite.getRepository('product').insert(
      [
        {
          id: 1,
          name: 'Cabo USB',
          price: '29.90',
          isAccessory: true,
          brandId: 1,
        },
        {
          id: 2,
          name: 'Mouse',
          price: '59.90',
          isAccessory: false,
          brandId: 1,
        },
        { id: 3, name: 'Fone', price: '99.90', isAccessory: false, brandId: 2 },
      ].map((row) => ({ ...row, name_folded: foldText(row.name) }))
    );
  });

  afterAll(async () => {
    await sqlite?.destroy();
  });

  /**
   * O plano vem de uma cópia do núcleo separada da do adapter — como
   * `nestjs-rest-query` e `nestjs-rest-query/typeorm` no pacote publicado.
   * O `DecimalValue` do filtro é, então, de **outra classe** que a importada
   * pelo compilador, que é exatamente a condição do relato.
   */
  function crossBundlePlan(query: Record<string, unknown>) {
    const plan = buildQueryPlan(query, productRules(sqlite));
    const foreign = isolatedCoercion();
    return {
      ...plan,
      filters: plan.filters.map((filter) => ({
        ...filter,
        value: rebuild(filter.value, foreign),
      })),
    };
  }

  function rebuild(
    value: unknown,
    foreign: ReturnType<typeof isolatedCoercion>
  ): unknown {
    if (Array.isArray(value))
      return value.map((item) => rebuild(item, foreign));
    if (value instanceof DecimalValue)
      return new foreign.DecimalValue(value.value);
    return value;
  }

  it('a classe da outra cópia é mesmo outra classe', () => {
    const foreign = isolatedCoercion();
    expect(foreign.DecimalValue).not.toBe(DecimalValue);
    // ... e ainda assim é reconhecida pelas duas: é a marca, não o protótipo.
    expect(new foreign.DecimalValue('1') instanceof DecimalValue).toBe(true);
    expect(new DecimalValue('1') instanceof foreign.DecimalValue).toBe(true);
    expect(new foreign.CivilDate('2026-01-01') instanceof DecimalValue).toBe(
      false
    );
  });

  it.each([
    ['eq', { eq: '29.90' }, [1]],
    ['gte', { gte: '59.90' }, [2, 3]],
    ['lte', { lte: '59.90' }, [1, 2]],
    ['between', { between: '29.90,59.90' }, [1, 2]],
  ])(
    '%s em decimal liga o valor como texto e filtra de verdade',
    async (_operator, condition, expected) => {
      const plan = crossBundlePlan({ filter: { price: condition } });
      const compiled = compilePlan(
        plan as never,
        sqlite.getRepository('product'),
        ESCAPE_CHARACTER
      );

      // Antes: o parâmetro era o objeto `DecimalValue`, e o `pg` o serializava
      // com `JSON.stringify` -> `'"29.90"'` (500 no PostgreSQL).
      for (const value of Object.values(compiled.data.getParameters())) {
        expect(typeof value).toBe('string');
      }

      const { rows } = await executeCompiled(compiled);
      expect(rows.map((row) => row.id)).toEqual(expected);
    }
  );
});
