import type { TypedQueryPlan } from '@core/query-plan';
import { leafColumn } from './prisma-relations';
import type { PrismaOrderBy } from './prisma-query.interface';

/**
 * Sorts + tie-break -> `orderBy` do Prisma (spec §14).
 *
 * O tie-break vem do plano, não do adapter: os três adapters ordenam pela
 * mesma chave final, senão a paginação divergiria entre ORMs.
 */
export function compileOrderBy(plan: TypedQueryPlan): readonly PrismaOrderBy[] {
  return [...plan.sorts, ...plan.tieBreak].map((sort) =>
    nestOrderBy(sort.relationPath, leafColumn(sort.column), sort.direction)
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
