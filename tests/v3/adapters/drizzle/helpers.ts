import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm/sql/sql';
import type { ScalarKind } from '@core/schema';
import {
  drizzleDatabase,
  drizzleSource,
  type DrizzleClientLike,
  type DrizzleTable,
} from '@infra/adapters/drizzle';
import { CORPUS_SEED } from '../../corpus/seed';
import { DRIZZLE_CORPUS } from '../../fixtures/drizzle-tables';

/**
 * SQLite como dialeto de referência do adapter Drizzle.
 *
 * Igual ao harness do TypeORM: SQLite **não** é célula da matriz de paridade,
 * serve para provar que o compilador implementa a semântica do plano. As nove
 * células reais continuam medindo a promessa (spec §18).
 */

/** Mesmos tipos físicos que as entidades TypeORM usam no dialeto SQLite. */
const PHYSICAL: Readonly<Record<ScalarKind, string>> = {
  string: 'varchar',
  uuid: 'varchar',
  enum: 'varchar',
  integer: 'integer',
  bigint: 'bigint',
  decimal: 'decimal(38,6)',
  boolean: 'boolean',
  date: 'date',
  datetime: 'datetime',
  binary: 'blob',
  json: 'text',
};

let sqlite: Database.Database | undefined;
let client: DrizzleClientLike | undefined;

export function openSqlite(): DrizzleClientLike {
  if (client) return client;

  sqlite = new Database(':memory:');
  const db = drizzle({ client: sqlite });
  // Sem cast: o `db` do SQLite satisfaz `DrizzleClientLike` estruturalmente,
  // porque é ele que expõe `all()`. Um `db` de Postgres, MySQL ou SQL Server
  // não satisfaz — e é justamente isso que o cast antigo escondia, deixando o
  // corpus verde num único dialeto parecer cobertura dos quatro.
  client = db;

  for (const entry of Object.values(DRIZZLE_CORPUS)) {
    db.run(sql.raw(createTable(entry.table)));
  }

  seed(db);
  return client;
}

export function closeSqlite(): void {
  sqlite?.close();
  sqlite = undefined;
  client = undefined;
}

/** Source do model referenciado pelo preset (`user.deep` -> `user`). */
export function sourceFor(preset: string) {
  const model = preset.split('.')[0];
  const entry = DRIZZLE_CORPUS[model];

  return drizzleSource({
    db: drizzleDatabase({ client: openSqlite(), dialect: 'sqlite' }),
    dialect: 'sqlite',
    table: entry.table,
    relations: entry.relations,
  });
}

function createTable(table: DrizzleTable): string {
  const columns = Object.entries(table.columns).map(([name, column]) => {
    const nullability = column.nullable ? '' : ' not null';
    return `"${name}" ${PHYSICAL[column.kind]}${nullability}`;
  });

  const primaryKey = Object.entries(table.columns)
    .filter(([, column]) => column.primaryKey)
    .map(([name]) => `"${name}"`);

  return `create table "${table.name}" (${[
    ...columns,
    `primary key (${primaryKey.join(', ')})`,
  ].join(', ')})`;
}

/**
 * Carrega o seed canônico com SQL direto.
 *
 * Os valores precisam chegar ao banco exatamente como o corpus os declara —
 * nenhuma camada de mapeamento no meio, pela mesma razão que o harness do
 * TypeORM insere pelo query builder e não por `save()`.
 */
function seed(db: ReturnType<typeof drizzle>): void {
  insert(
    db,
    'companies',
    ['id', 'name', 'name_folded', 'owner_id'],
    [
      ...CORPUS_SEED.companies.map((row) => [
        row.id,
        row.name,
        row.name_folded,
        null,
      ]),
    ]
  );

  insert(
    db,
    'users',
    [
      'id',
      'name',
      'name_folded',
      'email',
      'email_folded',
      'document',
      'zip',
      'code',
      'score',
      'balance',
      'active',
      'born_on',
      'created_at',
      'nickname',
      'company_id',
    ],
    CORPUS_SEED.users.map((row) => [
      row.id,
      row.name,
      row.name_folded,
      row.email,
      row.email_folded,
      row.document,
      row.zip,
      row.code,
      row.score.toString(),
      row.balance,
      row.active ? 1 : 0,
      row.born_on,
      row.created_at,
      row.nickname,
      row.company_id,
    ])
  );

  // Os donos só existem depois dos usuários; o seed do TypeORM faz o mesmo.
  for (const row of CORPUS_SEED.companies) {
    db.run(
      sql`update ${sql.identifier('companies')} set ${sql.identifier('owner_id')} = ${row.owner_id} where ${sql.identifier('id')} = ${row.id}`
    );
  }

  insert(
    db,
    'posts',
    ['id', 'id_order', 'title', 'title_folded', 'user_id'],
    CORPUS_SEED.posts.map((row) => [
      row.id,
      row.id_order,
      row.title,
      row.title_folded,
      row.user_id,
    ])
  );

  insert(
    db,
    'tags',
    ['post_id', 'post_id_order', 'label'],
    CORPUS_SEED.tags.map((row) => [row.post_id, row.post_id_order, row.label])
  );
}

function insert(
  db: ReturnType<typeof drizzle>,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[]
): void {
  if (rows.length === 0) return;

  const columnList = sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `
  );

  for (const row of rows) {
    const values = sql.join(
      row.map((value) => sql`${value}`),
      sql`, `
    );
    db.run(
      sql`insert into ${sql.identifier(table)} (${columnList}) values (${values})`
    );
  }
}
