export {
  hasTotalPortableOrder,
  OPAQUE_KINDS,
  SCALAR_KINDS,
  TEXTUAL_KINDS,
  type ScalarKind,
} from './scalar-kind';
export type {
  FieldDescriptor,
  QuerySchema,
  QuerySchemaInput,
  RelationDescriptor,
  SchemaRegistry,
} from './descriptors';
export { defineQuerySchema } from './define-query-schema';
export {
  crossesMany,
  requireSchema,
  resolvePath,
  type ResolvedFieldPath,
  type ResolvePathOptions,
} from './schema-navigation';
