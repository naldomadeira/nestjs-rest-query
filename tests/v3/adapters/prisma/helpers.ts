import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import {
  createPrismaManifest,
  prismaSource,
  type PrismaClientLike,
  type PrismaManifest,
} from '@infra/adapters/prisma';
import { CORPUS_SEED } from '../../corpus/seed';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import { PrismaClient } from './generated/sqlite/client';

/**
 * SQLite como dialeto de referência do adapter Prisma.
 *
 * Igual ao harness do TypeORM e do Drizzle: SQLite **não** é célula da matriz
 * de paridade, serve para provar que o compilador implementa a semântica do
 * plano contra um client realmente gerado (spec §5.1) sobre o driver adapter
 * `@prisma/adapter-better-sqlite3`. DDL e seed são SQL cru, não `db push` nem
 * `create`/`createMany` tipados — os valores do corpus chegam ao banco
 * exatamente como declarados, sem camada de mapeamento no meio.
 */

const PHYSICAL: Readonly<Record<string, string>> = {
  string: 'varchar',
  uuid: 'varchar',
  integer: 'integer',
  bigint: 'bigint',
  decimal: 'decimal(38,6)',
  boolean: 'boolean',
  date: 'date',
  datetime: 'datetime',
};

interface TableSpec {
  readonly table: string;
  readonly columns: ReadonlyArray<readonly [string, keyof typeof PHYSICAL]>;
  readonly primaryKey: readonly string[];
}

const TABLES: readonly TableSpec[] = [
  {
    table: 'companies',
    columns: [
      ['id', 'integer'],
      ['name', 'string'],
      ['name_folded', 'string'],
      ['owner_id', 'integer'],
    ],
    primaryKey: ['id'],
  },
  {
    table: 'users',
    columns: [
      ['id', 'integer'],
      ['name', 'string'],
      ['name_folded', 'string'],
      ['email', 'string'],
      ['email_folded', 'string'],
      ['document', 'string'],
      ['zip', 'string'],
      ['code', 'string'],
      ['score', 'bigint'],
      ['balance', 'decimal'],
      ['active', 'boolean'],
      ['born_on', 'date'],
      ['created_at', 'datetime'],
      ['nickname', 'string'],
      ['company_id', 'integer'],
    ],
    primaryKey: ['id'],
  },
  {
    table: 'posts',
    columns: [
      ['id', 'uuid'],
      ['id_order', 'string'],
      ['title', 'string'],
      ['title_folded', 'string'],
      ['user_id', 'integer'],
    ],
    primaryKey: ['id'],
  },
  {
    table: 'tags',
    columns: [
      ['post_id', 'uuid'],
      ['post_id_order', 'string'],
      ['label', 'string'],
    ],
    primaryKey: ['post_id', 'label'],
  },
];

let client: PrismaClient | undefined;

export function openSqlite(): PrismaClientLike {
  if (client) return client as unknown as PrismaClientLike;

  const adapter = new PrismaBetterSqlite3({ url: ':memory:' });
  client = new PrismaClient({ adapter });
  return client as unknown as PrismaClientLike;
}

export async function seedSqlite(): Promise<void> {
  const db = client!;

  for (const spec of TABLES) {
    await db.$executeRawUnsafe(createTable(spec));
  }

  // O seed passa pelo client tipado, não por INSERT cru.
  //
  // Os harnesses de TypeORM e Drizzle inserem por SQL para que o valor chegue
  // ao banco exatamente como o corpus declara. Aqui isso não funciona: o
  // Prisma tem representação própria de `DateTime`, e uma linha gravada por
  // SQL cru guarda o *mesmo texto* que o client grava e mesmo assim não casa
  // um `equals`. Semear pelo client é o que garante que o corpus meça o
  // compilador — o objeto do teste — e não a serialização do driver. Os demais
  // tipos não sofrem transformação nenhuma nesse caminho.
  await db.company.createMany({
    data: CORPUS_SEED.companies.map((row) => ({
      id: row.id,
      name: row.name,
      name_folded: row.name_folded,
      owner_id: null,
    })),
  });

  await db.user.createMany({
    data: CORPUS_SEED.users.map((row) => ({
      id: row.id,
      name: row.name,
      name_folded: row.name_folded,
      email: row.email,
      email_folded: row.email_folded,
      document: row.document,
      zip: row.zip,
      code: row.code,
      score: row.score,
      balance: row.balance,
      active: row.active,
      born_on: new Date(`${row.born_on}T00:00:00.000Z`),
      created_at: new Date(row.created_at),
      nickname: row.nickname,
      company_id: row.company_id,
    })),
  });

  // Os donos só existem depois dos usuários; o seed do TypeORM/Drizzle faz o
  // mesmo.
  for (const row of CORPUS_SEED.companies) {
    await db.company.update({
      where: { id: row.id },
      data: { owner_id: row.owner_id },
    });
  }

  await db.post.createMany({
    data: CORPUS_SEED.posts.map((row) => ({
      id: row.id,
      id_order: row.id_order,
      title: row.title,
      title_folded: row.title_folded,
      user_id: row.user_id,
    })),
  });

  await db.tag.createMany({
    data: CORPUS_SEED.tags.map((row) => ({
      post_id: row.post_id,
      post_id_order: row.post_id_order,
      label: row.label,
    })),
  });
}

export async function closeSqlite(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

/**
 * Manifesto escrito à mão (spec §15.2).
 *
 * Exportado para que `manifest-matches-schema.spec.ts` valide **este** objeto
 * contra o `schema.prisma`, e não uma cópia dele: uma cópia validaria a si
 * mesma e a divergência que o gate existe para pegar passaria.
 */
export const MANIFEST: PrismaManifest = createPrismaManifest({
  provider: 'sqlite',
  registry: CORPUS_SCHEMAS,
  models: {
    user: { delegate: 'user' },
    company: { delegate: 'company' },
    post: { delegate: 'post' },
    tag: { delegate: 'tag' },
  },
});

/** Source do model referenciado pelo preset (`user.deep` -> `user`). */
export function sourceFor(preset: string) {
  const model = preset.split('.')[0];

  return prismaSource({
    client: openSqlite(),
    model,
    manifest: MANIFEST,
  });
}

function createTable(spec: TableSpec): string {
  const columns = spec.columns.map(
    ([name, kind]) => `"${name}" ${PHYSICAL[kind]}`
  );
  const primaryKey = spec.primaryKey.map((name) => `"${name}"`);

  return `create table "${spec.table}" (${[
    ...columns,
    `primary key (${primaryKey.join(', ')})`,
  ].join(', ')})`;
}
