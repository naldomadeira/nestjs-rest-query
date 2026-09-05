import { foldText } from 'nestjs-rest-query';
import type { PrismaClient } from '../src/generated/prisma/client';

/**
 * DDL e seed do banco do exemplo.
 *
 * Um único lugar descreve o banco: o `seed` de desenvolvimento e o smoke E2E
 * chamam as mesmas duas funções. Duas cópias da DDL divergiriam, e o E2E
 * passaria a medir um banco que ninguém roda.
 *
 * A DDL é SQL cru, não `prisma db push`. É deliberado, pelo mesmo motivo do
 * harness da biblioteca (`tests/v3/adapters/prisma/`): o que sustenta a
 * paridade é a *collation* e a precisão declaradas, e `db push` deriva a DDL
 * do `schema.prisma`, que não sabe declarar `COLLATE "C"`. A referência é
 * `test/profiles/postgres/profile.sql`.
 */

/**
 * Tabelas do perfil certificado do PostgreSQL (spec §6.3).
 *
 * `COLLATE "C"` em toda coluna textual portável: a comparação passa a ser por
 * code point, e não pela collation do locale do servidor. É o que faz `like` e
 * a ordenação devolverem o mesmo conjunto aqui, no MySQL e no SQL Server —
 * sem isso, `pt_BR.utf8` ordenaria 'Ana' e 'ana' de um jeito e o `C` do outro.
 *
 * `timestamptz` em vez de `timestamp`: a v3 devolve `datetime` como ISO 8601
 * em UTC, e uma coluna sem fuso obrigaria a adivinhar qual era o fuso da
 * escrita.
 *
 * As colunas dobradas (`*_folded`) e `posts.id_order` não são do domínio: são
 * o que a v3 exige para busca portátil e para desempate estável sobre PK
 * UUID. Ver os comentários do `schema.prisma`.
 */
const SCHEMA_STATEMENTS: readonly string[] = [
  'DROP TABLE IF EXISTS posts',
  'DROP TABLE IF EXISTS users',
  'DROP TABLE IF EXISTS companies',
  `CREATE TABLE companies (
     id          serial PRIMARY KEY,
     name        text COLLATE "C" NOT NULL,
     name_folded text COLLATE "C" NOT NULL,
     created_at  timestamptz NOT NULL
   )`,
  `CREATE TABLE users (
     id           serial PRIMARY KEY,
     name         text COLLATE "C" NOT NULL,
     name_folded  text COLLATE "C" NOT NULL,
     email        text COLLATE "C" NOT NULL,
     email_folded text COLLATE "C" NOT NULL,
     company_id   integer REFERENCES companies (id),
     created_at   timestamptz NOT NULL
   )`,
  `CREATE TABLE posts (
     id           uuid PRIMARY KEY,
     -- portableOrderField de posts.id: UUID nativo não tem ordem total
     -- idêntica nas três famílias de banco, e o desempate de paginação da v3
     -- é sempre sobre a PK.
     id_order     text COLLATE "C" NOT NULL,
     title        text COLLATE "C" NOT NULL,
     title_folded text COLLATE "C" NOT NULL,
     content      text COLLATE "C",
     user_id      integer NOT NULL REFERENCES users (id),
     created_at   timestamptz NOT NULL
   )`,
  'CREATE INDEX companies_name_folded_idx ON companies (name_folded)',
  'CREATE INDEX users_company_id_idx ON users (company_id)',
  'CREATE INDEX users_name_folded_idx ON users (name_folded)',
  'CREATE INDEX users_email_folded_idx ON users (email_folded)',
  'CREATE INDEX posts_user_id_idx ON posts (user_id)',
  'CREATE INDEX posts_id_order_idx ON posts (id_order)',
  'CREATE INDEX posts_title_folded_idx ON posts (title_folded)',
];

/** Recria o schema do zero. Idempotente: o E2E e o `pnpm seed` reexecutam. */
export async function resetSchema(prisma: PrismaClient): Promise<void> {
  // A sessão é fixada em UTC como o perfil exige; o driver adapter mantém uma
  // conexão por pool, então isto vale para as queries seguintes deste client.
  await prisma.$executeRawUnsafe("SET TIME ZONE 'UTC'");

  for (const statement of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}

/** Derruba tudo. O E2E chama no fim para não deixar resíduo no container. */
export async function dropSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS posts');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS users');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS companies');
}

interface CompanySeed {
  readonly name: string;
}

