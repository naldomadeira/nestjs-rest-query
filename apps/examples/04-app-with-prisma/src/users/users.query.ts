import { defineQueryRules } from 'nestjs-rest-query';
import { APP_SCHEMAS } from '../query/schemas';

/**
 * Regras do `GET /users`.
 *
 * A whitelist é **exata**: autorizar a relação `company` não autoriza
 * `company.name` — na v2 autorizava. Cada campo declara os operadores que
 * aceita, e a documentação Swagger sai dessas mesmas regras, então
 * autorização e documentação não podem divergir.
 */
export const usersRules = defineQueryRules(APP_SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    // `ilike` exige `foldedField` no schema: sob o perfil `portable-strict` ele
    // compara a coluna dobrada com o termo dobrado, sem `mode: 'insensitive'`.
    { path: 'name', operators: ['eq', 'like', 'notLike', 'ilike'] },
    { path: 'email', operators: ['eq', 'ilike'] },
    { path: 'companyId', operators: ['eq', 'in', 'isNull'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    // Filtro através de relação `one` -> vira `company: { is: ... }` no Prisma.
    { path: 'company.name', operators: ['eq', 'ilike'] },
    // Através de relação `many` -> vira `posts: { some: ... }`: o root nunca
    // infla, então `total` continua contando usuários, não linhas de join.
    { path: 'posts.title', operators: ['eq', 'ilike'] },
  ],
  // Ordenar por `company.name` é permitido (relação `one`). Por `posts.title`
  // não seria: ordenar o pai por uma chave dentro da coleção não tem semântica
  // definida, e o Prisma recusa com 400.
  sorts: ['id', 'name', 'email', 'createdAt', 'company.name'],
  fields: {
    // `createdAt` está em `filters` e em `sorts`, mas **não** em `allowed`.
    // Na v2 declarar `fields` restringia implicitamente o sort; na v3 as duas
    // listas são independentes, e este endpoint usa isso de propósito: ordenar
    // por data de criação é permitido, projetá-la não é.
    root: {
      allowed: ['id', 'name', 'email', 'companyId'],
      default: ['id', 'name', 'email', 'companyId'],
    },
    // Toda relação em `includes` precisa de projeção declarada, com pelo menos
    // um default.
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
      posts: {
        allowed: ['id', 'title', 'createdAt'],
        default: ['id', 'title'],
      },
    },
  },
  includes: ['company', 'posts'],
  search: ['name', 'email'],
});
