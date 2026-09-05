import { configurationError } from '@core/errors';
import {
  checkPortabilityProfile,
  type ProfileDialect,
  type ProfileFacts,
} from './profile-check';

/**
 * Coleta dos fatos do perfil certificado direto dos catálogos (spec §6.3).
 *
 * `checkPortabilityProfile` é pura e recebe `ProfileFacts` prontos — o que
 * significa que, sem este módulo, a checagem valida o que o chamador *disse*
 * sobre o banco. Fatos inventados passam. É o coletor que faz
 * `PORTABILITY_PROFILE_MISMATCH` deixar de ser decorativo.
 *
 * O que varia entre bancos é o SQL de catálogo, não o ORM. Então o coletor
 * mora no núcleo, parametrizado por um executor de SQL cru que o chamador
 * fornece — `dataSource.query` no TypeORM, `$queryRawUnsafe` no Prisma,
 * `execute` no Drizzle. Assim o núcleo continua sem importar driver nenhum, e
 * não existem três cópias do mesmo SQL para divergirem entre si.
 */
export type ProfileQueryRunner = <R>(sql: string) => Promise<readonly R[]>;

/** Tabela e coluna de um campo textual portável do perfil. */
export type ProfileColumnRef = readonly [table: string, column: string];

export interface CollectProfileFactsOptions {
  readonly dialect: ProfileDialect;
  readonly query: ProfileQueryRunner;
  /**
   * Colunas textuais cuja collation sustenta `eq`, `like` e o valor dobrado.
   * São as que o corpus exercita; uma collation errada aqui muda resultado.
   */
  readonly textColumns: readonly ProfileColumnRef[];
  readonly requiredIndexes: readonly string[];
}

export async function collectProfileFacts(
  options: CollectProfileFactsOptions
): Promise<ProfileFacts> {
  switch (options.dialect) {
    case 'postgres':
      return collectPostgres(options);
    case 'mysql':
      return collectMySql(options);
    case 'mssql':
      return collectMsSql(options);
    default: {
      const exhaustive: never = options.dialect;
      throw configurationError(
        'PORTABILITY_PROFILE_MISMATCH',
        `No profile collector for dialect ${String(exhaustive)}`,
        { dialect: exhaustive }
      );
    }
  }
}

/**
 * Coleta e checa, falhando com o código canônico (spec §6.3).
 *
 * É o que se chama na inicialização, antes de aceitar tráfego: uma violação
 * aqui vira `PORTABILITY_PROFILE_MISMATCH`, não um `Error` genérico, porque o
 * código do erro faz parte do contrato medido pelo corpus.
 */
export async function assertProfileFacts(
  options: CollectProfileFactsOptions
): Promise<ProfileFacts> {
  const facts = await collectProfileFacts(options);
  const violations = checkPortabilityProfile(facts);

  if (violations.length > 0) {
    throw configurationError(
      'PORTABILITY_PROFILE_MISMATCH',
      `Database does not match the certified ${options.dialect} profile`,
      { dialect: options.dialect, violations }
    );
  }

  return facts;
}

/**
 * Primeira linha de uma query de catálogo, ou o erro canônico.
 *
 * Um catálogo que não responde é um perfil que não pôde ser verificado, e a
 * diferença importa: sem isto, `server.version` estouraria um `TypeError` cru
 * e o chamador veria um erro de programação onde deveria ver
 * `PORTABILITY_PROFILE_MISMATCH`.
 */
function firstRow<R>(rows: readonly R[], dialect: ProfileDialect): R {
  const [row] = rows;
  if (row === undefined) {
    throw configurationError(
      'PORTABILITY_PROFILE_MISMATCH',
      `The ${dialect} catalog returned no server facts; the profile could not be verified`,
      { dialect }
    );
  }
  return row;
}

/** Collation observada, ou o fallback do dialeto quando a coluna não a declara. */
function collationOf(
  found: readonly { table: string; column: string; collation: string | null }[],
  columns: readonly ProfileColumnRef[],
  fallback: string
) {
  return columns.map(([table, column]) => ({
    table,
    column,
    collation:
      found.find((c) => c.table === table && c.column === column)?.collation ??
      fallback,
  }));
}

