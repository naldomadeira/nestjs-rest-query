import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';

/**
 * Schema lógico e regras do endpoint de empresas.
 *
 * Ver `users.query.ts` para o porquê de o schema ser declarado à mão e para a
 * convenção do nome do model.
 */
const companySchema: QuerySchema = defineQuerySchema({
  model: 'company',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    // `uuid` é kind próprio, não `string`: a representação física difere entre
    // as famílias de banco, e por isso operadores de ordem sobre ele exigem
    // um `portableOrderField`. Aqui só autorizamos igualdade e lista.
    { path: 'uuid', kind: 'uuid', nullable: false, primaryKey: false },
    { path: 'cnpj', kind: 'string', nullable: false, primaryKey: false },
    {
      path: 'name',
      kind: 'string',
      nullable: true,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    {
      // Dobrada de um campo nulável, mas ela própria `NOT NULL DEFAULT ''`:
      // é o que faz `LIKE` sobre ela nunca perder linha por causa de NULL.
      path: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [],
});

export const COMPANY_SCHEMAS: SchemaRegistry = new Map([
  ['company', companySchema],
]);

export { companySchema };

/**
 * Regras do `GET /companies`.
 *
 * Aqui morreu o `customize` da v2, que montava à mão
 * `(name ILIKE :s OR cnpj ILIKE :s)`. Duas razões, nesta ordem:
 *
 * 1. `search` deixou de ser um parâmetro que a aplicação inventa: é da
 *    gramática, declarado por campo, e compila para comparação sobre a coluna
 *    dobrada — mesmo resultado em PostgreSQL, MySQL e SQL Server.
 * 2. `ILIKE` escrito à mão é exatamente o que o perfil `portable-strict`
 *    proíbe: o resultado passa a depender da collation do servidor.
 *
 * O CNPJ ficou fora de `search` porque não tem coluna dobrada — e não precisa:
 * dígitos e pontuação não têm caixa. Quem quer parcial de CNPJ usa
 * `filter[cnpj][like]`, onde `%` e `_` são literais.
 */
export const companyRules = defineQueryRules(COMPANY_SCHEMAS, 'company', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'uuid', operators: ['eq', 'in'] },
    { path: 'cnpj', operators: ['eq', 'in', 'like'] },
    { path: 'name', operators: ['eq', 'ilike', 'isNull'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
  ],
  sorts: ['id', 'cnpj', 'name', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'uuid', 'cnpj', 'name', 'createdAt'],
      default: ['id', 'uuid', 'cnpj', 'name'],
    },
  },
  search: ['name'],
});
