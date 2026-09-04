const FROZEN = new WeakSet<object>();

/**
 * Congelamento profundo do plano (spec §16).
 *
 * Depois de `transformPlan` o plano vira a fonte única para data e count. Se
 * um hook pudesse mutá-lo entre as duas execuções, as duas queries deixariam
 * de descrever a mesma pergunta.
 */
export function freezePlan<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (FROZEN.has(value as object)) return value;
  FROZEN.add(value as object);

  if (value instanceof Map) {
    for (const entry of value.values()) freezePlan(entry);
    return Object.freeze(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) freezePlan(entry);
    return Object.freeze(value) as T;
  }
  // Datas e valores lógicos já são imutáveis por construção.
  if (value instanceof Date || value instanceof Uint8Array) {
    return Object.freeze(value);
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    freezePlan(entry);
  }
  return Object.freeze(value);
}
