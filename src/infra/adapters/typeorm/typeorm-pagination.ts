import { Brackets, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import type { AdapterResult } from '@contracts/v3';
import {
  compileFilters,
  type FilterCompilerContext,
} from './typeorm-filter.compiler';
import { compileJoins } from './typeorm-projection.compiler';
import { compileSort } from './typeorm-sort.compiler';
import { ROOT_ALIAS } from './typeorm-join-planner';
import { predicateOnly, type CompiledTypeOrmQuery } from './compile-plan';

/**
 * Execução paginada (spec §14).
 *
 * Quando a projeção inclui uma relação `many`, um único SELECT com LIMIT
 * truncaria linhas de join no meio de um root. A execução vira duas fases: a
 * primeira escolhe os roots da página, a segunda os hidrata por completo — e a
 * ordem da primeira é reimposta em memória, para não depender do plano do
 * banco na segunda.
 */
export async function executeCompiled<T extends ObjectLiteral>(
  compiled: CompiledTypeOrmQuery<T>
): Promise<AdapterResult<T>> {
  const { plan, data, count, joins, repository } = compiled;

  if (!plan.pagination.paginate) {
    return { rows: await data.getMany(), queryCount: 1 };
  }

  const total = await count.getCount();
  const { offset, perPage } = plan.pagination;

  if (!joins.hasManyPresentation) {
    const rows = await data.limit(perPage).offset(offset).getMany();
    return { rows, total, queryCount: 2 };
  }

  const primaryKey = plan.schema.primaryKey;
  const context: FilterCompilerContext = {
    plan,
    joins: predicateOnly(joins),
    escapeCharacter: compiled.escapeCharacter,
  };

  // Fase 1: os roots da página, sem nenhum join de apresentação.
  const keysQuery = repository.createQueryBuilder(ROOT_ALIAS);
  compileJoins(keysQuery, context.joins);
  keysQuery.select(primaryKey.map((column) => `${ROOT_ALIAS}.${column}`));
  compileFilters(keysQuery, context);
  compileSort(keysQuery, plan, context);
  for (const customize of compiled.keyCustomizers) customize(keysQuery);
  keysQuery.limit(perPage).offset(offset);
  const keyRows = await keysQuery.getRawMany<Record<string, unknown>>();
  const keys = keyRows.map((row) =>
    primaryKey.map((column) => row[`${ROOT_ALIAS}_${column}`])
  );

  if (keys.length === 0) return { rows: [], total, queryCount: 3 };

  // Fase 2: hidratação completa restrita aos roots escolhidos.
  const hydration = data.clone();
  restrictToKeys(hydration, primaryKey, keys);

  const rows = await hydration.getMany();
  return {
    rows: reorderByKeys(rows, primaryKey, keys),
    total,
    queryCount: 3,
  };
}

/**
 * Restringe aos roots da primeira fase.
 *
 * Usa OR de igualdades em vez de `(a, b) IN ((...))`: a forma de tupla não é
 * portável para SQL Server, e a matriz exige as três famílias.
 */
function restrictToKeys<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  primaryKey: readonly string[],
  keys: readonly unknown[][]
): void {
  query.andWhere(
    new Brackets((where) => {
      keys.forEach((key, index) => {
        const parameters: Record<string, unknown> = {};
        const condition = primaryKey
          .map((column, part) => {
            const name = `dqb_key_${index}_${part}`;
            parameters[name] = key[part];
            return `${ROOT_ALIAS}.${column} = :${name}`;
          })
          .join(' AND ');

        where.orWhere(`(${condition})`, parameters);
      });
    })
  );
}

/** Reimpoe a ordem decidida na primeira fase (spec §14). */
function reorderByKeys<T extends ObjectLiteral>(
  rows: readonly T[],
  primaryKey: readonly string[],
  keys: readonly unknown[][]
): T[] {
  const position = new Map<string, number>();
  keys.forEach((key, index) => position.set(key.map(String).join(' '), index));

  return [...rows].sort((left, right) => {
    const leftKey = primaryKey.map((column) => String(left[column])).join(' ');
    const rightKey = primaryKey
      .map((column) => String(right[column]))
      .join(' ');
    return (
      (position.get(leftKey) ?? Number.MAX_SAFE_INTEGER) -
      (position.get(rightKey) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}
