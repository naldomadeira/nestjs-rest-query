/**
 * Tipos do corpus canônico de paridade (spec §18.2 e §18.3).
 *
 * O corpus é *dado*, não código: as mesmas entradas e as mesmas expectativas
 * são consumidas pelos contract tests (sem banco) e pela matriz de integração
 * real. Paridade vira comparação, não reimplementação por adapter.
 */

export const REST_QUERY_ERROR_CODES = [
  'QUERY_SYNTAX_INVALID',
  'QUERY_SYNTAX_UNKNOWN_PARAM',
  'FIELD_NOT_ALLOWED',
  'FIELD_NOT_FOUND',
  'RELATION_NOT_FOUND',
  'OPERATOR_NOT_ALLOWED',
  'OPERATOR_TYPE_MISMATCH',
  'FILTER_VALUE_INVALID',
  'PAGINATION_INVALID',
  'SORT_CONFLICT',
  'CAPABILITY_UNAVAILABLE',
  'PORTABILITY_PROFILE_MISMATCH',
  'SOURCE_CONFIGURATION_INVALID',
  'ADAPTER_CONTRACT_VIOLATION',
] as const;

export type RestQueryErrorCodeName = (typeof REST_QUERY_ERROR_CODES)[number];

export type CorpusExpectation =
  | {
      kind: 'rows';
      /**
       * IDs de root na ordem exata esperada. Omitido quando a projeção esconde
       * a chave primária — aí os IDs deixam de ser observáveis pelo cliente.
       */
      ids?: readonly (string | number)[];
      total?: number;
      lastPage?: number;
      /** Shape JSON exato da primeira linha, quando o caso testa projeção. */
      firstRow?: Record<string, unknown>;
    }
  | { kind: 'error'; status: number; code: RestQueryErrorCodeName };

export type CorpusAdapterId = 'typeorm' | 'prisma' | 'drizzle';

/**
 * Divergência intencional de um adapter num caso do corpus (spec §5 e §24).
 *
 * Existe porque um ORM pode não *conseguir* expressar a semântica canônica.
 * Fica aqui, junto do caso, e não num skip: o resultado divergente é
 * comparado com o mesmo rigor do canônico, então um adapter que volte a
 * concordar quebra o teste e obriga a remover a divergência. `reason` é
 * obrigatório — declarar uma sem justificar é impossível.
 */
export interface CorpusDivergence {
  readonly reason: string;
  readonly expect: CorpusExpectation;
  /**
   * Dialetos em que a divergência vale. Omitido significa todos.
   *
   * Existe porque a capacidade de um ORM pode depender do banco: o Prisma
   * torna `%` e `_` literais em Postgres e MySQL, que têm escape default no
   * `LIKE`, e não consegue em SQLite nem SQL Server, que não têm. Sem este
   * recorte, declarar a divergência marcaria como divergentes também as duas
   * células onde o adapter acerta.
   */
  readonly dialects?: readonly CorpusDialect[];
}

/** Dialeto de uma célula — inclui o de referência, que não é célula da matriz. */
export type CorpusDialect = 'postgres' | 'mysql' | 'mssql' | 'sqlite';

export interface CorpusCase {
  /** Identificador estável usado nos relatórios da matriz. */
  id: string;
  description: string;
  tags: readonly string[];
  /** Nome do preset em `tests/v3/fixtures/rules.ts`. */
  rules: string;
  query: Record<string, unknown>;
  expect: CorpusExpectation;
  /** Adapters que não conseguem produzir `expect`, com o porquê. */
  divergences?: Readonly<Partial<Record<CorpusAdapterId, CorpusDivergence>>>;
}
