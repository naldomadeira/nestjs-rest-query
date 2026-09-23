import { DataSource, EntitySchema, type ObjectLiteral } from 'typeorm';
import { defineQueryRules, type CompiledQueryRules } from '@core/authorization';
import { foldText } from '@core/text-profile';
import { buildSchemaRegistry, typeormSource } from '@infra/adapters/typeorm';
import { seedCorpus } from '../fixtures/corpus-runner';
import { publishedQueryBuilderService } from '../fixtures/published-layout';
import { RULES_PRESETS } from '../fixtures/rules';
import { openCell, selectedAdapter, type Cell } from './adapters';
import {
  assertProfile,
  openDialect,
  selectedDialect,
  type IntegrationContext,
  type IntegrationDialect,
} from './setup';

/**
 * Regressões do relato de consumidor externo (`3.0.0-alpha.0`) contra o banco
 * real da célula.
 *
 * O corpus (`regression/*`) já mede os bugs #1, #2 e #6 nos três adapters,
 * sobre o modelo canônico. Este arquivo acrescenta as duas coisas que o corpus
 * não tem como ter:
 *
 * - a **política global** de `paginate=false` (`forRoot`), que o runner do
 *   corpus não configura — roda em todas as células;
 * - a reprodução literal do relato na célula TypeORM: entidade camelCase sobre
 *   colunas snake_case, `numeric(12,2)`, e tabelas **fora do schema default**
 *   (o consumidor usa `DB_SCHEMA`), que é o que fazia o `EXISTS` procurar a
 *   tabela no lugar errado.
 *
 * Em todas as células o núcleo vem de uma cópia separada da do adapter, como
 * no pacote publicado (`fixtures/published-layout.ts`).
 */
const dialect = selectedDialect();
const adapter = selectedAdapter();

const describeCell = dialect ? describe : describe.skip;

const QueryBuilderService = publishedQueryBuilderService();

function responseOf(error: unknown): { statusCode: number; code: string } {
  const response = (
    error as { getResponse?: () => { statusCode: number; code: string } }
  ).getResponse?.();
  if (!response) throw error;
  return response;
}

