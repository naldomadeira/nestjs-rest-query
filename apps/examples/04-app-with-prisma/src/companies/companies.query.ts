import { defineQueryRules } from 'nestjs-rest-query';
import { APP_SCHEMAS } from '../query/schemas';

/** Regras do `GET /companies`. */
export const companiesRules = defineQueryRules(APP_SCHEMAS, 'company', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    { path: 'users.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['id', 'name', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'createdAt'],
      default: ['id', 'name', 'createdAt'],
    },
    relations: {
      users: { allowed: ['id', 'name', 'email'], default: ['id', 'name'] },
    },
  },
  includes: ['users'],
  search: ['name'],
});
