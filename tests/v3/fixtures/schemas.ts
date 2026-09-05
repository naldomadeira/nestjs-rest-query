import { defineQuerySchema } from '@core/schema';
import type { QuerySchema, SchemaRegistry } from '@core/schema';

/**
 * Schemas lógicos do modelo canônico do corpus.
 *
 * Servem de entrada para todo o núcleo nos testes: o resolver do TypeORM
 * (Task 18) precisa produzir exatamente estes descritores a partir da metadata
 * do repositório, o que torna qualquer divergência de metadata visível.
 */

const userSchema: QuerySchema = defineQuerySchema({
  model: 'user',
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
    {
      path: 'email',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      foldedField: 'email_folded',
    },
    {
      path: 'email_folded',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'document', kind: 'string', nullable: false, primaryKey: false },
    { path: 'zip', kind: 'string', nullable: false, primaryKey: false },
    { path: 'code', kind: 'string', nullable: false, primaryKey: false },
    { path: 'score', kind: 'bigint', nullable: false, primaryKey: false },
    { path: 'balance', kind: 'decimal', nullable: false, primaryKey: false },
    { path: 'active', kind: 'boolean', nullable: false, primaryKey: false },
    { path: 'born_on', kind: 'date', nullable: false, primaryKey: false },
    {
      path: 'created_at',
      kind: 'datetime',
      nullable: false,
      primaryKey: false,
    },
    { path: 'nickname', kind: 'string', nullable: true, primaryKey: false },
    {
      path: 'company_id',
      kind: 'integer',
      nullable: true,
      primaryKey: false,
    },
  ],
  relations: [
    { path: 'company', target: 'company', cardinality: 'one', nullable: true },
    { path: 'posts', target: 'post', cardinality: 'many', nullable: true },
  ],
});

const companySchema: QuerySchema = defineQuerySchema({
  model: 'company',
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
    { path: 'owner_id', kind: 'integer', nullable: true, primaryKey: false },
  ],
  relations: [
    { path: 'owner', target: 'user', cardinality: 'one', nullable: true },
  ],
});

const postFields = (portableOrder: boolean) => [
  {
    path: 'id',
    kind: 'uuid' as const,
    nullable: false,
    primaryKey: true,
    ...(portableOrder ? { portableOrderField: 'id_order' } : {}),
  },
  {
    path: 'id_order',
    kind: 'string' as const,
    nullable: false,
    primaryKey: false,
    internal: true,
  },
  {
    path: 'title',
    kind: 'string' as const,
    nullable: false,
    primaryKey: false,
    foldedField: 'title_folded',
  },
  {
    path: 'title_folded',
    kind: 'string' as const,
    nullable: false,
    primaryKey: false,
    internal: true,
  },
  {
    path: 'user_id',
    kind: 'integer' as const,
    nullable: false,
    primaryKey: false,
  },
];

const postRelations = [
  {
    path: 'author',
    target: 'user',
    cardinality: 'one' as const,
    nullable: false,
  },
  {
    path: 'tags',
    target: 'tag',
    cardinality: 'many' as const,
    nullable: true,
  },
];

const postSchema: QuerySchema = defineQuerySchema({
  model: 'post',
  primaryKey: ['id'],
  fields: postFields(true),
  relations: postRelations,
});

/** Variante sem ordem portável: exercita o fail-closed do spec §11. */
const postSchemaWithoutPortableOrder: QuerySchema = defineQuerySchema({
  model: 'post',
  primaryKey: ['id'],
  fields: postFields(false),
  relations: postRelations,
});

const tagSchema: QuerySchema = defineQuerySchema({
  model: 'tag',
  primaryKey: ['post_id', 'label'],
  fields: [
    {
      path: 'post_id',
      kind: 'uuid',
      nullable: false,
      primaryKey: true,
      portableOrderField: 'post_id_order',
    },
    {
      path: 'post_id_order',
      kind: 'string',
      nullable: false,
      primaryKey: false,
      internal: true,
    },
    { path: 'label', kind: 'string', nullable: false, primaryKey: true },
  ],
  relations: [],
});

export const CORPUS_SCHEMAS: SchemaRegistry = new Map([
  ['user', userSchema],
  ['company', companySchema],
  ['post', postSchema],
  ['tag', tagSchema],
]);

/** Mesmo registry, mas com `post.id` sem `portableOrderField`. */
export const CORPUS_SCHEMAS_NO_PORTABLE_ORDER: SchemaRegistry = new Map([
  ['user', userSchema],
  ['company', companySchema],
  ['post', postSchemaWithoutPortableOrder],
  ['tag', tagSchema],
]);

export { userSchema, companySchema, postSchema, tagSchema };
