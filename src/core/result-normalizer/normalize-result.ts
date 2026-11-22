import type { TypedQueryPlan } from '../query-plan';
import { buildProjectionTree, projectRow } from './projection-tree';

export interface NormalizedQueryResult<T = Record<string, unknown>> {
  data: T[];
  page?: number;
  perPage?: number;
  total?: number;
  lastPage?: number;
}

/**
 * Produz o JSON canônico (spec §13 e §10.1).
 *
 * A normalização é do núcleo, não de cada adapter: é o único ponto onde o
 * `bigint` do Postgres, o `number` do MySQL e o `string` do SQL Server viram a
 * mesma saída. Colunas internas selecionadas para predicado ou hidratação são
 * descartadas aqui, junto com PKs que o cliente não pediu.
 */
export function normalizeRows(
  rows: readonly unknown[],
  plan: TypedQueryPlan
): Record<string, unknown>[] {
  const tree = buildProjectionTree(plan);
  return rows.map((row) => projectRow(tree, row as Record<string, unknown>));
}

/**
 * Envelope canônico a partir de linhas já buscadas (spec §10.1 e §13).
 *
 * É o último passo de `execute()`, e é público para quem usa só o plano: o
 * consumidor chama `QueryBuilderService.buildPlan(query, rules)`, traduz o
 * plano para outra fonte (uma API HTTP, um índice de busca), e entrega as
 * linhas aqui. Cada linha deve trazer os campos pelo **path lógico** do schema
 * (`name`, e relações aninhadas: `{ company: { name } }`); campos fora da
 * projeção são descartados e os escalares saem codificados como em
 * `execute()`. `total` é o total de roots que casam o filtro, sem paginação;
 * sem ele, vale o tamanho da página.
 *
 * @example
 * ```ts
 * const plan = this.queries.buildPlan(query, rules);
 * const { items, count } = await this.upstream.search(toUpstream(plan));
 * return normalizeResult<UserDto>(items, count, plan);
 * ```
 */
export function normalizeResult<T = Record<string, unknown>>(
  rows: readonly unknown[],
  total: number | undefined,
  plan: TypedQueryPlan
): NormalizedQueryResult<T> {
  const data = normalizeRows(rows, plan) as T[];

  if (!plan.pagination.paginate) return { data };

  const resolvedTotal = total ?? data.length;

  return {
    data,
    page: plan.pagination.page,
    perPage: plan.pagination.perPage,
    total: resolvedTotal,
    // `lastPage` nunca é 0: o contrato atual promete no mínimo 1 (spec §14).
    lastPage: Math.max(1, Math.ceil(resolvedTotal / plan.pagination.perPage)),
  };
}
