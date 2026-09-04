import type { FieldDescriptor } from '../schema';
import { CivilDate, DecimalValue, type JsonScalar } from './logical-values';

/**
 * Serialização JSON canônica (coluna "JSON de saída" do spec §10.1).
 *
 * Cada driver devolve um tipo diferente para a mesma coluna — `bigint` como
 * string no Postgres e como number no MySQL, `decimal` como string ou number,
 * `date` como Date ou string. Esta função é o ponto único que apaga essa
 * diferença antes do JSON chegar ao consumidor.
 */
export function encodeScalar(
  field: FieldDescriptor,
  value: unknown
): JsonScalar {
  if (value === null || value === undefined) return null;

  switch (field.kind) {
    case 'bigint':
      return typeof value === 'bigint' ? value.toString() : String(value);

    case 'decimal':
      return value instanceof DecimalValue ? value.value : String(value);

    case 'date': {
      if (value instanceof CivilDate) return value.iso;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    }

    case 'datetime': {
      if (value instanceof Date) return value.toISOString();
      return new Date(String(value)).toISOString();
    }

    case 'binary': {
      if (value instanceof Uint8Array) {
        return Buffer.from(value).toString('base64');
      }
      return String(value);
    }

    case 'boolean':
      return typeof value === 'boolean' ? value : Boolean(value);

    case 'integer':
      return typeof value === 'number' ? value : Number(value);

    case 'json':
      return value as JsonScalar;

    case 'string':
    case 'uuid':
    case 'enum':
      return String(value);
  }
}
