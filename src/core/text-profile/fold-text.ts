/**
 * Dobra textual do perfil `portable-strict` (spec §12).
 *
 * O mesmo helper produz o conteúdo das colunas `foldedField` na escrita e
 * transforma o termo recebido na leitura. Como a comparação passa a ser
 * literal sobre um valor já normalizado, o resultado não depende de `ILIKE`,
 * de `mode: 'insensitive'` nem da collation do servidor — o que permite a
 * mesma semântica no Prisma com MySQL e SQL Server.
 */
export function foldText(value: string): string {
  return value.normalize('NFC').toLowerCase();
}
