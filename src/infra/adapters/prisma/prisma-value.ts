import { CivilDate, DecimalValue } from '@core/coercion';

/**
 * Valor lógico -> valor aceito pelo Prisma Client.
 *
 * `CivilDate` e `DecimalValue` são tipos do núcleo: o Prisma não os conhece.
 * `bigint` vira string porque o driver serializa `BigInt` de forma diferente
 * por provider, e o núcleo já normaliza a saída.
 */
export function toPrismaValue(value: unknown): unknown {
  // O client gerado só aceita `Date` num campo `DateTime`, e recusa a string
  // ISO com um erro de validação. A data civil vira meia-noite UTC: sem fuso,
  // que é a definição do tipo (spec §10.1).
  if (value instanceof CivilDate) {
    return new Date(`${value.iso}T00:00:00.000Z`);
  }
  if (value instanceof DecimalValue) return value.value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toPrismaValue);
  return value;
}

export function toPrismaValueArray(value: unknown): readonly unknown[] {
  return (value as readonly unknown[]).map(toPrismaValue);
}
