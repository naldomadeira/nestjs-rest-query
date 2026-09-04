import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  RestQueryAdapterV3,
  SqlDialect,
} from '@contracts/v3';
import { configurationError } from '@core/errors';
import { CivilDate, DecimalValue } from '@core/coercion';
import type { TypedQueryPlan } from '@core/query-plan';
import type { PlanFilter, PlanSearchTarget } from '@core/semantic-validator';
import type { QuerySchema, SchemaRegistry } from '@core/schema';

export type PrismaProvider = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

export interface PrismaModelManifest {
  readonly delegate: string;
}

export interface PrismaManifest {
  readonly provider: PrismaProvider;
  readonly registry: SchemaRegistry;
  readonly models: Readonly<Record<string, PrismaModelManifest>>;
}

export interface PrismaManifestInput {
  readonly provider: PrismaProvider;
  readonly registry: SchemaRegistry;
  readonly models: Readonly<Record<string, PrismaModelManifest>>;
}

export interface PrismaDelegate {
  findMany(args: PrismaQueryArgs): Promise<readonly object[]>;
  count(args: PrismaCountArgs): Promise<number>;
}

export type PrismaClientLike = Readonly<Record<string, PrismaDelegate>>;

export interface PrismaSourceInput {
  readonly client: PrismaClientLike;
  readonly delegate: PrismaDelegate;
  readonly model: string;
  readonly manifest: PrismaManifest;
}

export interface PrismaSourceOptions {
  readonly client: PrismaClientLike;
  readonly model: string;
  readonly manifest: PrismaManifest;
}

export interface PrismaQueryArgs {
  where?: PrismaWhere;
  select?: PrismaSelect;
  orderBy?: readonly PrismaOrderBy[];
  skip?: number;
  take?: number;
}

export interface PrismaCountArgs {
  where?: PrismaWhere;
}

export interface PrismaNativeQuery {
  readonly kind: 'data' | 'count';
  readonly args: PrismaQueryArgs | PrismaCountArgs;
}

export interface CompiledPrismaQuery {
  readonly delegate: PrismaDelegate;
  readonly data: PrismaQueryArgs;
  readonly count: PrismaCountArgs;
  readonly paginate: boolean;
}

export type PrismaWhere = Record<string, unknown>;
export type PrismaSelect = Record<string, true | { select: PrismaSelect }>;
export type PrismaOrderBy = Record<string, unknown>;

const DIALECT_BY_PROVIDER: Readonly<Record<PrismaProvider, SqlDialect>> = {
  postgresql: 'postgres',
  mysql: 'mysql',
  sqlserver: 'mssql',
  sqlite: 'sqlite',
};

