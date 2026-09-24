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
  const { plan, count } = compiled;

  if (!plan.pagination.paginate) {
    // Sem paginação ainda há teto (`PlanPagination.maxRows`): a janela é a
    // primeira, com uma linha a mais para o serviço distinguir "no teto" de
    // "passou do teto". Sem ela, `paginate=false` devolvia a tabela inteira.
    const window = await selectWindow(compiled, plan.pagination.maxRows + 1, 0);
    return { rows: window.rows, queryCount: window.queries };
  }

  const total = await count.getCount();
  const { offset, perPage } = plan.pagination;
  const window = await selectWindow(compiled, perPage, offset);
  return { rows: window.rows, total, queryCount: window.queries + 1 };
}

/**
 * Uma janela de roots, com `limit` e `offset` aplicados **aos roots**.
 *
 * Com relação `many` na projeção, `LIMIT` direto cortaria linhas de join no
 * meio de um root, então a janela vira duas fases: a primeira escolhe os
 * roots, a segunda os hidrata. É o mesmo caminho para a página e para o teto
 * do `paginate=false`.
 */
async function selectWindow<T extends ObjectLiteral>(
  compiled: CompiledTypeOrmQuery<T>,
  limit: number,
  offset: number
): Promise<{ rows: T[]; queries: number }> {
  const { plan, data, joins, repository } = compiled;

  if (!joins.hasManyPresentation) {
    const rows = await data.limit(limit).offset(offset).getMany();
    return { rows, queries: 1 };
  }

  const primaryKey = plan.schema.primaryKey;
  const context: FilterCompilerContext = {
    plan,
    joins: predicateOnly(joins),
    escapeCharacter: compiled.escapeCharacter,
  };

  // Fase 1: os roots da janela, sem nenhum join de apresentação.
  const keysQuery = repository.createQueryBuilder(ROOT_ALIAS);
  compileJoins(keysQuery, context.joins);
  // Alias explícito por parte da chave: sem ele o `getRawMany` nomeia a coluna
  // `alias_<databaseName>`, e ler por `alias_<propertyName>` dava `undefined`
  // sempre que a PK tem nome físico próprio (`@PrimaryColumn({ name })`,
  // naming strategy) — página vazia com `total` certo.
  primaryKey.forEach((column, part) => {
    const expression = `${ROOT_ALIAS}.${column}`;
    const alias = keyAlias(part);
    if (part === 0) keysQuery.select(expression, alias);
    else keysQuery.addSelect(expression, alias);
  });
  compileFilters(keysQuery, context);
  compileSort(keysQuery, plan, context);
  for (const customize of compiled.keyCustomizers) customize(keysQuery);
  keysQuery.limit(limit).offset(offset);
  const keyRows = await keysQuery.getRawMany<Record<string, unknown>>();
  const keys = keyRows.map((row) =>
    primaryKey.map((_column, part) => row[keyAlias(part)])
  );

  if (keys.length === 0) return { rows: [], queries: 2 };

  // Fase 2: hidratação completa restrita aos roots escolhidos.
  const hydration = data.clone();
  restrictToKeys(hydration, primaryKey, keys);

  const rows = await hydration.getMany();
  return { rows: reorderByKeys(rows, primaryKey, keys), queries: 2 };
}

/** Nome da coluna crua que carrega a parte `part` da chave na fase 1. */
const keyAlias = (part: number): string => `dqb_key_${part}`;

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

/**
 * Rede de segurança para a ordem decidida na primeira fase (spec §14) — e é
 * rede, não o mecanismo.
 *
 * Quem impõe a ordem de verdade é o `ORDER BY` que o clone de hidratação
 * herda do plano. Esta função só reordena quando consegue casar chave crua com
 * chave hidratada, e as duas vêm de representações **diferentes**: a fase 1 lê
 * por `getRawMany`, então recebe o valor do driver (`'2020-01-01 00:00:00.000'`
 * para um datetime), enquanto a fase 2 lê por `getMany` e recebe a entidade
 * hidratada (um `Date`, cujo `String()` é
 * `'Tue Dec 31 2019 21:00:00 GMT-0300'`). Para PK inteira, uuid ou texto as
 * duas formas coincidem e a rede funciona; para PK `datetime` ou binária,
 * nenhuma linha é encontrada no mapa, todas empatam em
 * `MAX_SAFE_INTEGER` e o `sort` estável devolve a ordem que já veio do banco.
 *
 * Alinhar as duas representações exigiria reintroduzir conhecimento de fuso e
 * de codec por dialeto **aqui** — precisamente o que o perfil certificado
 * existe para concentrar num lugar só. Então a escolha é deliberada: a rede
 * cobre o caso comum, o `ORDER BY` cobre todos, e
 * `composite-pagination.spec.ts` trava a ordem observável inclusive para PK
 * datetime. Se algum dia a rede passar a ser load-bearing — por exemplo se um
 * `customize` puder remover o `ORDER BY` da hidratação — este comentário deixa
 * de valer e o alinhamento vira obrigatório.
 */
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
