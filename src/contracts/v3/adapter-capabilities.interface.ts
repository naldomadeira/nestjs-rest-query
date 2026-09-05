export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'sqlite';

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
   */
  readonly escapeCharacter: string;
}