describeCell(
  `regressões do consumidor — ${adapter} × ${dialect ?? 'sem célula selecionada'}`,
  () => {
    let context: IntegrationContext;
    let cell: Cell;

    beforeAll(async () => {
      context = await openDialect(dialect!);
      await assertProfile(context);
      await seedCorpus(context.dataSource, context.entities);
      cell = await openCell(adapter, context);
    }, 180_000);

    afterAll(async () => {
      await cell?.close();
      await context?.dataSource.destroy();
    });

    describe('regression: unpaginated global cap (consumer report #6)', () => {
      const endpoint = RULES_PRESETS['user.no-search'];

      it('forRoot({ pagination: { maxUnpaginatedRows } }) recusa acima do teto', async () => {
        // O seed tem 11 users; antes, `paginate=false` devolvia os 11 sem
        // olhar teto nenhum.
        const service = new QueryBuilderService({
          pagination: { maxUnpaginatedRows: 10 },
        });

        const error = await service
          .execute(
            cell.sourceFor('user.no-search'),
            { paginate: 'false' },
            endpoint
          )
          .then(
            () => null,
            (caught: unknown) => caught
          );

        expect(error && responseOf(error)).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: 'PAGINATION_INVALID',
          })
        );
      });

      it('exatamente no teto global devolve tudo', async () => {
        const service = new QueryBuilderService({
          pagination: { maxUnpaginatedRows: 11 },
        });

        const result = await service.execute(
          cell.sourceFor('user.no-search'),
          { paginate: 'false' },
          endpoint
        );
        expect(result.data).toHaveLength(11);
        expect(Object.keys(result)).toEqual(['data']);
      });

      it('forRoot({ pagination: { allowUnpaginated: false } }) recusa', async () => {
        const service = new QueryBuilderService({
          pagination: { allowUnpaginated: false },
        });

        const error = await service
          .execute(
            cell.sourceFor('user.no-search'),
            { paginate: 'false' },
            endpoint
          )
          .then(
            () => null,
            (caught: unknown) => caught
          );
        expect(error && responseOf(error).code).toBe('PAGINATION_INVALID');
      });
    });

    if (adapter === 'typeorm') {
      describe('o relato, literalmente: snake_case, numeric(12,2) e schema próprio', () => {
        let catalog: Catalog;

        beforeAll(async () => {
          catalog = await openCatalog(context);
        }, 120_000);

        afterAll(async () => {
          await catalog?.drop();
        });

        const service = new QueryBuilderService({});

        describe('regression: decimal filter binding (consumer report #1)', () => {
          it.each([
            ['eq', { eq: '29.90' }, [1]],
            ['gte', { gte: '59.90' }, [2, 3]],
            ['lte', { lte: '59.90' }, [1, 2]],
            ['between', { between: '29.90,59.90' }, [1, 2]],
          ])(
            'filter[price][%s] numa coluna numeric(12,2) não é 500',
            async (_operator, condition, expected) => {
              // Antes, no PostgreSQL: QueryFailedError: invalid input syntax
              // for type numeric: ""29.90"".
              const result = await service.execute(
                typeormSource(catalog.repository('product')),
                { filter: { price: condition }, sort: 'id' },
                catalog.productRules
              );
              expect(
                (result.data as { id: number }[]).map((row) => row.id)
              ).toEqual(expected);
            }
          );
        });

        describe('regression: many-relation filter column mapping (consumer report #2)', () => {
          it('filter[products.isAccessory] usa a coluna is_accessory do schema certo', async () => {
            // Antes: column dqb_ex_products.isaccessory does not exist (500),
            // e a tabela era procurada sem o schema.
            const result = await service.execute(
              typeormSource(catalog.repository('brand')),
              { filter: { 'products.isAccessory': { eq: 'true' } } },
              catalog.brandRules
            );
            expect(
              (result.data as { id: number }[]).map((row) => row.id)
            ).toEqual([1]);
            expect(result.total).toBe(1);
          });

          it('decimal através da relação many', async () => {
            const result = await service.execute(
              typeormSource(catalog.repository('brand')),
              { filter: { 'products.price': { gte: '90.00' } } },
              catalog.brandRules
            );
            expect(
              (result.data as { id: number }[]).map((row) => row.id)
            ).toEqual([2]);
          });

          it('search através da relação many usa a coluna dobrada física', async () => {
            const result = await service.execute(
              typeormSource(catalog.repository('brand')),
              { search: 'MOUSE' },
              catalog.brandRules
            );
            expect(
              (result.data as { id: number }[]).map((row) => row.id)
            ).toEqual([1]);
          });
        });
      });
    }
  }
);

interface Catalog {
  readonly productRules: CompiledQueryRules;
  readonly brandRules: CompiledQueryRules;
  repository(
    name: 'brand' | 'product'
  ): ReturnType<DataSource['getRepository']>;
  drop(): Promise<void>;
}

const CATALOG_SCHEMA = 'dqb_consumer';

/** Schema próprio onde o banco tem esse conceito; MySQL usa o database. */
function schemaFor(dialect: IntegrationDialect): string | undefined {
  return dialect === 'mysql' ? undefined : CATALOG_SCHEMA;
}

/**
 * Sobe `brands`/`products` como o consumidor os tinha e abre um segundo
 * `DataSource` com as entidades do catálogo.
 *
 * A DDL é explícita, e não `synchronize`, pela mesma razão do perfil: o que
 * está em jogo é o nome físico de cada coluna e o schema de cada tabela.
 */
