import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  PatternEscapeMode,
  RestQueryAdapterV3,
  SqlDialect,
} from '@contracts/v3';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { QuerySchema } from '@core/schema';
import { compileWhere } from './prisma-filter.compiler';
import { compileSelect } from './prisma-projection.compiler';
import { compileOrderBy } from './prisma-sort.compiler';
import type {
  CompiledPrismaQuery,
  PrismaNativeQuery,
  PrismaProvider,
  PrismaQueryArgs,
  PrismaSourceInput,
  PrismaSourceOptions,
} from './prisma-query.interface';

const DIALECT_BY_PROVIDER: Readonly<Record<PrismaProvider, SqlDialect>> = {
  postgresql: 'postgres',
  mysql: 'mysql',
  sqlserver: 'mssql',
  sqlite: 'sqlite',
};

/**
 * Como cada dialeto torna `%` e `_` literais sob o Prisma (ADR-001, emenda 2).
 *
 * O Prisma nunca emite cláusula `ESCAPE` — `contains` compila para
 * `LIKE ('%' || ? || '%')` e o client tipado não permite acrescentar nada. Só
 * sobra o escape default do dialeto:
 *
 * - Postgres e MySQL têm `\` como default, então escapar o valor resolve.
 * - SQLite e SQL Server **não têm default**. Medido em SQLite:
 *   `LIKE 'a\_b'` sem cláusula casa a string literal `a\_b`, não `a_b`. Ali
 *   os cinco operadores de padrão são recusados com `CAPABILITY_UNAVAILABLE`,
 *   em vez de devolverem o conjunto errado de linhas.
 *
 * `$queryRaw` não é saída: a API tipada não aceita fragmento SQL dentro do
 * `where`, e pré-resolver para um conjunto de PKs bate no limite de 2100
 * parâmetros do SQL Server.
 */
const PATTERN_ESCAPE: Readonly<
  Record<SqlDialect, { mode: PatternEscapeMode; character: string }>
> = {
  postgres: { mode: 'native', character: '\\' },
  mysql: { mode: 'native', character: '\\' },
  sqlite: { mode: 'unsupported', character: '' },
  mssql: { mode: 'unsupported', character: '' },
};

/**
 * Adapter Prisma (spec §15.2).
 *
 * Prisma não faz join no sentido do SQL gerado pelo TypeORM: relações `many`
 * viram `some`/`none`, então o root nunca infla e a paginação em duas fases é
 * desnecessária. Data e count derivam do mesmo `where`.
 */
export class PrismaAdapter implements RestQueryAdapterV3<
  PrismaSourceInput,
  CompiledPrismaQuery,
  object,
  PrismaNativeQuery
> {
  readonly id = 'prisma' as const;

  async describe(source: PrismaSourceInput): Promise<QuerySchema> {
    const schema = source.manifest.registry.get(source.model);
    if (!schema) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma model ${source.model} is not present in the manifest`,
        { model: source.model }
      );
    }
    return schema;
  }

  capabilities(source: PrismaSourceInput): AdapterCapabilities {
    const dialect = DIALECT_BY_PROVIDER[source.manifest.provider];
    const escape = PATTERN_ESCAPE[dialect];

    return {
      dialect,
      transactionalConsistency: false,
      escapeCharacter: escape.character,
      patternEscape: escape.mode,
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: PrismaSourceInput
  ): CompiledPrismaQuery {
    const { escapeCharacter, patternEscape } = this.capabilities(source);
    const where = compileWhere(plan, { escapeCharacter, patternEscape });
    const data: PrismaQueryArgs = {
      ...(where ? { where } : {}),
      select: compileSelect(plan),
      orderBy: compileOrderBy(plan),
      ...(plan.pagination.paginate
        ? {
            skip: (plan.pagination.page - 1) * plan.pagination.perPage,
            take: plan.pagination.perPage,
          }
        : {}),
    };

    return {
      delegate: source.delegate,
      data,
      count: where ? { where } : {},
      paginate: plan.pagination.paginate,
    };
  }

  customize(
    compiled: CompiledPrismaQuery,
    callback: (native: PrismaNativeQuery) => void,
    scope: CustomizeScope = 'both'
  ): void {
    if (scope === 'data' || scope === 'both') {
      callback({ kind: 'data', args: compiled.data });
    }
    if (scope === 'count' || scope === 'both') {
      callback({ kind: 'count', args: compiled.count });
    }
  }

  async execute(compiled: CompiledPrismaQuery): Promise<AdapterResult<object>> {
    const rows = await compiled.delegate.findMany(compiled.data);
    const total = compiled.paginate
      ? await compiled.delegate.count(compiled.count)
      : undefined;

    return {
      rows,
      total,
      queryCount: compiled.paginate ? 2 : 1,
    };
  }
}

const sharedAdapter = new PrismaAdapter();

/**
 * Source discriminada do Prisma (spec §8.1).
 *
 * O delegate é resolvido pelo manifesto, nunca por uma string livre vinda do
 * chamador: model fora do manifesto e delegate ausente do client falham antes
 * de qualquer query.
 */
export function prismaSource(
  options: PrismaSourceOptions
): QuerySource<
  PrismaSourceInput,
  CompiledPrismaQuery,
  object,
  PrismaNativeQuery
> {
  const model = options.manifest.models[options.model];
  if (!model) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Prisma model ${options.model} is not present in the manifest`,
      { model: options.model }
    );
  }

  const delegate = options.client[model.delegate];
  if (!delegate) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Prisma delegate ${model.delegate} for model ${options.model} is missing from the client`,
      { model: options.model, delegate: model.delegate }
    );
  }

  return {
    kind: 'prisma',
    adapter: sharedAdapter,
    input: {
      client: options.client,
      delegate,
      model: options.model,
      manifest: options.manifest,
    },
  };
}
