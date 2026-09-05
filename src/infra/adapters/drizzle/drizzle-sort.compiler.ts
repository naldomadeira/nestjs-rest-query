import type { TypedQueryPlan } from '@core/query-plan';
import type { DrizzleJoinPlanner } from './drizzle-join-planner';
import type { DrizzleOrderBy } from './drizzle-statement.interface';

/**
 * Sorts + tie-break -> `ORDER BY` (spec §14).
 *
 * A junção usada pela ordenação é de apresentação: ordenar por uma relação
 * ausente não pode descartar o root, senão a mesma query devolveria conjuntos
 * diferentes conforme o sort.
 */
export function compileOrderBy(
  plan: TypedQueryPlan,
  planner: DrizzleJoinPlanner
): readonly DrizzleOrderBy[] {
  return [...plan.sorts, ...plan.tieBreak].map((sort) => {
    const ref = planner.ref(sort.column, 'presentation');
    return {
      alias: ref.alias,
      column: ref.column,
      direction: sort.direction,
    };
  });
}
