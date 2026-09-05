import { sql } from 'drizzle-orm';
import { foldText } from 'nestjs-rest-query';
import type { AppDatabase } from '../db/database.module';
import { companies, posts, users } from '../db/schema';

/**
 * DDL e seed do exemplo, como funções — não como migration.
 *
 * O smoke E2E precisa preparar e limpar o banco por conta própria, senão ele
 * mediria o estado que o desenvolvedor deixou em disco em vez de medir a
 * biblioteca. Expor DDL e seed daqui é o que permite o mesmo código servir ao
 * `pnpm seed` (banco de trabalho) e ao teste (banco descartável).
 *
 * O DDL não sai do `drizzle-kit push` de propósito: `push` não sabe pedir
 * `COLLATE "C"`, e collation é parte da promessa de portabilidade — sem
 * comparação por code point nas colunas textuais portáveis, a mesma query
 * ordena diferente em cada servidor. É a mesma escolha do perfil certificado em
 * `test/profiles/postgres`.
 */

const TABLES = ['posts', 'users', 'companies'] as const;

/** Ordem inversa da criação: a FK impede derrubar o pai antes do filho. */
export const DROP_STATEMENTS: readonly string[] = TABLES.map(
  (table) => `drop table if exists "${table}" cascade`
);

export const CREATE_STATEMENTS: readonly string[] = [
  `create table "companies" (
     "id"           uuid primary key,
     "id_order"     text collate "C" not null,
     "name"         text collate "C" not null,
     "name_folded"  text collate "C" not null,
     "created_at"   timestamptz not null
   )`,
  `create table "users" (
     "id"            uuid primary key,
     "id_order"      text collate "C" not null,
     "name"          text collate "C" not null,
     "name_folded"   text collate "C" not null,
     "email"         text collate "C" not null unique,
     "email_folded"  text collate "C" not null,
     "company_id"    uuid references "companies" ("id"),
     "created_at"    timestamptz not null
   )`,
  `create table "posts" (
     "id"            uuid primary key,
     "id_order"      text collate "C" not null,
     "title"         text collate "C" not null,
     "title_folded"  text collate "C" not null,
     "content"       text collate "C",
     "user_id"       uuid not null references "users" ("id"),
     "created_at"    timestamptz not null
   )`,
  `create index "companies_name_folded_idx" on "companies" ("name_folded")`,
  `create index "users_name_folded_idx"     on "users" ("name_folded")`,
  `create index "users_email_folded_idx"    on "users" ("email_folded")`,
  `create index "users_company_id_idx"      on "users" ("company_id")`,
  `create index "posts_title_folded_idx"    on "posts" ("title_folded")`,
  `create index "posts_user_id_idx"         on "posts" ("user_id")`,
  // `id_order` é a coluna de desempate de toda página; sem índice a paginação
  // profunda vira sort em disco.
  `create index "companies_id_order_idx"    on "companies" ("id_order")`,
  `create index "users_id_order_idx"        on "users" ("id_order")`,
  `create index "posts_id_order_idx"        on "posts" ("id_order")`,
];

/**
 * UUID determinístico.
 *
 * Seed com `defaultRandom()` obrigaria o teste a descobrir os ids antes de
 * filtrar por eles; com id fixo, `filter[id][eq]=...` é escrevível à mão e o
 * `.http` pode citar uma linha concreta.
 */
