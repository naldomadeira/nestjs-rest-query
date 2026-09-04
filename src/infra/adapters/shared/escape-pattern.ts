/**
 * Escapa `%`, `_` e o próprio caractere de escape (spec §11).
 *
 * Na API v3 esses três caracteres são literais: `filter[name][like]=100%`
 * procura o texto "100%", não um prefixo. Quem escolhe o caractere de escape é
 * o adapter, porque a cláusula ESCAPE varia por dialeto.
 */
export function escapeLiteralPattern(
  value: string,
  escapeCharacter: string
): string {
  let escaped = '';
  for (const char of value) {
    if (char === escapeCharacter || char === '%' || char === '_') {
      escaped += escapeCharacter;
    }
    escaped += char;
  }
  return escaped;
}

/** Padrão "contém" a partir de um valor literal. */
export function containsPattern(
  value: string,
  escapeCharacter: string
): string {
  return `%${escapeLiteralPattern(value, escapeCharacter)}%`;
}
