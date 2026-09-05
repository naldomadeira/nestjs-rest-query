import { DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import { checkPortabilityProfile } from '@core/portability';
import type { ProfileDialect, ProfileFacts } from '@core/portability';
import {
  buildCorpusEntities,
  type CorpusEntities,
} from '../fixtures/entity-schemas';

export type IntegrationDialect = ProfileDialect;

export interface IntegrationContext {
  readonly dialect: IntegrationDialect;
  readonly dataSource: DataSource;
  readonly entities: CorpusEntities;
  repositoryFor(preset: string): Repository<ObjectLiteral>;
}

/** Variável de ambiente que carrega a URL de cada célula da matriz. */
const URL_ENV: Record<IntegrationDialect, string> = {
  postgres: 'DQB_PG_URL',
  mysql: 'DQB_MYSQL_URL',
  mssql: 'DQB_MSSQL_URL',
};

export function selectedDialect(): IntegrationDialect | null {
  const dialect = process.env.DQB_DIALECT as IntegrationDialect | undefined;
  if (!dialect) return null;
  if (!URL_ENV[dialect]) {
    throw new Error(`Unknown DQB_DIALECT: ${dialect}`);
  }
  return process.env[URL_ENV[dialect]] ? dialect : null;
}

export async function openDialect(
  dialect: IntegrationDialect
): Promise<IntegrationContext> {
  const entities = buildCorpusEntities(dialect);
  const url = process.env[URL_ENV[dialect]]!;

  const dataSource = new DataSource({
    type: dialect === 'mssql' ? 'mssql' : dialect,
    url,
    entities: entities.all,
    // O schema vem da DDL do perfil certificado, não do synchronize: é a
    // collation e a precisão declaradas lá que sustentam a paridade.
    synchronize: false,
    logging: false,
    ...(dialect === 'mssql'
      ? { options: { encrypt: false, trustServerCertificate: true } }
      : {}),
    ...(dialect === 'mysql' ? { timezone: 'Z' } : {}),
  } as never);

  await dataSource.initialize();

  return {
    dialect,
    dataSource,
    entities,
    repositoryFor: (preset) =>
      dataSource.getRepository(
        entities[preset.split('.')[0] as keyof CorpusEntities] as never
      ),
  };
}

/**
 * Confere o perfil certificado antes de rodar qualquer caso (spec §6.3).
 *
 * Rodar o corpus sobre uma collation ou timezone diferente produziria
 * divergências que não são da biblioteca. Melhor falhar aqui, dizendo o quê
 * está fora do perfil.
 */
export async function assertProfile(
  context: IntegrationContext
): Promise<void> {
  const facts = await collectFacts(context);
  const violations = checkPortabilityProfile(facts);

  if (violations.length > 0) {
    throw new Error(
      `PORTABILITY_PROFILE_MISMATCH (${context.dialect}):\n` +
        violations.map((v) => `  - [${v.rule}] ${v.detail}`).join('\n')
    );
  }
}

const REQUIRED_INDEXES = [
  'users_company_id_idx',
  'users_name_folded_idx',
  'users_email_folded_idx',
  'users_code_idx',
  'posts_user_id_idx',
  'posts_id_order_idx',
  'companies_name_folded_idx',
  'tags_post_id_order_idx',
];

/** Colunas textuais cuja collation sustenta `eq`, `like` e o valor dobrado. */
const CERTIFIED_TEXT_COLUMNS = [
  ['users', 'name'],
  ['users', 'name_folded'],
  ['users', 'email_folded'],
  ['users', 'code'],
  ['companies', 'name'],
] as const;

async function collectFacts(
  context: IntegrationContext
): Promise<ProfileFacts> {
  const { dataSource, dialect } = context;
  const query = <R>(sql: string): Promise<R[]> => dataSource.query(sql);

  if (dialect === 'postgres') {
    const [{ encoding, timezone, version }] = await query<{
      encoding: string;
      timezone: string;
      version: string;
    }>(
      `SELECT pg_encoding_to_char(encoding) AS encoding,
              current_setting('TimeZone') AS timezone,
              current_setting('server_version') AS version
       FROM pg_database WHERE datname = current_database()`
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
      dialect,
      serverVersion: version,
      encoding,
      sessionTimeZone: timezone,
      strictMode: true, // Postgres não converte implicitamente nos tipos usados
      textColumns: CERTIFIED_TEXT_COLUMNS.map(([table, column]) => ({
        table,
        column,
        collation:
          collations.find(
            (c) => c.table_name === table && c.column_name === column
          )?.collation_name ?? 'C',
      })),
      indexes: indexes.map((i) => i.indexname),
      requiredIndexes: REQUIRED_INDEXES,
    };
  }

  if (dialect === 'mysql') {
    const [{ charset, timezone, version, sqlMode }] = await query<{
      charset: string;
      timezone: string;
      version: string;
      sqlMode: string;
    }>(
      `SELECT @@character_set_database AS charset,
              @@session.time_zone AS timezone,
              @@version AS version,
              @@session.sql_mode AS sqlMode`
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
      dialect,
      serverVersion: version,
      encoding: charset,
      sessionTimeZone: timezone === '+00:00' ? 'UTC' : timezone,
      strictMode: /STRICT_(ALL|TRANS)_TABLES/.test(sqlMode),
      textColumns: CERTIFIED_TEXT_COLUMNS.map(([table, column]) => ({
        table,
        column,
        collation:
          collations.find(
            (c) => c.TABLE_NAME === table && c.COLUMN_NAME === column
          )?.COLLATION_NAME ?? 'unknown',
      })),
      indexes: indexes.map((i) => i.INDEX_NAME),
      requiredIndexes: REQUIRED_INDEXES,
    };
  }

  const [{ collation, version }] = await query<{
    collation: string;
    version: string;
  }>(
    `SELECT CONVERT(varchar(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation')) AS collation,
            CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')) AS version`
  );

  const collations = await query<{
    table_name: string;
    column_name: string;
    collation_name: string | null;
  }>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
            COLLATION_NAME AS collation_name
     FROM INFORMATION_SCHEMA.COLUMNS`
  );

  const indexes = await query<{ name: string }>(
    `SELECT name FROM sys.indexes WHERE name IS NOT NULL`
  );

  return {
    dialect: 'mssql',
    serverVersion: version,
    encoding: 'UTF8', // garantido pela collation _UTF8 do perfil
    sessionTimeZone: 'UTC',
    strictMode: true,
    textColumns: CERTIFIED_TEXT_COLUMNS.map(([table, column]) => ({
      table,
      column,
      collation:
        collations.find(
          (c) => c.table_name === table && c.column_name === column
        )?.collation_name ?? collation,
    })),
    indexes: indexes.map((i) => i.name),
    requiredIndexes: REQUIRED_INDEXES,
  };
}
