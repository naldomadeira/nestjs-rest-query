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
      /** IDs de root na ordem exata esperada. */
      ids: readonly (string | number)[];
      total?: number;
      lastPage?: number;
      /** Shape JSON exato da primeira linha, quando o caso testa projeção. */
      firstRow?: Record<string, unknown>;
    }
  | { kind: 'error'; status: number; code: RestQueryErrorCodeName };

export interface CorpusCase {
  /** Identificador estável usado nos relatórios da matriz. */
  id: string;
  description: string;
  tags: readonly string[];
  /** Nome do preset em `tests/v3/fixtures/rules.ts`. */
  rules: string;
  query: Record<string, unknown>;
  expect: CorpusExpectation;
}
