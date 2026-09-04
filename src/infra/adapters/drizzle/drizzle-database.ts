import type { SQL } from 'drizzle-orm/sql/sql';
import type { SqlDialect } from '@contracts/v3';
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
 * Os dois métodos são opcionais porque **nenhum é comum a todos os dialetos**:
 * no `drizzle-orm` 1.x, `all()` existe só na família SQLite — o único
 * `db.d.ts` do pacote que o declara é o de `sqlite-core`. Postgres, MySQL e
 * SQL Server expõem apenas `execute()`, e cada um devolve uma forma diferente.
 * Qual método chamar e como ler o resultado sai do dialeto declarado pelo
 * chamador, nunca de inspeção do objeto: adivinhar seria a aproximação
 * silenciosa que a §5.6 proíbe, e falharia tarde e diferente em cada driver.
 */
export interface DrizzleClientLike {
  all?(query: SQL): unknown;
  execute?(query: SQL): unknown;
}

export interface DrizzleDatabaseOptions {
  readonly client: DrizzleClientLike;
  /**
   * Dialeto do client. Precisa coincidir com o da `drizzleSource`; é ele que
   * escolhe o método de execução e a leitura das linhas.
   */
  readonly dialect: SqlDialect;
}

type Row = Record<string, unknown>;

interface RowReader {
  readonly method: 'all' | 'execute';
  rows(result: unknown, dialect: SqlDialect): readonly Row[];
}

/** Erro de contrato quando o driver devolve algo que não são linhas. */
function asRows(value: unknown, dialect: SqlDialect): readonly Row[] {
  if (!Array.isArray(value)) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `Drizzle client for ${dialect} did not return a row array`,
      { dialect }
    );
  }
  return value as readonly Row[];
}

/**
 * Método e forma do retorno por dialeto, medidos no `drizzle-orm` 1.0.0-rc.4.
 *
 * O caso do Postgres é o único com duas formas, e elas são um conjunto fechado
 * de dois drivers oficiais: `postgres-js` devolve um `RowList`, que **é** um
 * array de linhas, e `node-postgres`/`pglite` devolvem `{ rows }`. Distinguir
 * por `Array.isArray` aqui não é adivinhar a forma — é escolher entre duas
 * documentadas, dentro de um dialeto já declarado.
 */
const ROW_READERS: Readonly<Record<SqlDialect, RowReader>> = {
  sqlite: {
    method: 'all',
    rows: (result, dialect) => asRows(result, dialect),
  },
  postgres: {
    method: 'execute',
    rows: (result, dialect) =>
      Array.isArray(result)
        ? (result as readonly Row[])
        : asRows((result as { rows?: unknown } | null)?.rows, dialect),
  },
  mysql: {
    method: 'execute',
    // `[rows, fields]`: as linhas do SELECT ficam no índice 0.
    rows: (result, dialect) =>
      asRows(asRows(result, dialect)[0] as unknown, dialect),
  },
  mssql: {
    method: 'execute',
    rows: (result, dialect) =>
      asRows((result as { recordset?: unknown } | null)?.recordset, dialect),
  },
};

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
  const { client, dialect } = options;

  // Um ponto só de validação: `assertDrizzleClient` recusa dialeto sem leitor
  // e client sem o método daquele dialeto. Depois dela, `ROW_READERS[dialect]`
  // é garantido — checar de novo aqui seria branch morta pedindo teste que não
  // prova nada.
  assertDrizzleClient(client, dialect);
  const reader = ROW_READERS[dialect];
  const call = client[reader.method] as (query: SQL) => unknown;

  const run = async (query: SQL): Promise<readonly Row[]> =>
    reader.rows(await call.call(client, query), dialect);

  return {
    dialect,

    async executeData(statement: DrizzleStatement): Promise<readonly object[]> {
      const raw = await run(toDataSql(statement));
      const rows = raw.map((row) => hydrate(statement, row));

      for (const projection of statement.manyProjections) {
        await attachCollection(run, projection, rows);
      }

      return rows;
    },

    async executeCount(statement: DrizzleStatement): Promise<number> {
      const [row] = await run(toCountSql(statement));
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
  run: (query: SQL) => Promise<readonly Row[]>,
  projection: DrizzleManyProjection,
  rows: readonly Row[]
): Promise<void> {
  for (const row of rows) row[projection.path] = [];
  if (rows.length === 0) return;

  const keys = [
    ...new Set(rows.map((row) => row[projection.sourceColumn])),
  ].filter((key) => key !== null && key !== undefined);

  if (keys.length === 0) return;

  const raw = await run(toManySql(projection, keys));

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

/**
 * Erro de contrato quando o client não expõe o método que o dialeto exige.
 *
 * A mensagem nomeia o método esperado porque a confusão é previsível: um
 * `drizzle()` de Postgres é um objeto válido do Drizzle que simplesmente não
 * tem `all()`, e o erro genérico "client inválido" mandaria o usuário procurar
 * no lugar errado.
 */
export function assertDrizzleClient(
  client: unknown,
  dialect: SqlDialect
): asserts client is DrizzleClientLike {
  const reader = ROW_READERS[dialect];
  if (!reader) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Drizzle adapter does not support dialect ${dialect}`,
      { dialect }
    );
  }

  if (typeof (client as DrizzleClientLike)?.[reader.method] !== 'function') {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Drizzle client for ${dialect} does not expose ${reader.method}(); pass a drizzle() database instance for this dialect`,
      { dialect, expectedMethod: reader.method }
    );
  }
}
