/**
 * Modelo canônico compartilhado pelas nove células ORM × banco.
 *
 * Cada adapter gera suas próprias entidades/tabelas a partir daqui, de modo
 * que divergência de metadata entre ORMs não possa mascarar divergência de
 * comportamento (spec §24, "Metadata divergente entre ORMs").
 */

export const CORPUS_MODEL = {
  user: {
    fields: {
      id: 'integer',
      name: 'string',
      name_folded: 'string',
      email: 'string',
      email_folded: 'string',
      document: 'string',
      zip: 'string',
      code: 'string',
      score: 'bigint',
      balance: 'decimal',
      active: 'boolean',
      born_on: 'date',
      created_at: 'datetime',
      nickname: 'string',
      company_id: 'integer',
    },
    primaryKey: ['id'],
    relations: { company: 'one', posts: 'many' },
  },
  company: {
    fields: {
      id: 'integer',
      name: 'string',
      name_folded: 'string',
      owner_id: 'integer',
    },
    primaryKey: ['id'],
    relations: { owner: 'one' },
  },
  post: {
    fields: {
      id: 'uuid',
      id_order: 'string',
      title: 'string',
      title_folded: 'string',
      user_id: 'integer',
    },
    primaryKey: ['id'],
    relations: { author: 'one', tags: 'many' },
  },
  tag: {
    fields: { post_id: 'uuid', label: 'string' },
    primaryKey: ['post_id', 'label'],
    relations: {},
  },
} as const;

export type CorpusModelName = keyof typeof CORPUS_MODEL;
