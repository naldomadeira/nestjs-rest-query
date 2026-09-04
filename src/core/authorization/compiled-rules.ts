import type { QueryOperator } from '../../domain/operators/operator.types';
import type { FieldDescriptor, SchemaRegistry } from '../schema';

export interface CompiledFieldProjection {
  readonly allowed: readonly string[];
  readonly default: readonly string[];
}

export interface CompiledSearchTarget {
  readonly path: string;
  readonly field: FieldDescriptor;
  /** Coluna consultada: sempre o folded field (spec §12). */
  readonly column: string;
  readonly relationPath: readonly string[];
  /**
   * `true` quando o caminho cruza uma relação many (spec §11.1).
   *
   * É calculado aqui, e não no validador semântico, porque a cardinalidade
   * mora nos descritores de relação e a cadeia deles só existe enquanto
   * `resolvePath` roda — na inicialização. Depois disso sobra `relationPath`,
   * que são nomes. `validateSearch` apenas propaga a marca para o plano.
   */
  readonly existential: boolean;
}

export interface CompiledQueryRules {
  readonly registry: SchemaRegistry;
  readonly model: string;
  /** Path exato -> operadores autorizados para aquele path. */
  readonly filters: ReadonlyMap<string, ReadonlySet<QueryOperator>>;
  readonly sorts: ReadonlySet<string>;
  readonly fields: {
    readonly root: CompiledFieldProjection;
    readonly relations: ReadonlyMap<string, CompiledFieldProjection>;
  };
  readonly includes: ReadonlySet<string>;
  readonly search: readonly CompiledSearchTarget[];
}
