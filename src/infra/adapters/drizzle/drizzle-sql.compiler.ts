import { sql, type SQL } from 'drizzle-orm/sql/sql';
import { configurationError } from '@core/errors';
import type {
  DrizzleColumnRef,
  DrizzleCondition,
  DrizzleJoin,
  DrizzleManyProjection,
  DrizzleStatement,
} from './drizzle-statement.interface';

/**
 * `DrizzleStatement` -> `SQL` do Drizzle (spec §15.3).
 *
 * Todo identificador passa por `sql.identifier` e todo valor vira bind, então
 * a citação é escolhida pelo dialeto do driver e nenhum valor entra no texto.
 * O que varia por dialeto é a paginação: SQL Server não tem `LIMIT`.
 */
export function toDataSql(statement: DrizzleStatement): SQL {
  const parts: SQL[] = [
    sql`select ${selectList(statement)} from ${table(statement.table, statement.alias)}`,
  ];

  const joined = joinList(statement.joins);
  if (joined) parts.push(joined);
  if (statement.where) parts.push(sql`where ${condition(statement.where)}`);

  const order = orderList(statement);
  if (order) parts.push(order);

  const page = pagination(statement);
  if (page) parts.push(page);

  return sql.join(parts, sql` `);
}

export function toCountSql(statement: DrizzleStatement): SQL {
  const parts: SQL[] = [
    sql`select count(*) as ${sql.identifier('total')} from ${table(statement.table, statement.alias)}`,
  ];

  const joined = joinList(statement.joins);
  if (joined) parts.push(joined);
  if (statement.where) parts.push(sql`where ${condition(statement.where)}`);

  return sql.join(parts, sql` `);
}

/**
 * Consulta da coleção, restrita aos roots já escolhidos.
 *
 * É a segunda fase da §14 neste adapter: os roots vêm do statement paginado e
 * a coleção é buscada em separado, de modo que `LIMIT` nunca corte um root ao
 * meio nem infle o `total`.
 */
export function toManySql(
  projection: DrizzleManyProjection,
  keys: readonly unknown[]
): SQL {
  if (keys.length === 0) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `Drizzle cannot hydrate ${projection.path} without root keys`,
      { path: projection.path }
    );
  }

  const columns = sql.join(
    projection.columns.map(
      (projected, index) =>
        sql`${sql.identifier(projection.table)}.${sql.identifier(projected.column)} as ${label(index)}`
    ),
    sql`, `
  );

  const order = sql.join(
    projection.orderBy.map(
      (column) =>
        sql`${sql.identifier(projection.table)}.${sql.identifier(column)} asc`
    ),
    sql`, `
  );

  return sql`select ${columns} from ${sql.identifier(projection.table)} where ${sql.identifier(projection.table)}.${sql.identifier(projection.targetColumn)} in ${keys} order by ${order}`;
}

/**
 * Rótulo posicional da coluna projetada.
 *
 * Rótulos derivados do path colidiriam com um campo do root chamado
 * `company__name`; a posição não colide com nada e a hidratação já percorre a
 * lista de seleções na mesma ordem.
 */
function label(index: number) {
  return sql.identifier(`c${index}`);
}

function table(name: string, alias: string): SQL {
  return sql`${sql.identifier(name)} as ${sql.identifier(alias)}`;
}

function column(ref: DrizzleColumnRef): SQL {
  return sql`${sql.identifier(ref.alias)}.${sql.identifier(ref.column)}`;
}

function selectList(statement: DrizzleStatement): SQL {
  return sql.join(
    statement.select.map(
      (selection, index) => sql`${column(selection)} as ${label(index)}`
    ),
    sql`, `
  );
}

function joinList(joins: readonly DrizzleJoin[]): SQL | undefined {
  if (joins.length === 0) return undefined;
  return sql.join(joins.map(joinClause), sql` `);
}

function joinClause(join: DrizzleJoin): SQL {
  const keyword = join.kind === 'inner' ? sql`inner join` : sql`left join`;
  return sql`${keyword} ${table(join.table, join.alias)} on ${column({ alias: join.parentAlias, column: join.sourceColumn })} = ${column({ alias: join.alias, column: join.targetColumn })}`;
}

function orderList(statement: DrizzleStatement): SQL | undefined {
  if (statement.orderBy.length === 0) return undefined;

  return sql`order by ${sql.join(
    statement.orderBy.map((entry) =>
      entry.direction === 'desc'
        ? sql`${column(entry)} desc`
        : sql`${column(entry)} asc`
    ),
    sql`, `
  )}`;
}

/**
 * Paginação por dialeto.
 *
 * SQL Server só pagina com `OFFSET ... FETCH`, e essa forma exige `ORDER BY`.
 * O plano sempre traz o tie-break, então a ordem existe — mas a ausência é
 * erro de contrato, não algo a contornar em silêncio.
 */
function pagination(statement: DrizzleStatement): SQL | undefined {
  if (statement.limit === undefined) return undefined;
  const offset = statement.offset ?? 0;

  if (statement.dialect !== 'mssql') {
    return sql`limit ${statement.limit} offset ${offset}`;
  }

  if (statement.orderBy.length === 0) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      'SQL Server cannot paginate without an order by clause',
      { dialect: statement.dialect }
    );
  }

  return sql`offset ${offset} rows fetch next ${statement.limit} rows only`;
}

function condition(node: DrizzleCondition): SQL {
  switch (node.op) {
    case 'and':
    case 'or': {
      if (node.terms.length === 0) return sql`1 = 1`;
      const separator = node.op === 'and' ? sql` and ` : sql` or `;
      return sql`(${sql.join(node.terms.map(condition), separator)})`;
    }
    case 'compare':
      return sql`${column(node.ref)} ${sql.raw(node.comparator)} ${node.value}`;
    case 'in':
      return sql`${column(node.ref)} in ${node.values}`;
    case 'notIn':
      return sql`${column(node.ref)} not in ${node.values}`;
    case 'between':
      return sql`${column(node.ref)} between ${node.from} and ${node.to}`;
    case 'null':
      return node.negated
        ? sql`${column(node.ref)} is not null`
        : sql`${column(node.ref)} is null`;
    case 'like': {
      const like = sql`${column(node.ref)} like ${node.value} escape ${node.escape}`;
      return node.negated ? sql`not (${like})` : like;
    }
    case 'exists': {
      const existing = existsClause(node.joins, node.where);
      return node.negated ? sql`not ${existing}` : existing;
    }
    case 'alwaysFalse':
      return sql`1 = 0`;
    case 'alwaysTrue':
      return sql`1 = 1`;
  }
}

/**
 * Subconsulta correlacionada.
 *
 * A correlação usa o alias do *pai* do primeiro salto, que pode ser o root ou
 * uma junção `one` já registrada — é o que faz `company.employees.name`
 * correlacionar com a `company` da linha, e não com o root de novo.
 */
function existsClause(
  joins: readonly DrizzleJoin[],
  where: DrizzleCondition | undefined
): SQL {
  const [head, ...tail] = joins;
  const parts: SQL[] = [
    sql`exists (select 1 from ${table(head.table, head.alias)}`,
  ];

  if (tail.length > 0) parts.push(joinList(tail)!);

  const correlation = sql`${column({ alias: head.parentAlias, column: head.sourceColumn })} = ${column({ alias: head.alias, column: head.targetColumn })}`;

  parts.push(
    where
      ? sql`where ${correlation} and ${condition(where)})`
      : sql`where ${correlation})`
  );

  return sql.join(parts, sql` `);
}
