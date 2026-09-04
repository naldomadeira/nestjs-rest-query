import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  RestQueryAdapterV3,
} from '@contracts/v3';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { QuerySchema } from '@core/schema';
import { compileWhere } from './drizzle-filter.compiler';
import { DrizzleJoinPlanner } from './drizzle-join-planner';
import { compileProjection } from './drizzle-projection.compiler';
import { buildSourceSchema } from './drizzle-schema.resolver';
import { compileOrderBy } from './drizzle-sort.compiler';
import type {
  CompiledDrizzleQuery,
  DrizzleNativeQuery,
  DrizzleSourceInput,
  DrizzleSourceOptions,
  DrizzleStatement,
} from './drizzle-statement.interface';

const ESCAPE_CHARACTER = '!';

/**
 * Adapter Drizzle (spec §15.3).
 *
 * O plano compila para um statement completo e explícito — aliases, junções,
 * condições, ordenação e paginação — e o executor do consumidor materializa
 * esse statement no dialeto. A fronteira é declarada, não implícita: enquanto o
 * Drizzle 1.x estiver em RC, a v3 não promete a célula real (fase 5).
 */
export class DrizzleAdapter implements RestQueryAdapterV3<
  DrizzleSourceInput,
  CompiledDrizzleQuery,
  object,
  DrizzleNativeQuery
> {
  readonly id = 'drizzle' as const;

  async describe(source: DrizzleSourceInput): Promise<QuerySchema> {
    return source.schema;
  }

  capabilities(source: DrizzleSourceInput): AdapterCapabilities {
    return {
      dialect: source.dialect,
      transactionalConsistency: false,
      escapeCharacter: ESCAPE_CHARACTER,
      // O compilador emite a cláusula ESCAPE, então vale em todo dialeto.
      patternEscape: 'clause',
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: DrizzleSourceInput
  ): CompiledDrizzleQuery {
    const planner = new DrizzleJoinPlanner(source.table, source.relations);

    // A ordem importa: where e order registram junções de predicado, o select
    // registra as de apresentação, e só então o count fica com o subconjunto
    // de predicado.
    const where = compileWhere(plan, {
      planner,
      escapeCharacter: ESCAPE_CHARACTER,
      dialect: source.dialect,
    });
    const orderBy = compileOrderBy(plan, planner);
    const projection = compileProjection(plan, planner);

    const data: DrizzleStatement = {
      dialect: source.dialect,
      table: source.table.name,
      alias: planner.rootAlias,
      select: projection.select,
      joins: planner.all(),
      ...(where ? { where } : {}),
      orderBy,
      ...(plan.pagination.paginate
        ? {
            limit: plan.pagination.perPage,
            offset: (plan.pagination.page - 1) * plan.pagination.perPage,
          }
        : {}),
      countOnly: false,
      rootKey: plan.schema.primaryKey,
      manyProjections: projection.many,
    };

    const count: DrizzleStatement = {
      dialect: source.dialect,
      table: source.table.name,
      alias: planner.rootAlias,
      select: [],
      joins: planner.predicateOnly(),
      ...(where ? { where } : {}),
      orderBy: [],
      countOnly: true,
      rootKey: plan.schema.primaryKey,
      manyProjections: [],
    };

    return {
      db: source.db,
      data,
      count,
      paginate: plan.pagination.paginate,
    };
  }

  customize(
    compiled: CompiledDrizzleQuery,
    callback: (native: DrizzleNativeQuery) => void,
    scope: CustomizeScope = 'both'
  ): void {
    if (scope === 'data' || scope === 'both') {
      callback({ kind: 'data', statement: compiled.data });
    }
    if (scope === 'count' || scope === 'both') {
      callback({ kind: 'count', statement: compiled.count });
    }
  }

  async execute(
    compiled: CompiledDrizzleQuery
  ): Promise<AdapterResult<object>> {
    const rows = await compiled.db.executeData(compiled.data);
    const total = compiled.paginate
      ? await compiled.db.executeCount(compiled.count)
      : undefined;

    return {
      rows,
      total,
      queryCount: compiled.paginate ? 2 : 1,
    };
  }
}

const sharedAdapter = new DrizzleAdapter();

/** Source discriminada do Drizzle (spec §8.1). */
export function drizzleSource(
  options: DrizzleSourceOptions
): QuerySource<
  DrizzleSourceInput,
  CompiledDrizzleQuery,
  object,
  DrizzleNativeQuery
> {
  const relations = options.relations ?? {};

  // O executor compila SQL para um dialeto; a source declara outro. Divergir
  // não dá erro em lugar nenhum — dá resultado errado, porque `LIMIT` versus
  // `OFFSET/FETCH` e a coerção de boolean saem do dialeto. Falha fechado aqui.
  if (
    options.db.dialect !== undefined &&
    options.db.dialect !== options.dialect
  ) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Drizzle source declares dialect ${options.dialect} but its executor materializes ${options.db.dialect}`,
      { sourceDialect: options.dialect, executorDialect: options.db.dialect }
    );
  }

  return {
    kind: 'drizzle',
    adapter: sharedAdapter,
    input: {
      db: options.db,
      dialect: options.dialect,
      table: options.table,
      relations,
      schema: buildSourceSchema(options.table, relations),
    },
  };
}
