import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { TypedQueryPlan } from '@core/query-plan';
import {
  columnRef,
  type FilterCompilerContext,
} from './typeorm-filter.compiler';

/**
 * ORDER BY na ordem `sorts` seguida de `tieBreak` (spec §14).
 *
 * A chave de desempate nunca é opcional: sem ela, duas páginas com valores
 * empatados podem repetir ou perder linhas.
 */
export function compileSort<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  plan: TypedQueryPlan,
  context: FilterCompilerContext
): void {
  let first = true;

  for (const sort of [...plan.sorts, ...plan.tieBreak]) {
    const column = columnRef(sort.column, context);
    const direction = sort.direction === 'desc' ? 'DESC' : 'ASC';

    if (first) {
      qb.orderBy(column, direction);
      first = false;
    } else {
      qb.addOrderBy(column, direction);
    }
  }
}
