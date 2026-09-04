import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

/**
 * Schema lógico e regras do endpoint de produtos.
 *
 * Na v3 as duas coisas são declaradas, não inferidas, e vivem fora do
 * controller de propósito: o schema descreve o que o modelo **é**, as regras
 * descrevem o que **este endpoint** autoriza. O mesmo schema pode servir a
 * endpoints com autorizações diferentes.
 *
 * Nada aqui é adivinhado a partir da entidade do TypeORM. Se o schema declarar
 * um campo que a entidade não tem, a inicialização falha com
 * `SOURCE_CONFIGURATION_INVALID` — metadado ausente falha fechado, e é isso que
 * evita uma query montada sobre uma coluna que não existe.
 */

const categorySchema: QuerySchema = defineQuerySchema({
  model: 'category',
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
      // Coluna interna: nunca é filtrável, projetável nem ordenável, e não
      // aparece no JSON. Existe para `ilike` e `search` compararem valor
      // dobrado em vez de depender da collation do banco.
      internal: true,
    },
  ],
  relations: [],
});

const productSchema: QuerySchema = defineQuerySchema({
  model: 'product',
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
    // `decimal` é decidido pelo tipo do campo, não pela aparência do texto:
    // `"10.50"` continua decimal exato e nunca vira float.
    { path: 'price', kind: 'decimal', nullable: false, primaryKey: false },
    { path: 'categoryId', kind: 'integer', nullable: false, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    { path: 'category', target: 'category', cardinality: 'one', nullable: false },
  ],
});

/** Todos os schemas alcançáveis a partir do root, indexados por model. */
export const PRODUCT_SCHEMAS: SchemaRegistry = new Map([
  ['product', productSchema],
  ['category', categorySchema],
]);

/**
 * Regras do `GET /products`.
 *
 * A whitelist é **exata**: autorizar a relação `category` não autoriza
 * `category.name`. Cada campo declara os operadores que aceita, então a
 * documentação Swagger reflete exatamente o que o endpoint aceita — a v3 não
 * tem lista global de operadores.
 */
export const productRules = defineQueryRules(PRODUCT_SCHEMAS, 'product', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'price', operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] },
    { path: 'categoryId', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gt', 'lt', 'between'] },
    { path: 'category.name', operators: ['eq', 'ilike'] },
  ],
  sorts: ['id', 'name', 'price', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'price', 'categoryId', 'createdAt'],
      default: ['id', 'name', 'price', 'categoryId', 'createdAt'],
    },
    relations: {
      category: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['category'],
  search: ['name'],
});
