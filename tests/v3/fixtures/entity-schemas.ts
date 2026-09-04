import { EntitySchema, type ObjectLiteral } from 'typeorm';
import type { EntitySchemaColumnOptions } from 'typeorm/entity-schema/EntitySchemaColumnOptions';
import type { ColumnType } from 'typeorm/driver/types/ColumnTypes';

/**
 * Entidades TypeORM geradas a partir do modelo canônico do corpus.
 *
 * Uma única definição por dialeto, derivada do mesmo modelo, é o que impede
 * que divergência de fixture mascare divergência de comportamento entre as
 * células da matriz (spec §24). Só os tipos físicos variam.
 */
export type TestDialect = 'sqlite' | 'postgres' | 'mysql' | 'mssql';

type LogicalType =
  | 'string'
  | 'uuid'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime';

interface PhysicalType {
  type: ColumnType;
  length?: number;
  precision?: number;
  scale?: number;
}

const PHYSICAL: Record<TestDialect, Record<LogicalType, PhysicalType>> = {
  sqlite: {
    string: { type: 'varchar' },
    uuid: { type: 'varchar' },
    integer: { type: 'integer' },
    bigint: { type: 'bigint' },
    decimal: { type: 'decimal', precision: 38, scale: 6 },
    boolean: { type: 'boolean' },
    date: { type: 'date' },
    datetime: { type: 'datetime' },
  },
  postgres: {
    string: { type: 'text' },
    uuid: { type: 'uuid' },
    integer: { type: 'integer' },
    bigint: { type: 'bigint' },
    decimal: { type: 'numeric', precision: 38, scale: 6 },
    boolean: { type: 'boolean' },
    date: { type: 'date' },
    datetime: { type: 'timestamptz' },
  },
  mysql: {
    string: { type: 'varchar', length: 255 },
    uuid: { type: 'char', length: 36 },
    integer: { type: 'int' },
    bigint: { type: 'bigint' },
    decimal: { type: 'decimal', precision: 38, scale: 6 },
    boolean: { type: 'boolean' },
    date: { type: 'date' },
    datetime: { type: 'datetime', precision: 6 },
  },
  mssql: {
    string: { type: 'varchar', length: 255 },
    uuid: { type: 'uniqueidentifier' },
    integer: { type: 'int' },
    bigint: { type: 'bigint' },
    decimal: { type: 'decimal', precision: 38, scale: 6 },
    boolean: { type: 'bit' },
    date: { type: 'date' },
    datetime: { type: 'datetime2', precision: 6 },
  },
};

interface FieldSpec {
  logical: LogicalType;
  primary?: boolean;
  nullable?: boolean;
}

const column = (
  dialect: TestDialect,
  spec: FieldSpec
): EntitySchemaColumnOptions => ({
  ...PHYSICAL[dialect][spec.logical],
  primary: spec.primary ?? false,
  nullable: spec.nullable ?? false,
});

export type CorpusEntitySchema = EntitySchema<ObjectLiteral>;

export interface CorpusEntities {
  user: CorpusEntitySchema;
  company: CorpusEntitySchema;
  post: CorpusEntitySchema;
  tag: CorpusEntitySchema;
  all: CorpusEntitySchema[];
}

export function buildCorpusEntities(dialect: TestDialect): CorpusEntities {
  const c = (spec: FieldSpec) => column(dialect, spec);

  const company = new EntitySchema<ObjectLiteral>({
    name: 'company',
    tableName: 'companies',
    columns: {
      id: c({ logical: 'integer', primary: true }),
      name: c({ logical: 'string' }),
      name_folded: c({ logical: 'string' }),
      owner_id: c({ logical: 'integer', nullable: true }),
    },
    relations: {
      owner: {
        type: 'many-to-one',
        target: 'user',
        nullable: true,
        joinColumn: { name: 'owner_id' },
      },
    },
  });

  const user = new EntitySchema<ObjectLiteral>({
    name: 'user',
    tableName: 'users',
    columns: {
      id: c({ logical: 'integer', primary: true }),
      name: c({ logical: 'string' }),
      name_folded: c({ logical: 'string' }),
      email: c({ logical: 'string' }),
      email_folded: c({ logical: 'string' }),
      document: c({ logical: 'string' }),
      zip: c({ logical: 'string' }),
      code: c({ logical: 'string' }),
      score: c({ logical: 'bigint' }),
      balance: c({ logical: 'decimal' }),
      active: c({ logical: 'boolean' }),
      born_on: c({ logical: 'date' }),
      created_at: c({ logical: 'datetime' }),
      nickname: c({ logical: 'string', nullable: true }),
      company_id: c({ logical: 'integer', nullable: true }),
    },
    relations: {
      company: {
        type: 'many-to-one',
        target: 'company',
        nullable: true,
        joinColumn: { name: 'company_id' },
      },
      posts: { type: 'one-to-many', target: 'post', inverseSide: 'author' },
    },
  });

  const post = new EntitySchema<ObjectLiteral>({
    name: 'post',
    tableName: 'posts',
    columns: {
      id: c({ logical: 'uuid', primary: true }),
      id_order: c({ logical: 'string' }),
      title: c({ logical: 'string' }),
      title_folded: c({ logical: 'string' }),
      user_id: c({ logical: 'integer' }),
    },
    relations: {
      author: {
        type: 'many-to-one',
        target: 'user',
        inverseSide: 'posts',
        joinColumn: { name: 'user_id' },
      },
      tags: { type: 'one-to-many', target: 'tag', inverseSide: 'post' },
    },
  });

  const tag = new EntitySchema<ObjectLiteral>({
    name: 'tag',
    tableName: 'tags',
    columns: {
      post_id: c({ logical: 'uuid', primary: true }),
      post_id_order: c({ logical: 'string' }),
      label: c({ logical: 'string', primary: true }),
    },
    relations: {
      post: {
        type: 'many-to-one',
        target: 'post',
        inverseSide: 'tags',
        joinColumn: { name: 'post_id' },
      },
    },
  });

  return { user, company, post, tag, all: [user, company, post, tag] };
}