interface UserSeed {
  readonly name: string;
  readonly email: string;
  /** Índice em `COMPANIES` (1-based), ou `null` para usuário sem empresa. */
  readonly company: number | null;
}

interface PostSeed {
  readonly id: string;
  readonly title: string;
  readonly content: string | null;
  /** Índice em `USERS` (1-based). */
  readonly user: number;
}

const COMPANIES: readonly CompanySeed[] = [
  { name: 'Acme Elétrica' },
  { name: 'Elétrica Central' },
  { name: 'Beta Logística' },
];

const USERS: readonly UserSeed[] = [
  { name: 'Ana Souza', email: 'ana@acme.test', company: 1 },
  { name: 'Bruno Lima', email: 'bruno@acme.test', company: 1 },
  { name: 'Carla Elétrica', email: 'carla@central.test', company: 2 },
  { name: 'Marta Elétrica', email: 'marta@central.test', company: 2 },
  { name: 'Diego Ramos', email: 'diego@beta.test', company: 3 },
  // Sem empresa: prova que relação `one` nula sai como `null`, e não como
  // objeto vazio.
  { name: 'Eva Nunes', email: 'eva@nunes.test', company: null },
];

/**
 * UUIDs fixos, não gerados.
 *
 * O `@default(uuid())` do Prisma tornaria o seed irreprodutível, e a
 * ordenação por `id_order` deixaria de ser verificável — o desempate de
 * paginação é justamente o que este exemplo precisa exercitar.
 */
const POSTS: readonly PostSeed[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Desconto de 100% na conta de luz',
    content: 'Como a tarifa social funciona.',
    user: 1,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: '1000 clientes atendidos',
    content: 'Balanço do trimestre.',
    user: 1,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Circuito a_b revisado',
    content: null,
    user: 2,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Circuito axb descontinuado',
    content: null,
    user: 2,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Manutenção elétrica preventiva',
    content: 'Checklist anual.',
    user: 3,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Rota de entrega otimizada',
    content: null,
    user: 5,
  },
];

/** Instante fixo do seed: `createdAt` previsível para filtro e ordenação. */
const BASE_INSTANT = Date.UTC(2026, 0, 1, 12, 0, 0);

const at = (offsetMinutes: number) =>
  new Date(BASE_INSTANT + offsetMinutes * 60_000);

/**
 * Popula o banco pelo client tipado.
 *
 * **A aplicação é responsável por preencher as colunas dobradas na escrita** —
 * a biblioteca nunca escreve. `foldText` é o mesmo helper que o núcleo usa
 * para dobrar o termo de busca, e é essa igualdade que garante que
 * `?search=ELÉTRICA` e `?search=elétrica` devolvam o mesmo conjunto.
 *
 * O seed passa pelo client, não por INSERT cru, pelo mesmo motivo do harness:
 * o Prisma tem representação própria de `DateTime`, e uma linha gravada por
 * SQL cru pode não casar um `equals` do próprio client.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  // Inserção **sequencial**, não `Promise.all`: as PKs são `serial`, e em
  // paralelo a ordem em que a sequência é consumida não é determinística — o
  // que tornaria irreprodutível qualquer teste que ordene por `id`.
  const companies: { id: number }[] = [];
  for (const [index, company] of COMPANIES.entries()) {
    companies.push(
      await prisma.company.create({
        data: {
          name: company.name,
          nameFolded: foldText(company.name),
          createdAt: at(index),
        },
      })
    );
  }

  const users: { id: number }[] = [];
  for (const [index, user] of USERS.entries()) {
    users.push(
      await prisma.user.create({
        data: {
          name: user.name,
          nameFolded: foldText(user.name),
          email: user.email,
          emailFolded: foldText(user.email),
          companyId:
            user.company === null ? null : companies[user.company - 1].id,
          createdAt: at(10 + index),
        },
      })
    );
  }

  for (const [index, post] of POSTS.entries()) {
    await prisma.post.create({
      data: {
        id: post.id,
        // A ordem portável do UUID é o próprio texto canônico da PK: ordem
        // lexicográfica por code point, igual nos três bancos.
        idOrder: post.id,
        title: post.title,
        titleFolded: foldText(post.title),
        content: post.content,
        userId: users[post.user - 1].id,
        createdAt: at(100 + index),
      },
    });
  }
}

/** Contagens do seed, para o E2E afirmar total sem repetir os dados. */
export const SEED_COUNTS = {
  companies: COMPANIES.length,
  users: USERS.length,
  posts: POSTS.length,
} as const;
