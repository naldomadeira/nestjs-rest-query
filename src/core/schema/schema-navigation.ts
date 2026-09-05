import { configurationError, inputError } from '../errors';
import type {
  FieldDescriptor,
  QuerySchema,
  RelationDescriptor,
  SchemaRegistry,
} from './descriptors';

export interface ResolvedFieldPath {
  readonly relationChain: readonly RelationDescriptor[];
  /** `null` quando o path termina numa relação (`allowRelationLeaf`). */
  readonly field: FieldDescriptor | null;
  /** Preenchido apenas quando o path termina numa relação. */
  readonly relation?: RelationDescriptor;
  /** Model dono da folha. */
  readonly ownerModel: string;
}

export interface ResolvePathOptions {
  /**
   * Permite que o path termine numa relação, como em `filter[company][isNull]`
   * (spec §11.1). Fora desse caso, uma relação terminal é `FIELD_NOT_FOUND`.
   */
  readonly allowRelationLeaf?: boolean;
}

export function resolvePath(
  registry: SchemaRegistry,
  rootModel: string,
  path: string,
  options: ResolvePathOptions = {}
): ResolvedFieldPath {
  const segments = path.split('.');
  const chain: RelationDescriptor[] = [];
  let model = rootModel;

  for (let index = 0; index < segments.length - 1; index++) {
    const schema = requireSchema(registry, model);
    const relation = schema.relations.get(segments[index]);
    if (!relation) {
      throw inputError(
        'RELATION_NOT_FOUND',
        `Relation not found: ${segments[index]}`,
        { path, segment: segments[index] }
      );
    }
    chain.push(relation);
    model = relation.target;
  }

  const leafSchema = requireSchema(registry, model);
  const leaf = segments[segments.length - 1];
  const field = leafSchema.fields.get(leaf);

  if (field && !field.internal) {
    return { relationChain: chain, field, ownerModel: model };
  }

  const relation = leafSchema.relations.get(leaf);
  if (relation && options.allowRelationLeaf) {
    return {
      relationChain: [...chain, relation],
      field: null,
      relation,
      ownerModel: relation.target,
    };
  }

  throw inputError('FIELD_NOT_FOUND', `Field not found: ${leaf}`, { path });
}

export function crossesMany(chain: readonly RelationDescriptor[]): boolean {
  return chain.some((relation) => relation.cardinality === 'many');
}

export function requireSchema(
  registry: SchemaRegistry,
  model: string
): QuerySchema {
  const schema = registry.get(model);
  if (!schema) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Schema registry has no entry for model ${model}`,
      { model }
    );
  }
  return schema;
}