function uuidOf(kind: string, index: number): string {
  return `${kind}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

const COMPANY_NAMES = [
  'Acme Elétrica',
  'Globex Energia',
  'Initech Elétrica',
  'Umbrella Saúde',
  'Hooli Elétrica',
];

/**
 * Nomes com diacrítico e caixa variada de propósito.
 *
 * A dobra do perfil `portable-strict` é `NFC` + `toLowerCase`: normaliza caixa
 * e **não** remove acento. Um seed só com ASCII faria o teste de busca passar
 * por acidente, sem provar nada sobre a coluna dobrada.
 */
const USER_NAMES = [
  'Ana Sória',
  'Bruno Ávila',
  'Caio Nóbrega',
  'Diego Íris',
  'Elena Ângela',
  'Fábio Rocha',
  'Gabi Antunes',
  'Hugo Pêra',
  'Iara Melo',
  'João Éder',
  'Karen Lúcia',
  'Luca Ávila',
  'Mariana Sória',
  'Nuno Ávila',
  'Olívia Costa',
];

const POST_TITLES = [
  'Olá, mundo',
  'Por que escolhemos Drizzle',
  'Uma nota sobre paginação',
  'Dicas de Postgres',
  'Migrando do TypeORM',
  'Notas de deploy em produção',
  'Lições de modelagem',
  'Backup e recuperação',
];

const USERS_PER_COMPANY = 3;
const POSTS_PER_USER = 2;

/** Base fixa: `createdAt` determinístico deixa `sort=createdAt` verificável. */
const EPOCH = Date.UTC(2026, 0, 1, 12, 0, 0);

const dayAfter = (days: number): Date => new Date(EPOCH + days * 86_400_000);

function slug(value: string): string {
  return foldText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const COMPANY_SEED = COMPANY_NAMES.map((name, index) => ({
  id: uuidOf('0c0c0c0c', index + 1),
  idOrder: uuidOf('0c0c0c0c', index + 1),
  name,
  // A aplicação preenche a coluna dobrada na escrita, com o mesmo `foldText`
  // que a biblioteca usa para dobrar o termo da busca. É esse acoplamento
  // explícito que substitui `ILIKE` e a collation do servidor.
  nameFolded: foldText(name),
  createdAt: dayAfter(index),
}));

/** `companyId` nulável precisa estar no tipo, senão o órfão não encaixa. */
interface UserRow {
  id: string;
  idOrder: string;
  name: string;
  nameFolded: string;
  email: string;
  emailFolded: string;
  companyId: string | null;
  createdAt: Date;
}

export const USER_SEED: UserRow[] = USER_NAMES.map<UserRow>((name, index) => {
  const company = COMPANY_SEED[Math.floor(index / USERS_PER_COMPANY)];
  const email = `${slug(name)}.${index + 1}@${slug(company.name)}.com`;

  return {
    id: uuidOf('0a0a0a0a', index + 1),
    idOrder: uuidOf('0a0a0a0a', index + 1),
    name,
    nameFolded: foldText(name),
    email,
    emailFolded: foldText(email),
    companyId: company.id,
    createdAt: dayAfter(index),
  };
}).concat(
  // Dois usuários sem empresa: é o que dá o que medir em
  // `filter[company][isNull]` e no `company: null` do LEFT JOIN.
  [1, 2].map<UserRow>((n) => {
    const name = `Órfão ${n}`;
    const email = `orfao${n}@exemplo.com`;

    return {
      id: uuidOf('0a0a0a0a', USER_NAMES.length + n),
      idOrder: uuidOf('0a0a0a0a', USER_NAMES.length + n),
      name,
      nameFolded: foldText(name),
      email,
      emailFolded: foldText(email),
      companyId: null,
      createdAt: dayAfter(USER_NAMES.length + n),
    };
  })
);

export const POST_SEED = USER_SEED.flatMap((user, userIndex) =>
  Array.from({ length: POSTS_PER_USER }, (_, slot) => {
    const index = userIndex * POSTS_PER_USER + slot;
    const title = `${POST_TITLES[index % POST_TITLES.length]} #${index + 1}`;

    return {
      id: uuidOf('0b0b0b0b', index + 1),
      idOrder: uuidOf('0b0b0b0b', index + 1),
      title,
      titleFolded: foldText(title),
      content: `Conteúdo do post ${index + 1}, de ${user.name}.`,
      userId: user.id,
      createdAt: dayAfter(index),
    };
  })
);

/** Cada statement vai sozinho: o protocolo preparado não aceita múltiplos. */
async function run(
  db: AppDatabase,
  statements: readonly string[]
): Promise<void> {
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

export const dropSchema = (db: AppDatabase): Promise<void> =>
  run(db, DROP_STATEMENTS);

export const createSchema = (db: AppDatabase): Promise<void> =>
  run(db, CREATE_STATEMENTS);

export async function seedDatabase(db: AppDatabase): Promise<void> {
  await db.insert(companies).values([...COMPANY_SEED]);
  await db.insert(users).values([...USER_SEED]);
  await db.insert(posts).values([...POST_SEED]);
}

/** Do zero: derruba, cria e popula. É o que o smoke E2E chama no `beforeAll`. */
export async function resetDatabase(db: AppDatabase): Promise<void> {
  await dropSchema(db);
  await createSchema(db);
  await seedDatabase(db);
}
