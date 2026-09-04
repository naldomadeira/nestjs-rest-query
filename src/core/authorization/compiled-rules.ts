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
