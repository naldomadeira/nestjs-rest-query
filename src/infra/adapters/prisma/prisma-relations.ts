import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { PrismaWhere } from './prisma-query.interface';

/**
 * Aninha uma condição sob a cadeia de relações (spec §15.2).
 *
 * Relação `many` usa `some`, que é o `EXISTS` do Prisma: o root nunca infla e
 * o `total` continua correto sem `distinct`.
 */
export function nestThroughRelations(
  plan: TypedQueryPlan,
  model: string,
  relationPath: readonly string[],
  condition: PrismaWhere
): PrismaWhere {
  if (relationPath.length === 0) return condition;

  const [head, ...tail] = relationPath;
  const relation = plan.registry.get(model)?.relations.get(head);
  if (!relation) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `No Prisma relation ${head} on ${model}`,
      { model, relation: head }
    );
  }

  const nested = nestThroughRelations(plan, relation.target, tail, condition);
  return {
    [head]: relation.cardinality === 'many' ? { some: nested } : { is: nested },
  };
}

/** Model dono da última relação de uma cadeia de parents. */
export function relationParentModel(
  plan: TypedQueryPlan,
  parents: readonly string[]
): string {
  let model = plan.model;
  for (const relationName of parents) {
    const relation = plan.registry.get(model)?.relations.get(relationName);
    if (!relation) {
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `No Prisma relation ${relationName} on ${model}`,
        { model, relation: relationName }
      );
    }
    model = relation.target;
  }
  return model;
}

/** Último segmento de um path pontuado: a coluna física da folha. */
export function leafColumn(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}
