import { defineQueryRules, defineQuerySchema } from 'nestjs-rest-query';
import type { QuerySchema, SchemaRegistry } from 'nestjs-rest-query';
import { companySchema } from '../companies/companies.query';
import { moduleSchema } from '../modules/modules.query';
import { userSchema } from '../users/users.query';

/**
 * Schema lógico e regras do endpoint de solicitações de acesso.
 *
 * É o endpoint que exercita o grafo inteiro: uma relação `one` (o solicitante),
 * uma coleção `many` (os itens) e duas relações `one` **dentro** da coleção
 * (empresa e módulo de cada item).
 *
 * O registry precisa conter todo model alcançável a partir do root, então os
 * schemas de `user`, `company` e `module` são reaproveitados dos endpoints
 * deles. Um schema por model, não um por endpoint: o que muda de endpoint para
 * endpoint são as **regras**, não o que o modelo é.
 */

const accessRequestItemSchema: QuerySchema = defineQuerySchema({
  model: 'accessrequestitem',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    {
      path: 'accessRequestId',
      kind: 'integer',
      nullable: false,
      primaryKey: false,
    },
    { path: 'companyId', kind: 'integer', nullable: false, primaryKey: false },
    { path: 'moduleId', kind: 'integer', nullable: false, primaryKey: false },
    { path: 'status', kind: 'string', nullable: false, primaryKey: false },
    { path: 'evaluatedBy', kind: 'string', nullable: true, primaryKey: false },
    {
      path: 'evaluatedAt',
      kind: 'datetime',
      nullable: true,
      primaryKey: false,
    },
    { path: 'reason', kind: 'string', nullable: true, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  // A volta para `accessRequest` existe na entidade e é omitida aqui de
  // propósito: nada nas regras precisa dela, e declará-la só abriria um ciclo
  // que o resolvedor de paths teria de percorrer sem ganho nenhum.
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: false },
    { path: 'module', target: 'module', cardinality: 'one', nullable: false },
  ],
});

const accessRequestSchema: QuerySchema = defineQuerySchema({
  model: 'accessrequest',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    { path: 'userId', kind: 'integer', nullable: false, primaryKey: false },
    {
      path: 'overallStatus',
      kind: 'string',
      nullable: false,
      primaryKey: false,
    },
    // `deletedAt` é a coluna de soft delete. O TypeORM já filtra
    // `deleted_at IS NULL` no `createQueryBuilder`, então declarar um filtro
    // sobre ela prometeria ao cliente algo que a query nunca entrega: fica no
    // schema (o adapter a vê na metadata) e fora de toda whitelist.
    { path: 'deletedAt', kind: 'datetime', nullable: true, primaryKey: false },
    { path: 'createdAt', kind: 'datetime', nullable: false, primaryKey: false },
    { path: 'updatedAt', kind: 'datetime', nullable: false, primaryKey: false },
  ],
  relations: [
    // `nullable` tem de bater com a metadata: `user_id` é `NOT NULL`, logo a
    // relação também. Uma coleção `OneToMany` é sempre nulável no derivador.
    { path: 'user', target: 'user', cardinality: 'one', nullable: false },
    {
      path: 'items',
      target: 'accessrequestitem',
      cardinality: 'many',
      nullable: true,
    },
  ],
});

export const ACCESS_REQUEST_SCHEMAS: SchemaRegistry = new Map([
  ['accessrequest', accessRequestSchema],
  ['accessrequestitem', accessRequestItemSchema],
  ['user', userSchema],
  ['company', companySchema],
  ['module', moduleSchema],
]);

