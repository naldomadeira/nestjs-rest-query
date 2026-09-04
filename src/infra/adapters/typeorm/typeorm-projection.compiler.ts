import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import { ROOT_ALIAS, type JoinPlan } from './typeorm-join-planner';

/**
 * Projeção explícita por alias (spec §15.1).
 *
 * Três coisas que a v2 errava e aqui são garantidas: a PK vem do schema, não
 * de `${alias}.id` fixo; `fields` combinado com `includes` mantém as colunas da
 * relação; e um join criado só para filtrar não entra no SELECT, então não
 * aparece no JSON.
 */
export function compileProjection<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  plan: TypedQueryPlan,
  joins: JoinPlan
): void {
  const columns: string[] = plan.internalProjection.root.map(
    (column) => `${ROOT_ALIAS}.${column}`
  );

  for (const [relationPath, relationColumns] of plan.internalProjection
    .relations) {
    const node = joins.nodes.get(relationPath);
    if (!node) {
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Projection for ${relationPath} has no planned join`,
        { path: relationPath }
      );
    }
    if (!node.presentation) continue;

    for (const column of relationColumns) {
      columns.push(`${node.alias}.${column}`);
    }
  }

  qb.select(columns);
}

/** Cria os joins planejados, na ordem em que foram registrados. */
export function compileJoins<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  joins: JoinPlan
): void {
  for (const node of joins.nodes.values()) {
    qb.leftJoin(`${node.parentAlias}.${node.property}`, node.alias);
  }
}
