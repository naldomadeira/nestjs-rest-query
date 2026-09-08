import { defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

/**
 * Schema lógico dos três models do exemplo.
 *
 * Na v3 o schema é **declarado, não inferido**. No adapter do TypeORM existe
 * `buildSchemaRegistry(repository)`, que deriva os descritores da metadata da
 * entidade; no Prisma **não existe equivalente** — o generator que leria o
 * `schema.prisma` é lacuna declarada para a 3.1.0. Então este arquivo é
 * escrito à mão e mantido em par com `prisma/schema.prisma` por revisão, não
 * por ferramenta.
 *
 * O que isso custa, dito sem eufemismo: nada aqui é validado contra o banco
 * nem contra o `schema.prisma`. O `PrismaAdapter.describe()` devolve
 * exatamente o schema do manifesto, então um campo declarado com o nome errado
 * só aparece como erro do Prisma na primeira requisição que o tocar — ao
 * contrário do TypeORM, onde a divergência falha na subida com
 * `SOURCE_CONFIGURATION_INVALID`.
 *
 * `path` é o nome da **propriedade do client do Prisma**, não o da coluna: é
 * ela que vai no `where`/`select`/`orderBy` que o adapter monta. Como o
 * `schema.prisma` mapeia `nameFolded -> name_folded` com `@map`, a API HTTP
 * fica camelCase e o banco segue o perfil certificado em snake_case.
 */

const companySchema: QuerySchema = defineQuerySchema({
  model: 'company',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'nameFolded',
    },
    {
      path: 'nameFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      // Coluna interna: não é filtrável, projetável nem ordenável, e nunca
      // aparece no JSON. Existe para `ilike` e `search` compararem valor
      // dobrado em vez de pedir `mode: 'insensitive'` ao Prisma — que
      // dependeria da collation do servidor e daria resultado diferente por
      // banco.
      internal: true,
    },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'users', target: 'user', cardinality: 'many', nullable: true },
  ],
});

const userSchema: QuerySchema = defineQuerySchema({
  model: 'user',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'nameFolded',
    },
    {
      path: 'nameFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    {
      path: 'email',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'emailFolded',
    },
    {
      path: 'emailFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'companyId', kind: 'integer', nullable: true, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: true },
    { path: 'posts', target: 'post', cardinality: 'many', nullable: true },
  ],
});

const postSchema: QuerySchema = defineQuerySchema({
  model: 'post',
  primaryKey: ['id'],
  fields: [
    {
      path: 'id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      // Sem isto a subida falha com `CAPABILITY_UNAVAILABLE`: o desempate de
      // paginação é sempre sobre a PK, e UUID não tem ordem total idêntica
      // nas três famílias de banco.
      portableOrderField: 'idOrder',
    },
    {
      path: 'idOrder',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    {
      path: 'title',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'titleFolded',
    },
    {
      path: 'titleFolded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'content', kind: 'string', nullable: true, primaryKey: false },
    { path: 'userId', kind: 'integer', nullable: false, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'user', target: 'user', cardinality: 'one', nullable: false },
  ],
});

/** Todos os schemas alcançáveis a partir de qualquer root, indexados por model. */
export const APP_SCHEMAS: SchemaRegistry = new Map([
  ['company', companySchema],
  ['user', userSchema],
  ['post', postSchema],
]);
