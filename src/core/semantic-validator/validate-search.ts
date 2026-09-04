import { foldText } from '../text-profile';
import type { ResolvedSearch } from '../authorization';
import type { PlanSearch } from './plan-terms';

/**
 * Busca textual (spec §12).
 *
 * O termo passa pelo mesmo helper que preenche as colunas dobradas, então a
 * comparação vira igualdade de substring sobre valores já normalizados — o que
 * dá o mesmo resultado no Prisma com MySQL e SQL Server, onde não existe
 * `mode: 'insensitive'`.
 */
export function validateSearch(
  resolved: ResolvedSearch | null
): PlanSearch | null {
  if (!resolved) return null;

  return Object.freeze({
    term: resolved.term,
    foldedTerm: foldText(resolved.term),
    targets: Object.freeze(
      resolved.targets.map((target) =>
        Object.freeze({
          path: target.path,
          column: target.column,
          relationPath: target.relationPath,
        })
      )
    ),
  });
}
