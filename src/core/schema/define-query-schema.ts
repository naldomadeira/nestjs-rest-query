import { configurationError } from '../errors';
import type {
  FieldDescriptor,
  QuerySchema,
  QuerySchemaInput,
} from './descriptors';

const invalid = (message: string, details?: Record<string, unknown>): never => {
  throw configurationError('SOURCE_CONFIGURATION_INVALID', message, details);
};

/**
 * Constrói e valida um schema lógico.
 *
 * Toda validação aqui é de *configuração*: falha na inicialização, não durante
 * uma requisição. Um schema que passa por esta função é garantia de que o
 * validador semântico não precisa checar coerência estrutural depois.
 */
export function defineQuerySchema(input: QuerySchemaInput): QuerySchema {
  const fields = new Map<string, FieldDescriptor>();

  for (const field of input.fields) {
    if (fields.has(field.path)) {
      invalid(`Duplicate field path in schema ${input.model}: ${field.path}`, {
        model: input.model,
        path: field.path,
      });
    }
    if (field.kind === 'enum' && !field.enumValues?.length) {
      invalid(`Field ${field.path} of kind enum requires enumValues`, {
        model: input.model,
        path: field.path,
      });
    }
    fields.set(field.path, Object.freeze({ ...field }));
  }

  const relations = new Map(
    input.relations.map((relation) => {
      if (fields.has(relation.path)) {
        invalid(
          `Relation ${relation.path} collides with a field of the same name in ${input.model}`,
          { model: input.model, path: relation.path }
        );
      }
      return [relation.path, Object.freeze({ ...relation })] as const;
    })
  );

  if (input.primaryKey.length === 0) {
    invalid(`Schema ${input.model} declares no primary key`, {
      model: input.model,
    });
  }

  for (const part of input.primaryKey) {
    const field = fields.get(part);
    if (!field) {
      invalid(`Primary key part ${part} is not a field of ${input.model}`, {
        model: input.model,
        path: part,
      });
      continue;
    }
    if (field.nullable) {
      invalid(`Primary key part ${part} of ${input.model} is nullable`, {
        model: input.model,
        path: part,
      });
    }
  }

  for (const field of fields.values()) {
    assertInternalCompanion(input.model, fields, field.foldedField, 'folded');
    assertInternalCompanion(
      input.model,
      fields,
      field.portableOrderField,
      'portable order'
    );
  }

  return Object.freeze({
    model: input.model,
    fields,
    relations,
    primaryKey: Object.freeze([...input.primaryKey]),
  });
}

function assertInternalCompanion(
  model: string,
  fields: ReadonlyMap<string, FieldDescriptor>,
  companionPath: string | undefined,
  label: string
): void {
  if (!companionPath) return;

  const companion = fields.get(companionPath);
  if (!companion) {
    invalid(`Missing ${label} field ${companionPath} in schema ${model}`, {
      model,
      path: companionPath,
    });
    return;
  }
  if (!companion.internal) {
    invalid(
      `The ${label} field ${companionPath} of ${model} must be declared internal`,
      { model, path: companionPath }
    );
  }
}