async function openCatalog(context: IntegrationContext): Promise<Catalog> {
  const { dialect } = context;
  const schema = schemaFor(dialect);
  const q = (name: string) => context.dataSource.driver.escape(name);
  const table = (name: string) =>
    schema ? `${q(schema)}.${q(name)}` : q(name);
  const run = (sql: string) => context.dataSource.query(sql);
  const bool = dialect === 'mssql' ? 'BIT' : 'BOOLEAN';
  const text = dialect === 'postgres' ? 'TEXT' : 'VARCHAR(255)';

  await dropCatalog(context);
  if (schema) await run(`CREATE SCHEMA ${q(schema)}`);

  await run(
    `CREATE TABLE ${table('brands')} (id INT PRIMARY KEY, name ${text} NOT NULL)`
  );
  await run(
    `CREATE TABLE ${table('products')} (` +
      'id INT PRIMARY KEY, ' +
      `name ${text} NOT NULL, ` +
      `name_search ${text} NOT NULL, ` +
      'price NUMERIC(12, 2) NOT NULL, ' +
      `is_accessory ${bool} NOT NULL, ` +
      `brand_id INT NOT NULL REFERENCES ${table('brands')} (id))`
  );

  const brand = new EntitySchema<ObjectLiteral>({
    name: 'brand',
    tableName: 'brands',
    ...(schema ? { schema } : {}),
    columns: {
      id: { type: 'int', primary: true },
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
      id: { type: 'int', primary: true },
      name: { type: 'varchar' },
      name_folded: { type: 'varchar', name: 'name_search' },
      price: { type: 'decimal', precision: 12, scale: 2 },
      // SQL Server não tem `boolean`: o tipo físico é `bit`, como no perfil.
      isAccessory: {
        type: dialect === 'mssql' ? 'bit' : 'boolean',
        name: 'is_accessory',
      },
      brandId: { type: 'int', name: 'brand_id' },
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

  const dataSource = new DataSource({
    ...(context.dataSource.options as object),
    entities: [brand, product],
    synchronize: false,
  } as never);
  await dataSource.initialize();

  await dataSource.getRepository(brand).insert([
    { id: 1, name: 'Multi' },
    { id: 2, name: 'Pulse' },
  ]);
  await dataSource.getRepository(product).insert(
    [
      {
        id: 1,
        name: 'Cabo USB',
        price: '29.90',
        isAccessory: true,
        brandId: 1,
      },
      { id: 2, name: 'Mouse', price: '59.90', isAccessory: false, brandId: 1 },
      { id: 3, name: 'Fone', price: '99.90', isAccessory: false, brandId: 2 },
    ].map((row) => ({ ...row, name_folded: foldText(row.name) }))
  );

  const repositories = {
    brand: dataSource.getRepository(brand),
    product: dataSource.getRepository(product),
  };

  return {
    repository: (name) => repositories[name],
    productRules: defineQueryRules(
      buildSchemaRegistry(repositories.product),
      'product',
      {
        filters: [
          { path: 'price', operators: ['eq', 'gte', 'lte', 'between'] },
        ],
        sorts: ['id'],
        fields: {
          root: { allowed: ['id', 'price'], default: ['id', 'price'] },
        },
      }
    ),
    brandRules: defineQueryRules(
      buildSchemaRegistry(repositories.brand),
      'brand',
      {
        filters: [
          { path: 'products.isAccessory', operators: ['eq'] },
          { path: 'products.price', operators: ['gte'] },
        ],
        sorts: ['id'],
        fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
        search: ['products.name'],
      }
    ),
    drop: async () => {
      await dataSource.destroy();
      await dropCatalog(context);
    },
  };
}

/** Remove o catálogo, inclusive o de uma execução anterior interrompida. */
async function dropCatalog(context: IntegrationContext): Promise<void> {
  const { dialect } = context;
  const schema = schemaFor(dialect);
  const q = (name: string) => context.dataSource.driver.escape(name);
  const table = (name: string) =>
    schema ? `${q(schema)}.${q(name)}` : q(name);
  const run = (sql: string) => context.dataSource.query(sql);

  if (dialect === 'postgres') {
    await run(`DROP SCHEMA IF EXISTS ${q(CATALOG_SCHEMA)} CASCADE`);
    return;
  }
  await run(`DROP TABLE IF EXISTS ${table('products')}`);
  await run(`DROP TABLE IF EXISTS ${table('brands')}`);
  if (dialect === 'mssql') {
    await run(
      `IF SCHEMA_ID('${CATALOG_SCHEMA}') IS NOT NULL DROP SCHEMA ${q(CATALOG_SCHEMA)}`
    );
  }
}
