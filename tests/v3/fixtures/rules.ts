import { defineQueryRules } from '@core/authorization';
import type { CompiledQueryRules } from '@core/authorization';
import { CORPUS_SCHEMAS } from './schemas';

/**
 * Presets de regras referenciados por `CORPUS_CASES.rules`.
 *
 * Os mesmos objetos alimentam os unitários do núcleo, os contract tests do
 * TypeORM e a matriz de integração real — o que impede um adapter de "passar"
 * porque foi configurado de um jeito mais permissivo.
 */

const userRootFields = {
  allowed: [
    'id',
    'name',
    'email',
    'document',
    'zip',
    'code',
    'score',
    'balance',
    'active',
    'born_on',
    'created_at',
    'nickname',
  ],
  default: ['id', 'name'],
};

const userFilters = [
  {
    path: 'id',
    operators: ['eq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'between'],
  },
  {
    path: 'name',
    operators: [
      'eq',
      'ne',
      'like',
      'notLike',
      'ilike',
      'notIlike',
      'in',
      'notIn',
    ],
  },
  { path: 'document', operators: ['eq', 'in'] },
  { path: 'code', operators: ['eq', 'in'] },
  { path: 'score', operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] },
  { path: 'balance', operators: ['eq', 'gt', 'lt'] },
  { path: 'active', operators: ['eq'] },
  { path: 'born_on', operators: ['eq', 'gt', 'lt', 'between'] },
  { path: 'created_at', operators: ['eq', 'gt', 'lt'] },
  // `notIn` entra aqui por causa do corpus: `nickname` é a única coluna
  // anulável filtrável e `company.name` a única folha por relação, e é nelas
  // que o caminho de `NOT IN` com valores encontra NULL — de coluna e de join.
  { path: 'nickname', operators: ['eq', 'isNull', 'notIn'] },
  { path: 'company.name', operators: ['eq', 'ilike', 'notIn'] },
] as const;

const userDefault = defineQueryRules(CORPUS_SCHEMAS, 'user', {
  filters: userFilters,
  sorts: ['id', 'name', 'code', 'score', 'born_on', 'created_at'],
  fields: {
    root: userRootFields,
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['company'],
  search: ['name', 'email'],
});

/** Autoriza a relação `company`, mas nenhum caminho abaixo dela. */
const userCompanyRootOnly = defineQueryRules(CORPUS_SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq'] },
    { path: 'company', operators: ['isNull'] },
  ],
  sorts: ['id'],
  fields: {
    root: userRootFields,
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['company'],
});

const userDeep = defineQueryRules(CORPUS_SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq', 'in', 'between'] },
    { path: 'name', operators: ['eq', 'ilike'] },
    { path: 'company', operators: ['isNull'] },
    { path: 'company.name', operators: ['eq'] },
    { path: 'posts', operators: ['isNull'] },
    { path: 'posts.title', operators: ['eq', 'ilike'] },
    // Cadeias de mais de um salto, pelas mesmas duas razões que trouxeram
    // `notIn` e `posts.title` para cá: são os únicos caminhos do modelo
    // canônico que cruzam `many` e continuam — `posts.author` volta a `user`
    // (many → one) e `posts.tags` abre uma segunda coleção (many → many). Sem
    // eles nenhum caso mediria a promessa de que a semântica existencial vale
    // para a cadeia inteira, e o limite do TypeORM ficou dois PRs invisível
    // porque nada no corpus o alcançava.
    { path: 'posts.author.name', operators: ['eq'] },
    { path: 'posts.tags.label', operators: ['eq', 'in'] },
  ],
  sorts: ['id', 'name', 'code'],
  fields: {
    root: userRootFields,
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
      'company.owner': { allowed: ['id', 'name'], default: ['id', 'name'] },
      posts: { allowed: ['id', 'title'], default: ['id', 'title'] },
    },
  },
  includes: ['company', 'company.owner', 'posts'],
  // `posts.title` entra na busca por causa do corpus, como `notIn` entrou nos
  // filtros: é o único caminho de `search` que atravessa uma relação `many` no
  // modelo canônico, e sem ele nenhum caso mediria a promessa de que buscar
  // por uma folha `many` é existencial — a página vinha curta no TypeORM e
  // ninguém percebia, porque o `total` continuava certo.
  search: ['name', 'email', 'posts.title'],
});

const userNoSearch = defineQueryRules(CORPUS_SCHEMAS, 'user', {
  filters: userFilters,
  sorts: ['id', 'name', 'code'],
  fields: {
    root: userRootFields,
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['company'],
});

const postPortableOrder = defineQueryRules(CORPUS_SCHEMAS, 'post', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'title', operators: ['eq', 'like', 'ilike'] },
  ],
  sorts: ['id', 'title'],
  fields: { root: { allowed: ['id', 'title'], default: ['id', 'title'] } },
});

const tagDefault = defineQueryRules(CORPUS_SCHEMAS, 'tag', {
  filters: [{ path: 'label', operators: ['eq', 'in'] }],
  sorts: ['label'],
  fields: {
    root: { allowed: ['post_id', 'label'], default: ['post_id', 'label'] },
  },
});

export const RULES_PRESETS: Readonly<Record<string, CompiledQueryRules>> = {
  'user.default': userDefault,
  'user.company-root-only': userCompanyRootOnly,
  'user.deep': userDeep,
  'user.no-search': userNoSearch,
  'post.portable-order': postPortableOrder,
  'tag.default': tagDefault,
};
