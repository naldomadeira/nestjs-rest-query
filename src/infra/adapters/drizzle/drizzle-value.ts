import { CivilDate, DecimalValue } from '@core/coercion';

/**
 * Valor lógico -> valor de bind do driver.
 *
 * O núcleo trabalha com `CivilDate` e `DecimalValue` justamente para não
 * depender de como cada driver serializa data e decimal; a conversão para o
 * formato do bind acontece aqui, na fronteira.
 */
export function toDriverValue(value: unknown): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toDriverValue);
  return value;
}
