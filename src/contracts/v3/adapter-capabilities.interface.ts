export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'sqlite';

/**
 * Como o adapter torna `%` e `_` literais nos operadores de padrão (spec §11).
 *
 * Não é detalhe de implementação: é o que decide se `filter[name][like]=100%`
 * procura o texto "100%" ou usa `%` como coringa. Declarar isso separado do
 * caractere de escape existe porque um caractere sozinho não distingue "emito
 * a cláusula" de "confio no default do banco" — e foi essa indistinção que
 * deixou o adapter Prisma declarar `escapeCharacter: '!'` sem nunca emitir
 * `ESCAPE`, entregando coringa onde a §11 promete literal.
 */
export type PatternEscapeMode =
  /** Emite `ESCAPE '<escapeCharacter>'` explicitamente. Vale em todo dialeto. */
  | 'clause'
  /**
   * Confia no caractere de escape default do dialeto, sem cláusula. Só é
   * correto em Postgres e MySQL, onde o default é `\`; SQLite e SQL Server não
   * têm default algum.
   */
  | 'native'
  /**
   * O dialeto não tem escape default e o adapter não consegue emitir a
   * cláusula. Os operadores de padrão são recusados com
   * `CAPABILITY_UNAVAILABLE` — recusa explícita em vez de resultado errado
   * silencioso, conforme §5.6.
   */
  | 'unsupported';

export interface AdapterCapabilities {
  readonly dialect: SqlDialect;
  /**
   * `true` quando o adapter consegue rodar data e count sob o mesmo snapshot.
   * `consistency: 'transactional'` falha cedo se isso for `false` (spec §14).
   */
  readonly transactionalConsistency: boolean;
  /**
   * Caractere usado para escapar `%`, `_` e ele mesmo nos padrões literais.
   * A escolha é do adapter porque a cláusula ESCAPE varia por dialeto.
   *
   * Vazio quando `patternEscape` é `'unsupported'`: não há escape possível, e
   * anunciar um caractere ali seria descrever um comportamento que não existe.
   */
  readonly escapeCharacter: string;
  readonly patternEscape: PatternEscapeMode;
}
