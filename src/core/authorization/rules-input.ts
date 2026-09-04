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

export interface QueryRulesInput {
  readonly filters?: readonly FilterRuleInput[];
  readonly sorts?: readonly string[];
  readonly fields: {
    readonly root: FieldProjectionInput;
    readonly relations?: Readonly<Record<string, FieldProjectionInput>>;
  };
  readonly includes?: readonly string[];
  readonly search?: readonly string[];
}