/**
 * Regras do `GET /access-requests`.
 *
 * Três coisas mudaram em relação à whitelist da v2, e todas são o ponto da v3:
 *
 * - A v2 listava `items.company` em `filters` e, com isso, aceitava
 *   `items.company.<qualquer-coluna>` — a checagem olhava só o prefixo. Aqui
 *   cada path filtrável é literal.
 * - `search` na v2 incluía `items.company.name` e `items.company.cnpj`. Ficou
 *   só `user.firstName`; o motivo está na declaração de `search`, mais
 *   abaixo, e não é o bug de página curta — esse a `3.0.0` corrigiu.
 * - Ordenar por `items.<coluna>` era aceito pelo TypeORM e devolvia uma linha
 *   arbitrária do join. A v3 recusa na construção das regras: coleção não tem
 *   ordem determinística.
 */
export const accessRequestRules = defineQueryRules(
  ACCESS_REQUEST_SCHEMAS,
  'accessrequest',
  {
    filters: [
      { path: 'id', operators: ['eq', 'in'] },
      { path: 'userId', operators: ['eq', 'in'] },
      { path: 'overallStatus', operators: ['eq', 'in'] },
      { path: 'createdAt', operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
      { path: 'user.firstName', operators: ['eq', 'ilike'] },
      { path: 'user.document', operators: ['eq', 'in'] },
      // Relação como alvo: só `isNull` faz sentido, e numa coleção ele
      // significa "vazia" — compila para `NOT EXISTS`, não para um join.
      { path: 'items', operators: ['isNull'] },
      // Path que cruza a coleção: vira subquery existencial ("algum item
      // corresponde"), então `total` continua contando roots.
      { path: 'items.status', operators: ['eq', 'in'] },
      { path: 'items.companyId', operators: ['eq', 'in'] },
      { path: 'items.moduleId', operators: ['eq', 'in'] },
    ],
    sorts: ['id', 'userId', 'overallStatus', 'createdAt', 'user.firstName'],
    fields: {
      root: {
        allowed: ['id', 'userId', 'overallStatus', 'createdAt'],
        default: ['id', 'userId', 'overallStatus', 'createdAt'],
      },
      // Toda relação em `includes` precisa da projeção declarada, com pelo
      // menos um default — inclusive as aninhadas dentro da coleção.
      relations: {
        user: {
          allowed: ['id', 'username', 'firstName', 'lastName', 'email'],
          default: ['id', 'username', 'firstName'],
        },
        items: {
          allowed: [
            'id',
            'status',
            'companyId',
            'moduleId',
            'evaluatedBy',
            'evaluatedAt',
            'reason',
          ],
          default: ['id', 'status'],
        },
        'items.company': {
          allowed: ['id', 'uuid', 'cnpj', 'name'],
          default: ['id', 'name'],
        },
        'items.module': {
          allowed: ['id', 'name', 'slug', 'status'],
          default: ['id', 'name'],
        },
      },
    },
    // Include profundo exige o pai autorizado: sem `items` não existe
    // `items.company` no JSON para pendurar nada.
    includes: ['user', 'items', 'items.company', 'items.module'],
    // Só `user.firstName`, que atravessa uma relação `one`.
    //
    // A whitelist v2 tinha `items.company.name` e `items.company.cnpj`, e os
    // dois atravessam a coleção `items`. O bug de página curta que este
    // exemplo encontrou foi corrigido na `3.0.0` — alvo de `search` por
    // relação `many` compila como `EXISTS` —, mas `items.company.name` cruza
    // **duas** relações (`items` e depois `company`), e o adapter TypeORM
    // recusa cadeia existencial de mais de um salto com
    // `CAPABILITY_UNAVAILABLE`. Prisma e Drizzle compilam essa cadeia; é
    // divergência aberta, registrada em `docs/v3/status.md`.
    //
    // `items.company.cnpj` teria um segundo impedimento, independente e
    // instrutivo: `search` compara pela coluna dobrada, e `cnpj` não tem uma —
    // declará-lo derruba a **subida**, não a requisição, com
    // `Search field items.company.cnpj declares no folded field`. Buscar por
    // documento segue possível pelo caminho certo: `filter[cnpj][like]`.
    search: ['user.firstName'],
  },
);
