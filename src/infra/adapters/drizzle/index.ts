import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  RestQueryAdapterV3,
  SqlDialect,
} from '@contracts/v3';
import { CivilDate, DecimalValue } from '@core/coercion';
import type { TypedQueryPlan } from '@core/query-plan';
import {
  defineQuerySchema,
  type QuerySchema,
  type ScalarKind,
} from '@core/schema';
import type { PlanFilter, PlanSearchTarget } from '@core/semantic-validator';

export interface DrizzleColumn {
  readonly name: string;
  readonly kind: ScalarKind;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  readonly internal?: boolean;
  readonly foldedField?: string;
  readonly portableOrderField?: string;
}

export interface DrizzleTable {
  readonly name: string;
  readonly model: string;
  readonly columns: Readonly<Record<string, DrizzleColumn>>;
}

export interface DrizzleRelation {
  readonly target: DrizzleTable;
  readonly cardinality: 'one' | 'many';
  readonly nullable: boolean;
  readonly sourceColumn: string;
  readonly targetColumn: string;
}

export interface DrizzleDatabase {
  executeData(statement: DrizzleStatement): Promise<readonly object[]>;
  executeCount(statement: DrizzleStatement): Promise<number>;
}

export interface DrizzleSourceInput {
  readonly db: DrizzleDatabase;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations: Readonly<Record<string, DrizzleRelation>>;
  readonly schema: QuerySchema;
}

export interface DrizzleSourceOptions {
  readonly db: DrizzleDatabase;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations?: Readonly<Record<string, DrizzleRelation>>;
}