export function createPrismaManifest(
  input: PrismaManifestInput
): PrismaManifest {
  for (const [model, entry] of Object.entries(input.models)) {
    if (!input.registry.has(model)) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma manifest model ${model} has no schema entry`,
        { model }
      );
    }
    if (!entry.delegate) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma manifest model ${model} has no delegate`,
        { model }
      );
    }
  }

  return Object.freeze({
    provider: input.provider,
    registry: input.registry,
    models: Object.freeze({ ...input.models }),
  });
}

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
    return {
      dialect: DIALECT_BY_PROVIDER[source.manifest.provider],
      transactionalConsistency: false,
      escapeCharacter: '!',
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: PrismaSourceInput
  ): CompiledPrismaQuery {
    const where = compileWhere(plan);
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

function compileWhere(plan: TypedQueryPlan): PrismaWhere | undefined {
  const and: PrismaWhere[] = [];

  for (const filter of plan.filters) {
    const compiled = compileFilter(plan, filter);
    if (compiled) and.push(compiled);
  }

  if (plan.search && plan.search.targets.length > 0) {
    and.push({
      OR: plan.search.targets.map((target) =>
        nestScalarCondition(plan, target, {
          [leaf(target.column)]: { contains: plan.search!.foldedTerm },
        })
      ),
    });
  }

  return and.length > 0 ? { AND: and } : undefined;
}

function compileFilter(
  plan: TypedQueryPlan,
  filter: PlanFilter
): PrismaWhere | undefined {
  if (filter.alwaysFalse) return { OR: [] };
  if (filter.alwaysTrue) return undefined;

  if (filter.target === 'relation') {
    return nestRelationPresence(plan, filter);
  }

  return nestScalarCondition(plan, filter, {
    [leaf(filter.column)]: scalarCondition(filter),
  });
}

function scalarCondition(filter: PlanFilter): unknown {
  const value = toPrismaValue(filter.value);

  switch (filter.operator) {
    case 'eq':
      return { equals: value };
    case 'ne':
      return { not: value };
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return { [filter.operator]: value };
    case 'between': {
      const [gte, lte] = filter.value as readonly unknown[];
      return { gte: toPrismaValue(gte), lte: toPrismaValue(lte) };
    }
    case 'in':
      return { in: toPrismaValueArray(filter.value) };
    case 'notIn':
      return { notIn: toPrismaValueArray(filter.value) };
    case 'isNull':
      return filter.value === true ? null : { not: null };
    case 'like':
    case 'ilike':
      return { contains: value };
    case 'notLike':
    case 'notIlike':
      return { not: { contains: value } };
  }
}

function nestRelationPresence(
  plan: TypedQueryPlan,
  filter: PlanFilter
): PrismaWhere {
  const segments = filter.relationPath.length
    ? filter.relationPath
    : filter.path.split('.');
  const parents = segments.slice(0, -1);
  const relationName = segments.at(-1)!;
  const model = relationParentModel(plan, parents);
  const relation = plan.registry.get(model)!.relations.get(relationName)!;

  if (relation.cardinality === 'many') {
    return nestThroughRelations(plan, plan.model, parents, {
      [relationName]: filter.value === true ? { none: {} } : { some: {} },
    });
  }

  return nestThroughRelations(plan, plan.model, parents, {
    [relationName]: filter.value === true ? { is: null } : { isNot: null },
  });
}

function nestScalarCondition(
  plan: TypedQueryPlan,
  term: PlanFilter | PlanSearchTarget,
  leafCondition: PrismaWhere
): PrismaWhere {
  return nestThroughRelations(
    plan,
    plan.model,
    term.relationPath,
    leafCondition
  );
}

function nestThroughRelations(
  plan: TypedQueryPlan,
  model: string,
  relationPath: readonly string[],
  condition: PrismaWhere
): PrismaWhere {
  if (relationPath.length === 0) return condition;

  const [head, ...tail] = relationPath;
  const relation = plan.registry.get(model)!.relations.get(head);
  if (!relation) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `No Prisma relation ${head} on ${model}`,
      { model, relation: head }
    );
  }

  const nested = nestThroughRelations(plan, relation.target, tail, condition);
  return {
    [head]: relation.cardinality === 'many' ? { some: nested } : { is: nested },
  };
}

function relationParentModel(
  plan: TypedQueryPlan,
  parents: readonly string[]
): string {
  let model = plan.model;
  for (const relationName of parents) {
    model = plan.registry.get(model)!.relations.get(relationName)!.target;
  }
  return model;
}

function compileSelect(plan: TypedQueryPlan): PrismaSelect {
  const select: PrismaSelect = {};

  for (const column of plan.internalProjection.root) {
    select[column] = true;
  }

  for (const [path, columns] of plan.internalProjection.relations) {
    mergeRelationSelect(select, path.split('.'), columns);
  }

  return select;
}

function mergeRelationSelect(
  select: PrismaSelect,
  path: readonly string[],
  columns: readonly string[]
): void {
  const [head, ...tail] = path;
  const current = select[head] as { select: PrismaSelect } | undefined;
  const relationSelect = current?.select ?? {};
  select[head] = { select: relationSelect };

  if (tail.length === 0) {
    for (const column of columns) relationSelect[column] = true;
    return;
  }

  mergeRelationSelect(relationSelect, tail, columns);
}

function compileOrderBy(plan: TypedQueryPlan): readonly PrismaOrderBy[] {
  return [...plan.sorts, ...plan.tieBreak].map((sort) =>
    nestOrderBy(sort.relationPath, leaf(sort.column), sort.direction)
  );
}

function nestOrderBy(
  relationPath: readonly string[],
  column: string,
  direction: 'asc' | 'desc'
): PrismaOrderBy {
  if (relationPath.length === 0) return { [column]: direction };
  const [head, ...tail] = relationPath;
  return { [head]: nestOrderBy(tail, column, direction) };
}

function leaf(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}

function toPrismaValueArray(value: unknown): readonly unknown[] {
  return (value as readonly unknown[]).map(toPrismaValue);
}

function toPrismaValue(value: unknown): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toPrismaValue);
  return value;
}
