import type { SqlDialect } from '@contracts/v3';
import { CivilDate, DecimalValue } from '@core/coercion';

/**
 * Valor lógico -> valor de bind do driver (spec §10).
 *
 * O núcleo trabalha com `CivilDate`, `DecimalValue` e `Date` justamente para
 * não depender de como cada driver serializa; a conversão acontece aqui, na
 * fronteira. Duas conversões dependem do dialeto e é por isso que ele entra:
 * SQLite e SQL Server não têm booleano nativo, e um `false` cru quebra o bind.
 */
export function toDriverValue(value: unknown, dialect: SqlDialect): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return encodeBoolean(value, dialect);
  if (Array.isArray(value)) {
    return value.map((item) => toDriverValue(item, dialect));
  }
  return value;
}

function encodeBoolean(value: boolean, dialect: SqlDialect): boolean | number {
  if (dialect === 'sqlite' || dialect === 'mssql') return value ? 1 : 0;
  return value;
}
