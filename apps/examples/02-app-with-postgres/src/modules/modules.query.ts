import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';
import { ModuleStatus } from './entities/module.entity';

/**
 * Schema lógico e regras do endpoint de módulos.
 *
 * Ver `users.query.ts` para o porquê de o schema ser declarado à mão.
 */
const moduleSchema: QuerySchema = defineQuerySchema({
  model: 'module',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    {
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'slug', kind: 'string', nullable: false, primaryKey: false },
    {
      // `enum` não é `string`: o valor recebido é validado contra
      // `enumValues` antes de virar parâmetro, então `?filter[status][eq]=foo`
      // morre como `FILTER_VALUE_INVALID` e nunca chega ao banco.
      path: 'status',
      kind: 'enum',
      nullable: false,
      primaryKey: false,
      enumValues: Object.values(ModuleStatus),
    },
    { path: 'icon', kind: 'string', nullable: true, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [],
});

export const MODULE_SCHEMAS: SchemaRegistry = new Map([
  ['module', moduleSchema],
]);

export { moduleSchema };

/**
 * Regras do `GET /modules`.
 *
 * `status` saiu de `sorts` na migração da v2. Não foi escolha de gosto:
 * ordenar por `enum` exige um `portableOrderField`, porque a ordem de um enum
 * depende do provider (no PostgreSQL é a ordem de declaração do tipo, no MySQL
 * é o índice do valor, no SQL Server não existe enum). Declarar
 * `sorts: ['status']` sem essa coluna faz a aplicação **não subir** — o que é
 * melhor que a v2, onde a mesma URL produzia ordens diferentes por banco.
 */
export const moduleRules = defineQueryRules(MODULE_SCHEMAS, 'module', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'ilike'] },
    { path: 'slug', operators: ['eq', 'in', 'like'] },
    { path: 'status', operators: ['eq', 'in'] },
    { path: 'icon', operators: ['isNull'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
  ],
  sorts: ['id', 'name', 'slug', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'slug', 'status', 'icon', 'createdAt'],
      default: ['id', 'name', 'slug', 'status', 'icon'],
    },
  },
  search: ['name'],
});