async function collectPostgres({
  query,
  textColumns,
  requiredIndexes,
}: CollectProfileFactsOptions): Promise<ProfileFacts> {
  const server = firstRow(
    await query<{
      encoding: string;
      timezone: string;
      version: string;
    }>(
      `SELECT pg_encoding_to_char(encoding) AS encoding,
              current_setting('TimeZone') AS timezone,
              current_setting('server_version') AS version
       FROM pg_database WHERE datname = current_database()`
    ),
    'postgres'
  );

  const collations = await query<{
    table_name: string;
    column_name: string;
    collation_name: string | null;
  }>(
    `SELECT table_name, column_name, collation_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()`
  );

  const indexes = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`
  );

  return {
    dialect: 'postgres',
    serverVersion: server.version,
    encoding: server.encoding,
    sessionTimeZone: server.timezone,
    // Postgres não converte implicitamente nos tipos que o corpus exercita.
    strictMode: true,
    textColumns: collationOf(
      collations.map((c) => ({
        table: c.table_name,
        column: c.column_name,
        collation: c.collation_name,
      })),
      textColumns,
      'C'
    ),
    indexes: indexes.map((i) => i.indexname),
    requiredIndexes,
  };
}

async function collectMySql({
  query,
  textColumns,
  requiredIndexes,
}: CollectProfileFactsOptions): Promise<ProfileFacts> {
  const server = firstRow(
    await query<{
      charset: string;
      timezone: string;
      systemTimezone: string;
      version: string;
      sqlMode: string;
    }>(
      `SELECT @@character_set_database AS charset,
              @@session.time_zone AS timezone,
              @@system_time_zone AS systemTimezone,
              @@version AS version,
              @@session.sql_mode AS sqlMode`
    ),
    'mysql'
  );

  const collations = await query<{
    TABLE_NAME: string;
    COLUMN_NAME: string;
    COLLATION_NAME: string | null;
  }>(
    `SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
  );

  const indexes = await query<{ INDEX_NAME: string }>(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()`
  );

  return {
    dialect: 'mysql',
    serverVersion: server.version,
    encoding: server.charset,
    sessionTimeZone: normalizeMySqlTimeZone(server),
    strictMode: /STRICT_(ALL|TRANS)_TABLES/.test(server.sqlMode),
    textColumns: collationOf(
      collations.map((c) => ({
        table: c.TABLE_NAME,
        column: c.COLUMN_NAME,
        collation: c.COLLATION_NAME,
      })),
      textColumns,
      'unknown'
    ),
    indexes: indexes.map((i) => i.INDEX_NAME),
    requiredIndexes,
  };
}

/**
 * Timezone efetivo da sessão MySQL.
 *
 * `@@session.time_zone` tem três formas: um offset (`+00:00`), um nome de zona,
 * ou o literal `SYSTEM` — que significa "o do sistema operacional" e não diz
 * qual é. Resolver o `SYSTEM` aqui é o que evita o gate reprovar o perfil
 * exibindo um valor opaco em vez do timezone real.
 */
function normalizeMySqlTimeZone(server: {
  timezone: string;
  systemTimezone: string;
}): string {
  const effective =
    server.timezone === 'SYSTEM' ? server.systemTimezone : server.timezone;
  return effective === '+00:00' ? 'UTC' : effective;
}

async function collectMsSql({
  query,
  textColumns,
  requiredIndexes,
}: CollectProfileFactsOptions): Promise<ProfileFacts> {
  const server = firstRow(
    await query<{ collation: string; version: string }>(
      `SELECT CONVERT(varchar(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation')) AS collation,
              CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')) AS version`
    ),
    'mssql'
  );

  const collations = await query<{
    table_name: string;
    column_name: string;
    collation_name: string | null;
  }>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
            COLLATION_NAME AS collation_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = SCHEMA_NAME()`
  );

  // Só índices de tabela de usuário: `sys.indexes` sem filtro traz os índices
  // das tabelas de sistema, e aí `facts.indexes` deixa de ser comparável com o
  // que Postgres e MySQL coletam no escopo do schema corrente.
  const indexes = await query<{ name: string }>(
    `SELECT i.name FROM sys.indexes AS i
     JOIN sys.tables AS t ON t.object_id = i.object_id
     WHERE i.name IS NOT NULL AND t.is_ms_shipped = 0`
  );

  return {
    dialect: 'mssql',
    // Garantido pela collation `_UTF8` do perfil certificado.
    encoding: 'UTF8',
    serverVersion: server.version,
    sessionTimeZone: 'UTC',
    strictMode: true,
    textColumns: collationOf(
      collations.map((c) => ({
        table: c.table_name,
        column: c.column_name,
        collation: c.collation_name,
      })),
      textColumns,
      server.collation
    ),
    indexes: indexes.map((i) => i.name),
    requiredIndexes,
  };
}
