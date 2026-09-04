import type { SqlDialect } from '@contracts/v3';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { PlanFilter } from '@core/semantic-validator';
import { containsPattern } from '../shared/escape-pattern';
import type { DrizzleJoinPlanner } from './drizzle-join-planner';
import { toDriverValue } from './drizzle-value';
import type {
  DrizzleColumnRef,
  DrizzleCondition,
} from './drizzle-statement.interface';

export interface DrizzleFilterContext {
  readonly planner: DrizzleJoinPlanner;
  readonly escapeCharacter: string;
  readonly dialect: SqlDialect;
}

/**
 * Filtros + search -> condição única (spec §11 e §12).
 *
 * Termos que cruzam uma relação `many` viram `EXISTS` correlacionado; os
 * demais viram comparações sobre a junção já registrada pelo planner.
 */
export function compileWhere(
  plan: TypedQueryPlan,
  context: DrizzleFilterContext
): DrizzleCondition | undefined {
  const terms: DrizzleCondition[] = plan.filters.map((filter) =>
    compileFilter(filter, context)
  );

  const search = plan.search;
  if (search && search.targets.length > 0) {
    terms.push({
      op: 'or',
      terms: search.targets.map((target) =>
        scoped(target.relationPath, target.column, context, (ref) =>
          likeCondition(ref, search.foldedTerm, context.escapeCharacter, false)
        )
      ),
    });
  }

  return terms.length > 0 ? { op: 'and', terms } : undefined;
}

export function compileFilter(
  filter: PlanFilter,
  context: DrizzleFilterContext
): DrizzleCondition {
  if (filter.alwaysFalse) return { op: 'alwaysFalse' };
  if (filter.alwaysTrue) return { op: 'alwaysTrue' };

  if (filter.target === 'relation') {
    return compileRelationPresence(filter, context);
  }

  return scoped(filter.relationPath, filter.column, context, (ref) =>
    scalarCondition(ref, filter, context.escapeCharacter, context.dialect)
  );
}

/**
 * Aplica uma condição no escopo certo do caminho.
 *
 * Caminho só com relações `one` compara sobre a junção; qualquer salto `many`
 * empurra a comparação para dentro de um `EXISTS` correlacionado, que é o que
 * mantém o root sem inflar e o `total` correto (spec §14).
 */
function scoped(
  relationPath: readonly string[],
  columnPath: string,
  context: DrizzleFilterContext,
  make: (ref: DrizzleColumnRef) => DrizzleCondition
): DrizzleCondition {
  if (!context.planner.crossesMany(relationPath)) {
    return make(context.planner.ref(columnPath, 'predicate'));
  }

  const joins = context.planner.existsChain(relationPath);
  const segments = columnPath.split('.');

  return {
    op: 'exists',
    relationPath,
    joins,
    where: make({
      alias: joins[joins.length - 1].alias,
      column: segments[segments.length - 1],
    }),
    negated: false,
  };
}

/**
 * `filter[relation][isNull]` (spec §11.1).
 *
 * Usa `EXISTS` negado para as duas cardinalidades. Testar a FK do lado de
 * origem só funcionaria quando a coluna estivesse no root, e o mesmo path pode
 * ser declarado pela ponta inversa.
 */
function compileRelationPresence(
  filter: PlanFilter,
  context: DrizzleFilterContext
): DrizzleCondition {
  const relationPath = filter.path.split('.');
  // A relação terminal precisa ficar dentro da subconsulta: juntá-la no
  // statement externo transformaria "não tem" em "tem, com colunas nulas".
  const subqueryFrom = context.planner.oneOnlyPrefix(
    relationPath.slice(0, -1)
  ).length;

  return {
    op: 'exists',
    relationPath,
    joins: context.planner.existsChain(relationPath, subqueryFrom),
    negated: filter.value === true,
  };
}

export function scalarCondition(
  ref: DrizzleColumnRef,
  filter: PlanFilter,
  escapeCharacter: string,
  dialect: SqlDialect
): DrizzleCondition {
  const value = toDriverValue(filter.value, dialect);

  switch (filter.operator) {
    case 'eq':
      return { op: 'compare', ref, comparator: '=', value };
    case 'ne':
      return { op: 'compare', ref, comparator: '<>', value };
    case 'gt':
      return { op: 'compare', ref, comparator: '>', value };
    case 'gte':
      return { op: 'compare', ref, comparator: '>=', value };
    case 'lt':
      return { op: 'compare', ref, comparator: '<', value };
    case 'lte':
      return { op: 'compare', ref, comparator: '<=', value };
    case 'in':
      return { op: 'in', ref, values: value as readonly unknown[] };
    case 'notIn':
      return { op: 'notIn', ref, values: value as readonly unknown[] };
    case 'between': {
      const [from, to] = value as readonly unknown[];
      return { op: 'between', ref, from, to };
    }
    case 'isNull':
      return { op: 'null', ref, negated: filter.value !== true };
    // `%` e `_` são literais na v3: o padrão é escapado e a cláusula ESCAPE
    // acompanha, em vez de depender do default do dialeto.
    case 'like':
    case 'ilike':
      return likeCondition(ref, String(value), escapeCharacter, false);
    case 'notLike':
    case 'notIlike':
      return likeCondition(ref, String(value), escapeCharacter, true);
    default:
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Drizzle adapter cannot compile operator ${filter.operator}`,
        { path: filter.path, operator: filter.operator }
      );
  }
}

/**
 * `LIKE` sobre a coluna dobrada, nunca `ILIKE`.
 *
 * `ilike()` do Drizzle compila para `ilike` literal no dialeto MySQL e não
 * existe no SQL Server; o perfil portável resolve isso comparando a coluna
 * dobrada com o termo dobrado (spec §12).
 */
function likeCondition(
  ref: DrizzleColumnRef,
  value: string,
  escapeCharacter: string,
  negated: boolean
): DrizzleCondition {
  return {
    op: 'like',
    ref,
    value: containsPattern(value, escapeCharacter),
    escape: escapeCharacter,
    negated,
  };
}
