import { parseQueryInput, type QueryInputLike } from '../query-parser';
import { authorize, type CompiledQueryRules } from '../authorization';
import { requireSchema, resolvePath, type SchemaRegistry } from '../schema';
import {
  validateFilterTerm,
  validatePagination,
  validateSearch,
  validateSort,
  type PaginationLimits,
} from '../semantic-validator';
import { freezePlan } from './freeze-plan';
import type {
  ConsistencyMode,
  PlanProjection,
  TextProfile,
  TypedQueryPlan,
} from './typed-query-plan';

export interface BuildPlanOptions {
  readonly pagination?: Partial<PaginationLimits>;
  readonly textProfile?: TextProfile;
  readonly consistency?: ConsistencyMode;
}

const DEFAULT_LIMITS: PaginationLimits = {
  defaultPerPage: 20,
  maxPerPage: 100,
};

/**
 * Entrada HTTP -> plano tipado (spec §7).
 *
 * A ordem importa: sintaxe, depois autorização, depois coerção. Um path não
 * autorizado nunca chega ao codec, e um valor nunca é coagido antes de sabermos
 * que o campo existe e que o operador é válido para ele.
 */
export function buildQueryPlan(
  input: QueryInputLike,
  rules: CompiledQueryRules,
  options: BuildPlanOptions = {}
): TypedQueryPlan {
  const ast = parseQueryInput(input);
  const resolved = authorize(ast, rules);

  const { sorts, tieBreak } = validateSort(
    resolved.sorts,
    rules.registry,
    rules.model
  );

  const projection: PlanProjection = Object.freeze({
    root: resolved.projection.root,
    relations: resolved.projection.relations,
  });

  const plan: TypedQueryPlan = {
    model: rules.model,
    registry: rules.registry,
    schema: requireSchema(rules.registry, rules.model),
    filters: resolved.filters.map(validateFilterTerm),
    search: validateSearch(resolved.search),
    sorts,
    tieBreak,
    projection,
    internalProjection: buildInternalProjection(
      rules.registry,
      rules.model,
      projection,
      resolved.includes
    ),
    includes: resolved.includes,
    pagination: validatePagination(resolved.pagination, {
      ...DEFAULT_LIMITS,
      ...options.pagination,
    }),
    textProfile: options.textProfile ?? 'portable-strict',
    consistency: options.consistency ?? 'eventual',
  };

  return freezePlan(plan);
}

/**
 * A projeção visível mais as PKs de cada nível.
 *
 * As PKs são necessárias para hidratar relações, deduplicar roots e paginar,
 * mas saem do JSON se o cliente não as pediu (spec §13).
 */
function buildInternalProjection(
  registry: SchemaRegistry,
  rootModel: string,
  projection: PlanProjection,
  includes: readonly string[]
): PlanProjection {
  const rootSchema = requireSchema(registry, rootModel);

  const relations = new Map<string, readonly string[]>();
  for (const relationPath of includes) {
    const target = resolvePath(registry, rootModel, relationPath, {
      allowRelationLeaf: true,
    });
    const schema = requireSchema(registry, target.ownerModel);
    relations.set(
      relationPath,
      withPrimaryKey(schema.primaryKey, projection.relations.get(relationPath))
    );
  }

  return Object.freeze({
    root: withPrimaryKey(rootSchema.primaryKey, projection.root),
    relations,
  });
}

function withPrimaryKey(
  primaryKey: readonly string[],
  visible: readonly string[] = []
): readonly string[] {
  const columns = [...primaryKey];
  for (const column of visible) {
    if (!columns.includes(column)) columns.push(column);
  }
  return Object.freeze(columns);
}
