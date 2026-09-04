import type { ScalarKind } from './scalar-kind';

export interface FieldDescriptor {
  readonly path: string;
  readonly kind: ScalarKind;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  readonly enumValues?: readonly string[];
  /**
   * Coluna oculta com `value.normalize('NFC').toLowerCase()`. Obrigatória para
   * `ilike`, `notIlike` e `search` sob o perfil `portable-strict` (spec §12).
   */
  readonly foldedField?: string;
  /**
   * Coluna auxiliar com ordem total portável, obrigatória quando o tipo físico
   * não ordena igual nas três famílias de banco (spec §9).
   */
  readonly portableOrderField?: string;
  /** Colunas internas nunca são filtráveis, projetáveis nem ordenáveis. */
  readonly internal?: boolean;
}

export interface RelationDescriptor {
  readonly path: string;
  readonly target: string;
  readonly cardinality: 'one' | 'many';
  readonly nullable: boolean;
}

export interface QuerySchema {
  readonly model: string;
  readonly fields: ReadonlyMap<string, FieldDescriptor>;
  readonly relations: ReadonlyMap<string, RelationDescriptor>;
  readonly primaryKey: readonly string[];
}

/** Todos os schemas alcançáveis a partir do root, indexados por model. */
export type SchemaRegistry = ReadonlyMap<string, QuerySchema>;

export interface QuerySchemaInput {
  readonly model: string;
  readonly primaryKey: readonly string[];
  readonly fields: readonly FieldDescriptor[];
  readonly relations: readonly RelationDescriptor[];
}
