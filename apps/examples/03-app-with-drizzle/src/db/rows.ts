/**
 * Forma das linhas que a v3 devolve, por recurso.
 *
 * Estes tipos descrevem o **JSON canônico**, depois do normalizador — não a
 * linha do driver. É por isso que `createdAt` é `string` e não `Date`: o núcleo
 * encoda `datetime` como ISO 8601, e `uuid` como texto, para que as três
 * famílias de banco devolvam a mesma coisa.
 *
 * O que eles fixam é a projeção **default** de cada rota, a mesma que as
 * classes `*View` publicam no OpenAPI. Uma requisição com `fields=id,name`
 * devolve menos chaves do que o tipo promete, porque é o cliente quem escolhe a
 * projeção a cada chamada — o tipo é promessa de *forma*, não de presença. As
 * relações ficam opcionais porque só chegam com `includes`.
 *
 * Declarar isto passou a valer a pena no PR5: `drizzleSource` era fixo em
 * `object`, e um serviço que quisesse `NormalizedQueryResult<UserRow>` precisava
 * de um `as` — proibido pelo gate §23. Hoje o tipo entra pelo executor
 * injetado (`DrizzleDatabase<UserRow>`) e atravessa até o retorno de
 * `execute()`.
 */

export interface CompanyRow {
  id: string;
  name: string;
  createdAt: string;
  /** Só com `includes=users`. */
  users?: UserRow[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  createdAt: string;
  /** Só com `includes=company`; `null` no usuário sem empresa. */
  company?: CompanyRow | null;
  /** Só com `includes=posts`. */
  posts?: PostRow[];
}

export interface PostRow {
  id: string;
  title: string;
  content: string | null;
  userId: string;
  createdAt: string;
  /** Só com `includes=user`; nunca `null`, porque `posts.userId` é NOT NULL. */
  user?: UserRow;
}
