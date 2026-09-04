import { defineQueryRules } from 'nestjs-rest-query';
import { APP_SCHEMAS } from '../query/schemas';

/**
 * Regras do `GET /posts`.
 *
 * `id` é UUID e está em `sorts`: só é aceito porque o schema declara
 * `portableOrderField: 'idOrder'`. Sem isso, a ordenação sairia da collation
 * do servidor e a paginação mudaria de banco para banco.
 */
export const postsRules = defineQueryRules(APP_SCHEMAS, 'post', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'title', operators: ['eq', 'like', 'notLike', 'ilike'] },
    // `content` é anulável e não tem coluna dobrada: só `isNull` faz sentido.
    { path: 'content', operators: ['isNull'] },
    { path: 'userId', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    { path: 'user.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['id', 'title', 'createdAt', 'user.name'],
  fields: {
    root: {
      allowed: ['id', 'title', 'content', 'userId', 'createdAt'],
      default: ['id', 'title', 'userId', 'createdAt'],
    },
    relations: {
      user: { allowed: ['id', 'name', 'email'], default: ['id', 'name'] },
    },
  },
  includes: ['user'],
  search: ['title'],
});
