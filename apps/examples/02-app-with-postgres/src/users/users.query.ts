import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

/**
 * Schema lógico e regras do endpoint de usuários.
 *
 * O schema é **declarado**, não inferido da entidade. Existe um derivador
 * (`buildSchemaRegistry`, do subpath `nestjs-rest-query/typeorm`), mas ele
 * exige um `Repository` vivo, e as regras aqui são consumidas por
 * `@ApiDynamicQuery(...)` — um decorator, avaliado no carregamento da classe,
 * antes de qualquer `DataSource` existir. Declarar é o que permite ter uma
 * única fonte para autorização e Swagger.
 *
 * A declaração não é livre: antes de executar, o núcleo compara este schema
 * com o que o adapter deriva da metadata do TypeORM, campo a campo (`kind`,
 * `nullable`, `primaryKey`, `foldedField`, `internal`). Divergir aqui não
 * produz query errada — produz `SOURCE_CONFIGURATION_INVALID`.
 *
 * O nome do model não é escolhido: o adapter o deriva da classe da entidade
 * (`User` -> `user`), e o núcleo recusa a execução se não bater.
 */
const userSchema: QuerySchema = defineQuerySchema({
  model: 'user',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    { path: 'ssoUserId', kind: 'string', nullable: false, primaryKey: false },
    { path: 'username', kind: 'string', nullable: false, primaryKey: false },
    {
      path: 'firstName',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'firstName_folded',
    },
    {
      path: 'firstName_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      // Coluna interna: não é filtrável, projetável nem ordenável, e nunca
      // aparece no JSON. Só existe para `ilike` e `search` compararem valor
      // já normalizado, em vez de depender da collation do PostgreSQL.
      internal: true,
    },
    { path: 'lastName', kind: 'string', nullable: false, primaryKey: false },
    {
      path: 'email',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'email_folded',
    },
    {
      path: 'email_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    // `document` guarda CPF com zeros à esquerda. É `string` justamente por
    // isso: na v2 a coerção olhava o formato do texto e transformava
    // `"00000000001"` em `1`, o que nunca casava com a coluna.
    { path: 'document', kind: 'string', nullable: false, primaryKey: false },
    { path: 'photoUrl', kind: 'string', nullable: true, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [],
});

/** Registry do endpoint: todos os models alcançáveis a partir do root. */
export const USER_SCHEMAS: SchemaRegistry = new Map([['user', userSchema]]);

/** Reexportado para o registry de solicitações de acesso, que chega a `user`. */
export { userSchema };

/**
 * Regras do `GET /users`.
 *
 * `updatedAt` está no schema mas fora de toda whitelist de propósito: é o
 * campo que prova, no E2E, que o modelo conhecer a coluna não autoriza o
 * cliente a pedi-la.
 */
export const userRules = defineQueryRules(USER_SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'ssoUserId', operators: ['eq', 'in'] },
    { path: 'username', operators: ['eq', 'in', 'like'] },
    // `ilike` só é declarável porque `firstName` tem `foldedField`. Sem a
    // coluna dobrada isso falharia ao subir a aplicação, não na requisição.
    { path: 'firstName', operators: ['eq', 'ilike'] },
    { path: 'lastName', operators: ['eq', 'like'] },
    { path: 'email', operators: ['eq', 'ilike'] },
    { path: 'document', operators: ['eq', 'in'] },
    // `isNull` exige campo nulável — a matriz de operadores recusa o resto.
    { path: 'photoUrl', operators: ['isNull'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
  ],
  sorts: ['id', 'username', 'email', 'firstName', 'createdAt'],
  fields: {
    root: {
      allowed: [
        'id',
        'ssoUserId',
        'username',
        'firstName',
        'lastName',
        'email',
        'document',
        'photoUrl',
        'createdAt',
      ],
      default: [
        'id',
        'username',
        'firstName',
        'lastName',
        'email',
        'createdAt',
      ],
    },
  },
  search: ['firstName', 'email'],
});
