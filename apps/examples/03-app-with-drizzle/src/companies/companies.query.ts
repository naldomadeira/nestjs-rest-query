import { defineQueryRules } from 'nestjs-rest-query';
import type { SchemaRegistry } from 'nestjs-rest-query';
import { buildSourceSchema } from 'nestjs-rest-query/drizzle';
import { companiesTable, companyRelations, usersTable } from '../db/tables';

/**
 * Schemas e regras do `GET /companies`.
 *
 * Este endpoint existe para exercitar o caso que o Drizzle trata em duas fases:
 * uma coleção de primeiro nível (`users`) na projeção. Juntá-la ao statement
 * principal inflaria os roots e faria `LIMIT` cortar uma coleção pela metade,
 * então o adapter tira a relação do statement e a hidrata por consulta própria
 * — `total` continua contando empresas, não linhas de junção.
 *
 * Coleção **aninhada** sob outra relação (`users.posts`) não é suportada e
 * falha fechado com `ADAPTER_CONTRACT_VIOLATION`; por isso o schema de `user`
 * entra aqui sem relações.
 */
export const COMPANY_SCHEMAS: SchemaRegistry = new Map([
  ['company', buildSourceSchema(companiesTable, companyRelations)],
  ['user', buildSourceSchema(usersTable, {})],
]);

export const companyRules = defineQueryRules(COMPANY_SCHEMAS, 'company', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    // `EXISTS` correlacionado: empresas sem nenhum usuário.
    { path: 'users', operators: ['isNull'] },
    { path: 'users.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['name', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'createdAt'],
      default: ['id', 'name', 'createdAt'],
    },
    relations: {
      users: {
        allowed: ['id', 'name', 'email', 'createdAt'],
        default: ['id', 'name'],
      },
    },
  },
  includes: ['users'],
  search: ['name'],
});
