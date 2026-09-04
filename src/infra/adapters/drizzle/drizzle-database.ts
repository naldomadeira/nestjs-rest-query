import type { SQL } from 'drizzle-orm/sql/sql';
import { configurationError } from '@core/errors';
import { toCountSql, toDataSql, toManySql } from './drizzle-sql.compiler';
import type {
  DrizzleDatabase,
  DrizzleManyProjection,
  DrizzleStatement,
} from './drizzle-statement.interface';

/**
 * Superfície mínima de um client Drizzle.
 *
 * `db.all()` existe nos drivers síncronos (better-sqlite3) e nos assíncronos
 * (postgres-js, mysql2, node-mssql); aceitar as duas formas evita um executor
 * por driver.
 */
export interface DrizzleClientLike {
  all(query: SQL): readonly unknown[] | Promise<readonly unknown[]>;
}

export interface DrizzleDatabaseOptions {
  readonly client: DrizzleClientLike;
}

type Row = Record<string, unknown>;

/**
 * Executor real do statement compilado (spec §15.3).
 *
 * Emite o SQL pelo template do Drizzle — identificadores citados pelo dialeto
 * do driver, valores sempre em bind — e hidrata a resposta plana na forma
 * aninhada que o normalizador do núcleo espera.
 */
export function drizzleDatabase(
  options: DrizzleDatabaseOptions
): DrizzleDatabase {
  const { client } = options;

  return {
    async executeData(statement: DrizzleStatement): Promise<readonly object[]> {
      const raw = (await client.all(toDataSql(statement))) as readonly Row[];
      const rows = raw.map((row) => hydrate(statement, row));

      for (const projection of statement.manyProjections) {
        await attachCollection(client, projection, rows);
      }

      return rows;
    },

    async executeCount(statement: DrizzleStatement): Promise<number> {
      const [row] = (await client.all(toCountSql(statement))) as readonly Row[];
      return Number(row?.total ?? 0);
    },
  };
}

/**
 * Linha plana -> objeto aninhado.
 *
 * As colunas voltam rotuladas por posição (`c0`, `c1`, ...), então a seleção
 * compilada é a única fonte de onde cada valor pertence. Uma relação `one` sem
 * correspondência no LEFT JOIN volta com todas as colunas nulas e vira `null`,
 * não um objeto de nulos.
 */
function hydrate(statement: DrizzleStatement, raw: Row): Row {
  const root: Row = {};
  const allNull = new Map<string, boolean>();

  statement.select.forEach((selection, index) => {
    const value = raw[`c${index}`];

    if (selection.path === '') {
      root[selection.column] = value;
      return;
    }

    const target = ensurePath(root, selection.path);
    target[selection.column] = value;
    allNull.set(
      selection.path,
      (allNull.get(selection.path) ?? true) && value === null
    );
  });

  // Do mais profundo para o mais raso: colapsar o pai depois do filho faz a
  // subárvore inteira desaparecer junto, em vez de deixar um órfão.
  const paths = [...allNull.keys()].sort(
    (left, right) => right.split('.').length - left.split('.').length
  );

  for (const path of paths) {
    if (!allNull.get(path)) continue;
    const segments = path.split('.');
    const parent =
      segments.length === 1
        ? root
        : (ensurePath(root, segments.slice(0, -1).join('.')) as Row);
    parent[segments[segments.length - 1]] = null;
  }

  return root;
}

function ensurePath(root: Row, path: string): Row {
  let node = root;
  for (const segment of path.split('.')) {
    const next = node[segment];
    if (next === null || next === undefined) {
      const created: Row = {};
      node[segment] = created;
      node = created;
      continue;
    }
    node = next as Row;
  }
  return node;
}

/**
 * Segunda fase: a coleção dos roots já escolhidos (spec §14).
 *
 * Buscar a coleção em separado é o que mantém `LIMIT` sobre roots e o `total`
 * contando roots, e não linhas de junção.
 */
async function attachCollection(
  client: DrizzleClientLike,
  projection: DrizzleManyProjection,
  rows: readonly Row[]
): Promise<void> {
  for (const row of rows) row[projection.path] = [];
  if (rows.length === 0) return;

  const keys = [
    ...new Set(rows.map((row) => row[projection.sourceColumn])),
  ].filter((key) => key !== null && key !== undefined);

  if (keys.length === 0) return;

  const raw = (await client.all(toManySql(projection, keys))) as readonly Row[];

  const byKey = new Map<string, Row[]>();
  for (const child of raw) {
    const hydrated: Row = {};
    projection.columns.forEach((column, index) => {
      hydrated[column] = child[`c${index}`];
    });

    const key = String(hydrated[projection.targetColumn]);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(hydrated);
    else byKey.set(key, [hydrated]);
  }

  for (const row of rows) {
    row[projection.path] =
      byKey.get(String(row[projection.sourceColumn])) ?? [];
  }
}

/** Erro de contrato quando o client não expõe a superfície esperada. */
export function assertDrizzleClient(
  client: unknown
): asserts client is DrizzleClientLike {
  if (typeof (client as DrizzleClientLike)?.all !== 'function') {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      'Drizzle client does not expose all(); pass a drizzle() database instance',
      {}
    );
  }
}
