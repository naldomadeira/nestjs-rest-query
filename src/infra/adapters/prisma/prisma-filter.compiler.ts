import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { PlanFilter, PlanSearchTarget } from '@core/semantic-validator';
import {
  leafColumn,
  nestThroughRelations,
  relationParentModel,
} from './prisma-relations';
import { toPrismaValue, toPrismaValueArray } from './prisma-value';
import type { PrismaWhere } from './prisma-query.interface';

/**
 * Filtros + search -> `where` do Prisma (spec §11 e §12).
 *
 * O termo de busca compara literalmente a coluna dobrada; `mode: 'insensitive'`
 * nunca é emitido, porque MySQL e SQL Server não o expõem no client gerado.
 */
export function compileWhere(plan: TypedQueryPlan): PrismaWhere | undefined {
  const and: PrismaWhere[] = [];

  for (const filter of plan.filters) {
    const compiled = compileFilter(plan, filter);
    if (compiled) and.push(compiled);
  }

  const search = plan.search;
  if (search && search.targets.length > 0) {
    and.push({
      OR: search.targets.map((target) =>
        nestSearchTarget(plan, target, search.foldedTerm)
      ),
    });
  }

  return and.length > 0 ? { AND: and } : undefined;
}

export function compileFilter(
  plan: TypedQueryPlan,
  filter: PlanFilter
): PrismaWhere | undefined {
  // `in=[]` é sempre falso; `notIn=[]` é sempre verdadeiro e some do AND.
  //
  // A condição falsa é o próprio `in: []`, não um `OR: []`: o Prisma reduz
  // `{ OR: [] }` isolado a `1=0`, mas **ignora** o mesmo `OR` vazio quando ele
  // está dentro de um `AND` — e todo filtro daqui sai dentro de um `AND`.
  if (filter.alwaysFalse) {
    return nestThroughRelations(plan, plan.model, filter.relationPath, {
      [leafColumn(filter.column)]: { in: [] },
    });
  }
  if (filter.alwaysTrue) return undefined;

  if (filter.target === 'relation') {
    return compileRelationPresence(plan, filter);
  }

  return nestThroughRelations(plan, plan.model, filter.relationPath, {
    [leafColumn(filter.column)]: scalarCondition(filter),
  });
}

function nestSearchTarget(
  plan: TypedQueryPlan,
  target: PlanSearchTarget,
  foldedTerm: string
): PrismaWhere {
  return nestThroughRelations(plan, plan.model, target.relationPath, {
    [leafColumn(target.column)]: { contains: foldedTerm },
  });
}

export function scalarCondition(filter: PlanFilter): unknown {
  const value = toPrismaValue(filter.value);

  switch (filter.operator) {
    case 'eq':
      return { equals: value };
    case 'ne':
      return { not: value };
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return { [filter.operator]: value };
    case 'between': {
      const [gte, lte] = filter.value as readonly unknown[];
      return { gte: toPrismaValue(gte), lte: toPrismaValue(lte) };
    }
    case 'in':
      return { in: toPrismaValueArray(filter.value) };
    case 'notIn':
      return { notIn: toPrismaValueArray(filter.value) };
    case 'isNull':
      return filter.value === true ? null : { not: null };
    // `contains` do Prisma é literal: não interpreta `%` nem `_`, que é
    // exatamente a semântica de `literalPattern` da v3.
    case 'like':
    case 'ilike':
      return { contains: value };
    case 'notLike':
    case 'notIlike':
      return { not: { contains: value } };
    default:
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Prisma adapter cannot compile operator ${filter.operator}`,
        { path: filter.path, operator: filter.operator }
      );
  }
}

/** `filter[relation][isNull]`: presença/ausência, sem tocar em colunas. */
function compileRelationPresence(
  plan: TypedQueryPlan,
  filter: PlanFilter
): PrismaWhere {
  // `relationPath` para *antes* da relação alvo, então quem carrega a
  // cadeia completa é o path: usar `relationPath` aqui trataria
  // `company.owner` como a relação `company` do root.
  const segments = filter.path.split('.');
  const parents = segments.slice(0, -1);
  const relationName = segments[segments.length - 1];
  const model = relationParentModel(plan, parents);
  const relation = plan.registry.get(model)?.relations.get(relationName);

  if (!relation) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `No Prisma relation ${relationName} on ${model}`,
      { model, relation: relationName }
    );
  }

  const presence =
    relation.cardinality === 'many'
      ? filter.value === true
        ? { none: {} }
        : { some: {} }
      : filter.value === true
        ? { is: null }
        : { isNot: null };

  return nestThroughRelations(plan, plan.model, parents, {
    [relationName]: presence,
  });
}
