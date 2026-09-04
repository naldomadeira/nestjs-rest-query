import {
  createDrizzleTable,
  type DrizzleRelationMap,
  type DrizzleTable,
} from '@infra/adapters/drizzle';

/**
 * Tabelas Drizzle equivalentes ao modelo canônico do corpus.
 *
 * Os descritores derivados daqui precisam bater exatamente com
 * `CORPUS_SCHEMAS`: é o que `QueryBuilderService` compara antes de executar,
 * e é o que impede o adapter de "passar" com metadata mais frouxa.
 */

export const usersTable: DrizzleTable = createDrizzleTable({
  name: 'users',
  model: 'user',
  columns: {
    id: { name: 'id', kind: 'integer', nullable: false, primaryKey: true },
    name: {
      name: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    name_folded: {
      name: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    email: {
      name: 'email',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'email_folded',
    },
    email_folded: {
      name: 'email_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    document: {
      name: 'document',
      kind: 'string',
      nullable: false,
      primaryKey: false,
    },
    zip: { name: 'zip', kind: 'string', nullable: false, primaryKey: false },
    code: { name: 'code', kind: 'string', nullable: false, primaryKey: false },
    score: {
      name: 'score',
      kind: 'bigint',
      nullable: false,
      primaryKey: false,
    },
    balance: {
      name: 'balance',
      kind: 'decimal',
      nullable: false,
      primaryKey: false,
    },
    active: {
      name: 'active',
      kind: 'boolean',
      nullable: false,
      primaryKey: false,
    },
    born_on: {
      name: 'born_on',
      kind: 'date',
      nullable: false,
      primaryKey: false,
    },
    created_at: {
      name: 'created_at',
      kind: 'datetime',
      nullable: false,
      primaryKey: false,
    },
    nickname: {
      name: 'nickname',
      kind: 'string',
      nullable: true,
      primaryKey: false,
    },
    company_id: {
      name: 'company_id',
      kind: 'integer',
      nullable: true,
      primaryKey: false,
    },
  },
});

export const companiesTable: DrizzleTable = createDrizzleTable({
  name: 'companies',
  model: 'company',
  columns: {
    id: { name: 'id', kind: 'integer', nullable: false, primaryKey: true },
    name: {
      name: 'name',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'name_folded',
    },
    name_folded: {
      name: 'name_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    owner_id: {
      name: 'owner_id',
      kind: 'integer',
      nullable: true,
      primaryKey: false,
    },
  },
});

export const postsTable: DrizzleTable = createDrizzleTable({
  name: 'posts',
  model: 'post',
  columns: {
    id: {
      name: 'id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      portableOrderField: 'id_order',
    },
    id_order: {
      name: 'id_order',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    title: {
      name: 'title',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'title_folded',
    },
    title_folded: {
      name: 'title_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    user_id: {
      name: 'user_id',
      kind: 'integer',
      nullable: false,
      primaryKey: false,
    },
  },
});

/** Cadeia completa a partir de `user`, incluindo o salto profundo. */
export const userRelations: DrizzleRelationMap = {
  company: {
    target: companiesTable,
    cardinality: 'one',
    nullable: true,
    sourceColumn: 'company_id',
    targetColumn: 'id',
  },
  'company.owner': {
    target: usersTable,
    cardinality: 'one',
    nullable: true,
    sourceColumn: 'owner_id',
    targetColumn: 'id',
  },
  posts: {
    target: postsTable,
    cardinality: 'many',
    nullable: true,
    sourceColumn: 'id',
    targetColumn: 'user_id',
  },
};
