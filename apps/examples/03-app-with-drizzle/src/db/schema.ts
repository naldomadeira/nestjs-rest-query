import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Schema **físico** do exemplo, em Drizzle.
 *
 * Este arquivo é a fonte única do DDL: `drizzle-kit push` cria as tabelas a
 * partir daqui e o seed insere por estes objetos tipados. O caminho de
 * *consulta* da v3 **não** usa nada disto — ele usa os descritores lógicos de
 * `tables.ts`. As duas declarações existem porque a biblioteca não deriva o
 * descritor lógico de um `pgTable`; `assertPhysicalSchemaMatches` (em
 * `tables.ts`) transforma a divergência entre elas em falha de inicialização.
 *
 * ## Por que os nomes físicos são snake_case
 *
 * A API REST deste exemplo expõe `companyId` e `createdAt`, como a do 01; o
 * banco chama as mesmas colunas de `company_id` e `created_at`, que é a
 * convenção normal em Postgres. As duas convenções coexistem porque
 * `DrizzleColumn.name` é honrado: a **chave** do descritor é o campo lógico
 * (JSON, regras, `fields=`) e `name` é o identificador que vai ao SQL. Até o
 * PR5 não era assim — o compilador emitia a chave e ignorava `name` —, e este
 * exemplo precisava nomear as colunas físicas em camelCase para funcionar.
 *
 * ## Por que existem colunas a mais
 *
 * - `*Folded`: valor dobrado (`NFC` + `toLowerCase`, o `foldText` do pacote).
 *   `search`, `ilike` e `notIlike` comparam esta coluna literalmente, então o
 *   resultado não depende da collation do servidor. É responsabilidade da
 *   aplicação preenchê-la na escrita — ver `database/bootstrap.ts`.
 * - `idOrder`: `portableOrderField` da PK. `uuid` não tem ordem total idêntica
 *   nas três famílias de banco, e a paginação da v3 anexa a PK como desempate
 *   em **toda** requisição. Sem esta coluna, todo `GET` falharia com
 *   `CAPABILITY_UNAVAILABLE` — não só os que pedem `sort=id`.
 *
 * As três colunas internas nunca aparecem no JSON: o descritor lógico as marca
 * `internal`, e o normalizador do núcleo as descarta depois de usá-las.
 */

/** Colunas textuais portáveis usam collation de code point — ver o DDL do E2E. */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idOrder: text('id_order').notNull(),
    name: text('name').notNull(),
    nameFolded: text('name_folded').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('companies_name_folded_idx').on(table.nameFolded)]
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idOrder: text('id_order').notNull(),
    name: text('name').notNull(),
    nameFolded: text('name_folded').notNull(),
    email: text('email').notNull().unique(),
    emailFolded: text('email_folded').notNull(),
    // Nullable de propósito: é o que dá sentido a `filter[company][isNull]` e
    // ao `LEFT JOIN` que devolve `company: null` em vez de omitir a linha.
    companyId: uuid('company_id').references(() => companies.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('users_name_folded_idx').on(table.nameFolded),
    index('users_email_folded_idx').on(table.emailFolded),
    index('users_company_id_idx').on(table.companyId),
  ]
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idOrder: text('id_order').notNull(),
    title: text('title').notNull(),
    titleFolded: text('title_folded').notNull(),
    content: text('content'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('posts_title_folded_idx').on(table.titleFolded),
    index('posts_user_id_idx').on(table.userId),
  ]
);

/**
 * Não há `relations()` aqui.
 *
 * Dois motivos, e nenhum é estilo. O `drizzle-orm` 1.x removeu o helper
 * `relations()` em favor de `defineRelations(schema, ...)`, e a v3 declara
 * relação por **path pontuado** no descritor lógico (`{ company, posts }` em
 * `tables.ts`), não pela metadata do ORM. Manter um grafo de relações do
 * Drizzle aqui seria uma terceira declaração da mesma coisa, sem ninguém a
 * consumir.
 */
