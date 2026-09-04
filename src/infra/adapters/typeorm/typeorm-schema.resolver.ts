import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { EntityMetadata, ObjectLiteral, Repository } from 'typeorm';
import { configurationError } from '@core/errors';
import {
  defineQuerySchema,
  type FieldDescriptor,
  type QuerySchema,
  type RelationDescriptor,
  type ScalarKind,
  type SchemaRegistry,
} from '@core/schema';

/**
 * Mapa de tipos físicos -> `ScalarKind`, cobrindo os nomes usados por
 * PostgreSQL, MySQL, SQL Server e SQLite.
 *
 * Um tipo fora deste mapa é erro de configuração, nunca `string`: tratar um
 * tipo desconhecido como texto foi exatamente o que produziu a coerção errada
 * da v2 (spec §9).
 */
const TYPE_MAP: Readonly<Record<string, ScalarKind>> = {
  // texto
  varchar: 'string',
  'character varying': 'string',
  nvarchar: 'string',
  char: 'string',
  nchar: 'string',
  text: 'string',
  ntext: 'string',
  tinytext: 'string',
  mediumtext: 'string',
  longtext: 'string',
  citext: 'string',
  // identificadores
  uuid: 'uuid',
  uniqueidentifier: 'uuid',
  // inteiros
  int: 'integer',
  int2: 'integer',
  int4: 'integer',
  integer: 'integer',
  smallint: 'integer',
  tinyint: 'integer',
  mediumint: 'integer',
  // inteiros largos
  bigint: 'bigint',
  int8: 'bigint',
  // decimais de precisão declarada
  decimal: 'decimal',
  numeric: 'decimal',
  money: 'decimal',
  smallmoney: 'decimal',
  // booleanos
  boolean: 'boolean',
  bool: 'boolean',
  bit: 'boolean',
  // datas civis
  date: 'date',
  // instantes
  datetime: 'datetime',
  datetime2: 'datetime',
  datetimeoffset: 'datetime',
  timestamp: 'datetime',
  timestamptz: 'datetime',
  'timestamp with time zone': 'datetime',
  'timestamp without time zone': 'datetime',
  // opacos
  json: 'json',
  jsonb: 'json',
  simple_json: 'json',
  bytea: 'binary',
  blob: 'binary',
  varbinary: 'binary',
  binary: 'binary',
  enum: 'enum',
};

/** Sufixos convencionais das colunas internas do perfil portável. */
const FOLDED_SUFFIX = '_folded';
const PORTABLE_ORDER_SUFFIX = '_order';

/**
 * Deriva o registry de schemas lógicos a partir da metadata do repositório,
 * percorrendo transitivamente as relações (spec §9.1).
 */
export function buildSchemaRegistry<T extends ObjectLiteral>(
  repository: Repository<T>
): SchemaRegistry {
  const registry = new Map<string, QuerySchema>();
  const pending: EntityMetadata[] = [repository.metadata];

  while (pending.length > 0) {
    const metadata = pending.shift()!;
    const model = modelName(metadata);
    if (registry.has(model)) continue;

    registry.set(model, describeEntity(metadata));

    for (const relation of metadata.relations) {
      pending.push(relation.inverseEntityMetadata);
    }
  }

  return registry;
}

/** Nome lógico do model: a entidade no singular, derivada da classe. */
export function modelName(metadata: EntityMetadata): string {
  return metadata.name.replace(/Entity$/, '').toLowerCase();
}

function describeEntity(metadata: EntityMetadata): QuerySchema {
  const columnNames = new Set(
    metadata.columns.map((column) => propertyPath(column))
  );

  const fields: FieldDescriptor[] = metadata.columns.map((column) => {
    const path = propertyPath(column);
    const internal =
      path.endsWith(FOLDED_SUFFIX) || path.endsWith(PORTABLE_ORDER_SUFFIX);

    const folded = `${path}${FOLDED_SUFFIX}`;
    const order = `${path}${PORTABLE_ORDER_SUFFIX}`;
    const kind = resolveKind(metadata, column);

    return {
      path,
      kind,
      nullable: column.isNullable,
      primaryKey: column.isPrimary,
      internal: internal || undefined,
      enumValues: kind === 'enum' ? (column.enum as string[]) : undefined,
      foldedField: !internal && columnNames.has(folded) ? folded : undefined,
      portableOrderField:
        !internal && columnNames.has(order) ? order : undefined,
    };
  });

  const relations: RelationDescriptor[] = metadata.relations.map(
    (relation) => ({
      path: relation.propertyName,
      target: modelName(relation.inverseEntityMetadata),
      cardinality:
        relation.isOneToMany || relation.isManyToMany ? 'many' : 'one',
      nullable: relation.isNullable || relation.isOneToMany,
    })
  );

  return defineQuerySchema({
    model: modelName(metadata),
    primaryKey: metadata.primaryColumns.map((column) => propertyPath(column)),
    fields,
    relations,
  });
}

/** Embedded columns entram com o path pontuado (`address.city`). */
function propertyPath(column: ColumnMetadata): string {
  return column.propertyPath;
}

function resolveKind(
  metadata: EntityMetadata,
  column: ColumnMetadata
): ScalarKind {
  const raw =
    typeof column.type === 'string'
      ? column.type.toLowerCase()
      : normalizeConstructorType(column.type);

  const kind = TYPE_MAP[raw];
  if (!kind) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Unmapped column type "${raw}" on ${metadata.name}.${column.propertyPath}; map it before querying this field`,
      { model: modelName(metadata), path: column.propertyPath, type: raw }
    );
  }
  return kind;
}

/** TypeORM aceita construtores (`Number`, `String`, `Date`, `Boolean`). */
function normalizeConstructorType(type: unknown): string {
  const name = (type as { name?: string })?.name?.toLowerCase();
  switch (name) {
    case 'number':
      return 'integer';
    case 'string':
      return 'varchar';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'datetime';
    default:
      return String(name ?? type);
  }
}
