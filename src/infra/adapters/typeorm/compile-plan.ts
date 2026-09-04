import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import type { TypedQueryPlan } from '@core/query-plan';
import {
  compileFilters,
  type FilterCompilerContext,
} from './typeorm-filter.compiler';
import { compileJoins, compileProjection } from './typeorm-projection.compiler';
import { compileSort } from './typeorm-sort.compiler';
import { planJoins, ROOT_ALIAS, type JoinPlan } from './typeorm-join-planner';

export interface CompiledTypeOrmQuery<T extends ObjectLiteral> {
  readonly plan: TypedQueryPlan;
  readonly repository: Repository<T>;
  readonly joins: JoinPlan;
  readonly escapeCharacter: string;
  /** Query de dados. `customize` com escopo `data` ou `both` age aqui. */
  readonly data: SelectQueryBuilder<T>;
  /** Query de contagem, derivada do mesmo plano. */
  readonly count: SelectQueryBuilder<T>;
  /** Callbacks de data que também precisam restringir a fase de keys. */
  readonly keyCustomizers: Array<(query: SelectQueryBuilder<T>) => void>;
}

/**
 * Compila o plano nas duas queries que a execução precisa.
 *
 * Data e count nascem do mesmo plano congelado e compartilham joins de
 * predicado e condições; só divergem na projeção, no ORDER BY e na paginação —
 * o count nunca carrega joins de apresentação, para não contar linhas de join.
 */
export function compilePlan<T extends ObjectLiteral>(
  plan: TypedQueryPlan,
  repository: Repository<T>,
  escapeCharacter: string
): CompiledTypeOrmQuery<T> {
  const joins = planJoins(plan);
  const context: FilterCompilerContext = { plan, joins, escapeCharacter };

  const data = repository.createQueryBuilder(ROOT_ALIAS);
  compileJoins(data, joins);
  compileProjection(data, plan, joins);
  compileFilters(data, context);
  compileSort(data, plan, context);

  const count = repository.createQueryBuilder(ROOT_ALIAS);
  compileJoins(count, predicateOnly(joins));
  compileFilters(count, { ...context, joins: predicateOnly(joins) });

  return {
    plan,
    repository,
    joins,
    escapeCharacter,
    data,
    count,
    keyCustomizers: [],
  };
}

/**
 * Subconjunto de joins necessário só aos predicados. O count não pode juntar
 * relações de apresentação: elas multiplicariam os roots (spec §14).
 *
 * Como caminhos por relação `many` viram EXISTS, todo join de predicado é
 * `one` — por isso o count nunca infla e a primeira fase da paginação pode
 * usar LIMIT/OFFSET direto.
 */
export function predicateOnly(joins: JoinPlan): JoinPlan {
  const nodes = new Map(
    [...joins.nodes.entries()].filter(([, node]) => node.predicate)
  );
  return {
    rootAlias: joins.rootAlias,
    nodes,
    hasManyPresentation: false,
  };
}
