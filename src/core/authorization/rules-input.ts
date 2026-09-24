import type { QueryOperator } from '../../domain/operators/operator.types';

export interface FilterRuleInput {
  readonly path: string;
  readonly operators: readonly QueryOperator[];
}

export interface FieldProjectionInput {
  /**
   * Campos expostos naquele nível. Numa relação, aceita a forma wildcard
   * `<relacao>.*`, expandida na construção — nunca a partir de input do
   * cliente (spec §8.3).
   */
  readonly allowed: readonly string[];
  readonly default: readonly string[];
}

/**
 * Política de paginação do endpoint. Cada chave declarada **substitui** a do
 * `forRoot` para este endpoint; a omitida herda a global.
 */
export interface PaginationRulesInput {
  /** `false` recusa `?paginate=false` neste endpoint com 400. */
  readonly allowUnpaginated?: boolean;
  /** Teto de linhas de uma resposta sem paginação neste endpoint. */
  readonly maxUnpaginatedRows?: number;
}

export interface QueryRulesInput {
  readonly filters?: readonly FilterRuleInput[];
  readonly sorts?: readonly string[];
  readonly fields: {
    readonly root: FieldProjectionInput;
    readonly relations?: Readonly<Record<string, FieldProjectionInput>>;
  };
  readonly includes?: readonly string[];
  readonly search?: readonly string[];
  readonly pagination?: PaginationRulesInput;
}
