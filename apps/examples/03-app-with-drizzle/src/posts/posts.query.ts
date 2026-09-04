import { defineQueryRules } from 'nestjs-rest-query';
import type { SchemaRegistry } from 'nestjs-rest-query';
import { buildSourceSchema } from 'nestjs-rest-query/drizzle';
import {
  companiesTable,
  postRelations,
  postsTable,
  usersTable,
} from '../db/tables';

/**
 * Schemas e regras do `GET /posts`.
 *
 * Aqui a relação é `one` e **não nulável** (`posts.userId` é `NOT NULL`), o que
 * muda o contrato do JSON: `user` nunca vem `null`, e `filter[user][isNull]`
 * seria recusado na construção das regras porque o campo não é nulável.
 *
 * `user.company` fica fora do registro de propósito: um salto profundo
 * `user.company.name` exigiria declarar a relação `'user.company'` no mapa
 * pontuado, e o exemplo mantém o caminho profundo para o endpoint de usuários.
 */
export const POST_SCHEMAS: SchemaRegistry = new Map([
  ['post', buildSourceSchema(postsTable, postRelations)],
  ['user', buildSourceSchema(usersTable, {})],
  ['company', buildSourceSchema(companiesTable, {})],
]);

export const postRules = defineQueryRules(POST_SCHEMAS, 'post', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'title', operators: ['eq', 'like', 'ilike'] },
    // `content` é nulável e não tem coluna dobrada: aceita `isNull` e `like`
    // literal, mas não `ilike` — o operador insensível exige folded field, e a
    // construção das regras recusaria.
    { path: 'content', operators: ['like', 'isNull'] },
    { path: 'userId', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    { path: 'user.name', operators: ['eq', 'ilike'] },
    { path: 'user.email', operators: ['eq'] },
  ],
  sorts: ['title', 'createdAt', 'user.name'],
  fields: {
    root: {
      allowed: ['id', 'title', 'content', 'userId', 'createdAt'],
      default: ['id', 'title', 'userId', 'createdAt'],
    },
    relations: {
      user: {
        allowed: ['id', 'name', 'email'],
        default: ['id', 'name'],
      },
    },
  },
  includes: ['user'],
  search: ['title', 'user.name'],
});
