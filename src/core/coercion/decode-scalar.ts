import { inputError } from '../errors';
import type { FieldDescriptor } from '../schema';
import { CivilDate, DecimalValue, type LogicalValue } from './logical-values';

/**
 * Coerção dirigida pelo tipo do campo (spec §10.1).
 *
 * O tipo vem sempre do `FieldDescriptor`, nunca da aparência do texto: é isso
 * que impede `"00430123"` de virar `430123` e `"10abc"` de virar `10`.
 */

const INTEGER_RE = /^-?(0|[1-9]\d*)$/;
const DECIMAL_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BOOLEAN_LITERALS: Readonly<Record<string, boolean>> = {
  true: true,
  false: false,
  '1': true,
  '0': false,
};

function reject(field: FieldDescriptor, reason: string): never {
  throw inputError(
    'FILTER_VALUE_INVALID',
    `Invalid value for field ${field.path}: ${reason}`,
    { path: field.path, expected: field.kind }
  );
}

function requireString(field: FieldDescriptor, raw: unknown): string {
  if (typeof raw !== 'string') {
    reject(field, `expected a ${field.kind} literal`);
  }
  return raw;
}

export function decodeScalar(
  field: FieldDescriptor,
  raw: unknown
): LogicalValue {
  if (raw === null || raw === undefined) {
    reject(field, 'null is only queryable through isNull');
  }
  if (Array.isArray(raw)) {
    reject(field, 'expected a single value');
  }

  switch (field.kind) {
    case 'string':
      // Sem trim: espaço faz parte do valor (spec §10.1).
      return requireString(field, raw);

    case 'uuid': {
      const value = requireString(field, raw);
      if (!UUID_RE.test(value)) reject(field, 'expected a UUID');
      return value;
    }

    case 'enum': {
      const value = requireString(field, raw);
      if (!field.enumValues?.includes(value)) {
        reject(field, 'value is not a member of the enum');
      }
      return value;
    }

    case 'integer': {
      const value = requireString(field, raw);
      if (!INTEGER_RE.test(value)) reject(field, 'expected a decimal integer');
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) {
        reject(field, 'integer is outside the safe range');
      }
      return parsed;
    }

    case 'bigint': {
      const value = requireString(field, raw);
      if (!INTEGER_RE.test(value)) reject(field, 'expected a decimal integer');
      return BigInt(value);
    }

    case 'decimal': {
      const value = requireString(field, raw);
      if (!DECIMAL_RE.test(value)) {
        reject(field, 'expected a canonical finite decimal');
      }
      return new DecimalValue(value);
    }

    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const value = requireString(field, raw);
      if (!Object.prototype.hasOwnProperty.call(BOOLEAN_LITERALS, value)) {
        reject(field, 'expected true, false, 1 or 0');
      }
      return BOOLEAN_LITERALS[value];
    }

    case 'date': {
      const value = requireString(field, raw);
      const match = DATE_RE.exec(value);
      if (!match) reject(field, 'expected YYYY-MM-DD');
      const [, year, month, day] = match;
      const utc = Date.UTC(Number(year), Number(month) - 1, Number(day));
      const roundTrip = new Date(utc);
      if (
        roundTrip.getUTCFullYear() !== Number(year) ||
        roundTrip.getUTCMonth() !== Number(month) - 1 ||
        roundTrip.getUTCDate() !== Number(day)
      ) {
        reject(field, 'not a real calendar date');
      }
      return new CivilDate(value);
    }

    case 'datetime': {
      const value = requireString(field, raw);
      if (!DATETIME_RE.test(value)) {
        reject(field, 'expected ISO 8601 with an offset or Z');
      }
      const instant = new Date(value);
      if (Number.isNaN(instant.getTime())) {
        reject(field, 'not a real instant');
      }
      return instant;
    }

    case 'json':
    case 'binary':
      throw inputError(
        'OPERATOR_TYPE_MISMATCH',
        `Field ${field.path} of kind ${field.kind} has no inferred operators`,
        { path: field.path, expected: field.kind }
      );
  }
}
