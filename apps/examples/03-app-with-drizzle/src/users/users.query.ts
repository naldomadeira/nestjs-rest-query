import { defineQueryRules } from 'nestjs-rest-query';
import type { SchemaRegistry } from 'nestjs-rest-query';
import { buildSourceSchema } from 'nestjs-rest-query/drizzle';
import {
  companiesTable,
  postsTable,
  userRelations,
  usersTable,
} from '../db/tables';

/**
 * Schemas alcançáveis a partir de `user`, e as regras do `GET /users`.
 *
 * Os schemas lógicos saem de `buildSourceSchema` — a mesma função que
 * `drizzleSource` usa internamente para descrever a source. Escrever um
 * `defineQuerySchema` à mão aqui daria duas verdades sobre a mesma tabela, e
 * `QueryBuilderService` compara as duas antes de executar: qualquer diferença
 * em tipo, nulabilidade ou coluna interna sai como
 * `SOURCE_CONFIGURATION_INVALID` na primeira requisição. Derivar do descritor
 * remove a classe inteira de erro.
 *
 * Os alvos entram sem relações (`{}`): o endpoint de usuários não autoriza
 * `company.users`, então o schema de `company` não precisa conhecê-la — e
 * coleção aninhada sob outra relação não é suportada pelo adapter Drizzle de
 * qualquer forma.
 */
export const USER_SCHEMAS: SchemaRegistry = new Map([
  ['user', buildSourceSchema(usersTable, userRelations)],
  ['company', buildSourceSchema(companiesTable, {})],
  ['post', buildSourceSchema(postsTable, {})],
]);

/**
 * Regras do `GET /users`.
 *
 * A whitelist é **exata** e por campo: autorizar a relação `company` não
 * autoriza `company.name`, e cada campo declara os operadores que aceita. O
 * que não está aqui não existe para o cliente, e a documentação Swagger sai
 * destas mesmas regras.
 *
 * O que está deliberadamente **fora**:
 *
 * - `sorts` não tem `id`, `companyId` nem `posts.*`. `uuid` não tem ordem
 *   total idêntica nas três famílias de banco, então só ordena pela coluna
 *   portável — e `id` já entra como desempate em toda página, por baixo.
 *   Ordem através de relação `many` não tem semântica definida e é recusada na
 *   construção das regras.
 * - `emailFolded`, `nameFolded` e `idOrder` não aparecem em lugar nenhum: são
 *   colunas internas, e o schema lógico as marca como tal.
 */
export const userRules = defineQueryRules(USER_SCHEMAS, 'user', {
  filters: [
    { path: 'id', operators: ['eq', 'in'] },
    { path: 'name', operators: ['eq', 'like', 'ilike'] },
    { path: 'email', operators: ['eq', 'ilike'] },
    { path: 'companyId', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
    // Relação como alvo aceita só `isNull`: `filter[company][isNull]=true`
    // devolve os usuários sem empresa, sem o cliente saber o nome da FK.
    { path: 'company', operators: ['isNull'] },
    { path: 'company.name', operators: ['eq', 'ilike'] },
    // Relação `many` também aceita `isNull`, e compila para `EXISTS`
    // correlacionado — nunca para uma junção que infle o root.
    { path: 'posts', operators: ['isNull'] },
    { path: 'posts.title', operators: ['eq', 'ilike'] },
  ],
  sorts: ['name', 'email', 'createdAt', 'company.name'],
  fields: {
    root: {
      allowed: ['id', 'name', 'email', 'companyId', 'createdAt'],
      default: ['id', 'name', 'email', 'companyId', 'createdAt'],
    },
    relations: {
      // `createdAt` da empresa fica fora de propósito: a whitelist de relação
      // é exata, e autorizar `company` não autoriza os campos dela. Pedir
      // `fields=company.createdAt` sai como `FIELD_NOT_ALLOWED`, sem tocar no
      // banco.
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
      posts: {
        allowed: ['id', 'title', 'createdAt'],
        default: ['id', 'title'],
      },
    },
  },
  includes: ['company', 'posts'],
  // `search` compara a coluna dobrada com o termo dobrado pelo mesmo
  // `foldText`. `ILIKE` nunca é emitido, e o resultado não depende da
  // collation do servidor.
  search: ['name', 'email', 'company.name'],
});
