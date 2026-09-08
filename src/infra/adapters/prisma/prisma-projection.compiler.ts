import type { TypedQueryPlan } from '@core/query-plan';
import type { PrismaSelect } from './prisma-query.interface';

/**
 * `internalProjection` -> árvore `select` do Prisma (spec §13).
 *
 * Usa a projeção interna, não a do cliente: ela já carrega as PKs necessárias
 * para hidratar e deduplicar, que o normalizador remove do JSON depois.
 */
export function compileSelect(plan: TypedQueryPlan): PrismaSelect {
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
  const current = select[head];
  const relationSelect =
    current && current !== true ? current.select : ({} as PrismaSelect);
  select[head] = { select: relationSelect };

  if (tail.length === 0) {
    for (const column of columns) relationSelect[column] = true;
    return;
  }

  mergeRelationSelect(relationSelect, tail, columns);
}