export interface DrizzleStatement {
  readonly dialect: SqlDialect;
  readonly table: string;
  readonly select: readonly string[];
  where?: DrizzleCondition;
  readonly orderBy: readonly DrizzleOrderBy[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface DrizzleOrderBy {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export type DrizzleCondition =
  | { readonly op: 'and' | 'or'; readonly terms: readonly DrizzleCondition[] }
  | {
      readonly op: 'compare';
      readonly column: string;
      readonly comparator: '=' | '<>' | '>' | '>=' | '<' | '<=';
      readonly value: unknown;
    }
  | {
      readonly op: 'in' | 'notIn';
      readonly column: string;
      readonly values: readonly unknown[];
    }
  | {
      readonly op: 'between';
      readonly column: string;
      readonly from: unknown;
      readonly to: unknown;
    }
  | {
      readonly op: 'null';
      readonly column: string;
      readonly negated: boolean;
    }
  | {
      readonly op: 'like';
      readonly column: string;
      readonly value: string;
      readonly escape: string;
      readonly negated: boolean;
    }
  | {
      readonly op: 'exists';
      readonly relation: string;
      readonly sourceColumn: string;
      readonly targetColumn: string;
      readonly where?: DrizzleCondition;
      readonly negated: boolean;
    }
  | { readonly op: 'alwaysFalse' }
  | { readonly op: 'alwaysTrue' };

export interface DrizzleNativeQuery {
  readonly kind: 'data' | 'count';
  readonly statement: DrizzleStatement;
}

export interface CompiledDrizzleQuery {
  readonly db: DrizzleDatabase;
  readonly data: DrizzleStatement;
  readonly count: DrizzleStatement;
  readonly paginate: boolean;
}

const ESCAPE_CHARACTER = '!';

export function createDrizzleTable(input: DrizzleTable): DrizzleTable {
  return Object.freeze({
    ...input,
    columns: Object.freeze({ ...input.columns }),
  });
}

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
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: DrizzleSourceInput
  ): CompiledDrizzleQuery {
    const where = combineAnd([
      ...plan.filters.map((filter) => compileFilter(source, filter)),
      compileSearch(
        source,
        plan.search?.targets ?? [],
        plan.search?.foldedTerm
      ),
    ]);

    const data: DrizzleStatement = {
      dialect: source.dialect,
      table: source.table.name,
      select: compileSelect(source, plan),
      ...(where ? { where } : {}),
      orderBy: [...plan.sorts, ...plan.tieBreak].map((sort) => ({
        column: qualify(source, sort.column),
        direction: sort.direction,
      })),
      ...(plan.pagination.paginate
        ? {
            limit: plan.pagination.perPage,
            offset: (plan.pagination.page - 1) * plan.pagination.perPage,
          }
        : {}),
    };

    return {
      db: source.db,
      data,
      count: {
        ...data,
        select: ['count'],
        limit: undefined,
        offset: undefined,
      },
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

export function drizzleSource(
  options: DrizzleSourceOptions
): QuerySource<
  DrizzleSourceInput,
  CompiledDrizzleQuery,
  object,
  DrizzleNativeQuery
> {
  const relations = options.relations ?? {};
  const schema = defineQuerySchema({
    model: options.table.model,
    primaryKey: Object.entries(options.table.columns)
      .filter(([, column]) => column.primaryKey)
      .map(([path]) => path),
    fields: Object.entries(options.table.columns).map(([path, column]) => ({
      path,
      kind: column.kind,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      internal: column.internal,
      foldedField: column.foldedField,
      portableOrderField: column.portableOrderField,
    })),
    relations: Object.entries(relations).map(([path, relation]) => ({
      path,
      target: relation.target.model,
      cardinality: relation.cardinality,
      nullable: relation.nullable,
    })),
  });

  return {
    kind: 'drizzle',
    adapter: sharedAdapter,
    input: {
      db: options.db,
      dialect: options.dialect,
      table: options.table,
      relations,
      schema,
    },
  };
}

function compileFilter(
  source: DrizzleSourceInput,
  filter: PlanFilter
): DrizzleCondition {
  if (filter.alwaysFalse) return { op: 'alwaysFalse' };
  if (filter.alwaysTrue) return { op: 'alwaysTrue' };

  if (filter.existential || filter.target === 'relation') {
    return compileRelationFilter(source, filter);
  }

  return scalarCondition(qualify(source, filter.column), filter);
}

function compileRelationFilter(
  source: DrizzleSourceInput,
  filter: PlanFilter
): DrizzleCondition {
  const relationName = filter.relationPath[0] ?? filter.path;
  const relation = source.relations[relationName];
  const where =
    filter.target === 'scalar'
      ? scalarCondition(qualify(source, filter.column), filter)
      : undefined;

  return {
    op: 'exists',
    relation: relationName,
    sourceColumn: `${source.table.name}.${relation.sourceColumn}`,
    targetColumn: `${relation.target.name}.${relation.targetColumn}`,
    ...(where ? { where } : {}),
    negated: filter.target === 'relation' && filter.value === true,
  };
}

function scalarCondition(column: string, filter: PlanFilter): DrizzleCondition {
  const value = toDriverValue(filter.value);

  switch (filter.operator) {
    case 'eq':
      return { op: 'compare', column, comparator: '=', value };
    case 'ne':
      return { op: 'compare', column, comparator: '<>', value };
    case 'gt':
      return { op: 'compare', column, comparator: '>', value };
    case 'gte':
      return { op: 'compare', column, comparator: '>=', value };
    case 'lt':
      return { op: 'compare', column, comparator: '<', value };
    case 'lte':
      return { op: 'compare', column, comparator: '<=', value };
    case 'in':
      return {
        op: 'in',
        column,
        values: (filter.value as readonly unknown[]).map(toDriverValue),
      };
    case 'notIn':
      return {
        op: 'notIn',
        column,
        values: (filter.value as readonly unknown[]).map(toDriverValue),
      };
    case 'between': {
      const [from, to] = filter.value as readonly unknown[];
      return {
        op: 'between',
        column,
        from: toDriverValue(from),
        to: toDriverValue(to),
      };
    }
    case 'isNull':
      return { op: 'null', column, negated: filter.value !== true };
    case 'like':
    case 'ilike':
      return {
        op: 'like',
        column,
        value: containsPattern(String(value)),
        escape: ESCAPE_CHARACTER,
        negated: false,
      };
    case 'notLike':
    case 'notIlike':
      return {
        op: 'like',
        column,
        value: containsPattern(String(value)),
        escape: ESCAPE_CHARACTER,
        negated: true,
      };
  }
}

function compileSearch(
  source: DrizzleSourceInput,
  targets: readonly PlanSearchTarget[],
  foldedTerm?: string
): DrizzleCondition | undefined {
  if (!foldedTerm || targets.length === 0) return undefined;
  return combineOr(
    targets.map((target) => ({
      op: 'like',
      column: qualify(source, target.column),
      value: containsPattern(foldedTerm),
      escape: ESCAPE_CHARACTER,
      negated: false,
    }))
  );
}

function compileSelect(
  source: DrizzleSourceInput,
  plan: TypedQueryPlan
): readonly string[] {
  const root = plan.internalProjection.root.map((column) =>
    qualify(source, column)
  );
  const relations = [...plan.internalProjection.relations].flatMap(
    ([path, columns]) => {
      const relation = source.relations[path];
      if (!relation) return [];
      return columns.map((column) => `${relation.target.name}.${column}`);
    }
  );
  return [...root, ...relations];
}

function combineAnd(
  terms: readonly (DrizzleCondition | undefined)[]
): DrizzleCondition | undefined {
  const actual = terms.filter(Boolean) as DrizzleCondition[];
  return actual.length === 0 ? undefined : { op: 'and', terms: actual };
}

function combineOr(terms: readonly DrizzleCondition[]): DrizzleCondition {
  return { op: 'or', terms };
}

function qualify(source: DrizzleSourceInput, path: string): string {
  if (!path.includes('.')) return `${source.table.name}.${path}`;
  const [relationName, column] = path.split('.');
  const relation = source.relations[relationName];
  return `${relation?.target.name ?? relationName}.${column}`;
}

function containsPattern(value: string): string {
  const escaped = value
    .replaceAll('!', '!!')
    .replaceAll('%', '!%')
    .replaceAll('_', '!_');
  return `%${escaped}%`;
}

function toDriverValue(value: unknown): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  return value;
}
