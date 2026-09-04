import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { DrizzleJoinPlanner } from './drizzle-join-planner';
import type { DrizzleSelection } from './drizzle-statement.interface';

/**
 * `internalProjection` -> seleções qualificadas (spec §13).
 *
 * Cada alias é projetado explicitamente; não existe `SELECT *` nem PK de root
 * presumida. Projeção através de relação `many` ainda não é suportada e falha
 * fechado: o adapter não tem hidratação em duas fases (fase 5 do plano), e
 * devolver só as colunas do root seria exatamente a degradação silenciosa que
 * a §3 proíbe.
 */
export function compileSelect(
  plan: TypedQueryPlan,
  planner: DrizzleJoinPlanner
): readonly DrizzleSelection[] {
  const selections: DrizzleSelection[] = plan.internalProjection.root.map(
    (column) => ({ alias: planner.rootAlias, column, path: '' })
  );

  for (const [path, columns] of plan.internalProjection.relations) {
    const relationPath = path.split('.');

    if (planner.crossesMany(relationPath)) {
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Drizzle adapter cannot project through the to-many relation ${path}`,
        { path }
      );
    }

    const alias = planner.join(relationPath, 'presentation');
    for (const column of columns) {
      selections.push({ alias, column, path });
    }
  }

  return selections;
}
