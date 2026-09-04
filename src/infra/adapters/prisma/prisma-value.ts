import { CivilDate, DecimalValue } from '@core/coercion';

/**
 * Valor lógico -> valor aceito pelo Prisma Client.
 *
 * `CivilDate` e `DecimalValue` são tipos do núcleo: o Prisma não os conhece.
 * `bigint` vira string porque o driver serializa `BigInt` de forma diferente
 * por provider, e o núcleo já normaliza a saída.
 */
export function toPrismaValue(value: unknown): unknown {
  if (value instanceof CivilDate) return value.iso;
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toPrismaValue);
  return value;
}

export function toPrismaValueArray(value: unknown): readonly unknown[] {
  return (value as readonly unknown[]).map(toPrismaValue);
}
