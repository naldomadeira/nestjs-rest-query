import type { FieldDescriptor, RelationDescriptor } from '../schema';
import type { LogicalValue } from '../coercion';
import type { QueryOperator } from '../../domain/operators/operator.types';

export interface PlanFilter {
  readonly path: string;
  /** `relation` quando o alvo é a própria relação (`isNull`), spec §11.1. */
  readonly target: 'scalar' | 'relation';
  /** Cadeia de relações até a folha, em nomes de path. */
  readonly relationPath: readonly string[];
  /**
   * Coluna física efetiva: a original, o `foldedField` (para `ilike`) ou o
   * `portableOrderField` (para ordem sobre uuid/enum).
   */
  readonly column: string;
  readonly field: FieldDescriptor | null;
  readonly relation: RelationDescriptor | null;
  readonly operator: QueryOperator;
  readonly value: LogicalValue | readonly LogicalValue[];
  /** `true` quando o termo cruza uma relação many: semântica existencial. */
  readonly existential: boolean;
  /** O compiler deve escapar `%`, `_` e `\` antes de montar o padrão. */
  readonly literalPattern: boolean;
  /** `in=[]`: condição sempre falsa (spec §10.2). */
  readonly alwaysFalse: boolean;
  /** `notIn=[]`: condição sempre verdadeira. */
  readonly alwaysTrue: boolean;
}

export interface PlanSort {
  readonly path: string;
  readonly column: string;
  readonly relationPath: readonly string[];
  readonly direction: 'asc' | 'desc';
}

export interface PlanSearchTarget {
  readonly path: string;
  readonly column: string;
  readonly relationPath: readonly string[];
}

export interface PlanSearch {
  readonly term: string;
  /** Termo já dobrado pelo mesmo helper que preenche o folded field. */
  readonly foldedTerm: string;
  readonly targets: readonly PlanSearchTarget[];
}
