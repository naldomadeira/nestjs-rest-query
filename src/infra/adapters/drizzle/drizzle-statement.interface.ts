import type { SqlDialect } from '@contracts/v3';
import type { QuerySchema, ScalarKind } from '@core/schema';

export interface DrizzleColumn {
  /** Nome físico da coluna na tabela. */
  readonly name: string;
  readonly kind: ScalarKind;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  /** Colunas internas (folded, order) existem no banco e somem do JSON. */
  readonly internal?: boolean;
  readonly foldedField?: string;
  readonly portableOrderField?: string;
}

export interface DrizzleTable {
  readonly name: string;
  readonly model: string;
  readonly columns: Readonly<Record<string, DrizzleColumn>>;
}

export interface DrizzleRelation {
  readonly target: DrizzleTable;
  readonly cardinality: 'one' | 'many';
  readonly nullable: boolean;
  /** Coluna do lado de origem que participa da condição de junção. */
  readonly sourceColumn: string;
  readonly targetColumn: string;
}

/**
 * Relações declaradas por *path pontuado* a partir do root.
 *
 * `{ company: ..., 'company.owner': ... }` descreve a cadeia inteira. Só as
 * chaves sem ponto entram no schema lógico do root; as demais existem para o
 * compiler saber juntar/correlacionar caminhos profundos.
 */
export type DrizzleRelationMap = Readonly<Record<string, DrizzleRelation>>;

export interface DrizzleJoin {
  /** Path pontuado da relação, a partir do root. */
  readonly path: string;
  readonly table: string;
  readonly alias: string;
  readonly parentAlias: string;
  readonly sourceColumn: string;
  readonly targetColumn: string;
  /** `left` preserva roots sem correspondência; usado na apresentação. */
  readonly kind: 'inner' | 'left';
}

export interface DrizzleSelection {
  readonly alias: string;
  readonly column: string;
  /** Path da relação dona da coluna; string vazia no root. */
  readonly path: string;
}

export interface DrizzleOrderBy {
  readonly alias: string;
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export interface DrizzleColumnRef {
  readonly alias: string;
  readonly column: string;
}

export type DrizzleCondition =
  | { readonly op: 'and' | 'or'; readonly terms: readonly DrizzleCondition[] }
  | {
      readonly op: 'compare';
      readonly ref: DrizzleColumnRef;
      readonly comparator: '=' | '<>' | '>' | '>=' | '<' | '<=';
      readonly value: unknown;
    }
  | {
      readonly op: 'in' | 'notIn';
      readonly ref: DrizzleColumnRef;
      readonly values: readonly unknown[];
    }
  | {
      readonly op: 'between';
      readonly ref: DrizzleColumnRef;
      readonly from: unknown;
      readonly to: unknown;
    }
  | {
      readonly op: 'null';
      readonly ref: DrizzleColumnRef;
      readonly negated: boolean;
    }
  | {
      readonly op: 'like';
      readonly ref: DrizzleColumnRef;
      readonly value: string;
      readonly escape: string;
      readonly negated: boolean;
    }
  /**
   * Subconsulta correlacionada. `joins[0].parentAlias` aponta para o alias do
   * root: é assim que uma relação `many` filtra sem inflar a raiz (spec §11.2).
   */
  | {
      readonly op: 'exists';
      readonly relationPath: readonly string[];
      readonly joins: readonly DrizzleJoin[];
      readonly where?: DrizzleCondition;
      readonly negated: boolean;
    }
  | { readonly op: 'alwaysFalse' }
  | { readonly op: 'alwaysTrue' };

export interface DrizzleStatement {
  readonly dialect: SqlDialect;
  readonly table: string;
  readonly alias: string;
  readonly select: readonly DrizzleSelection[];
  readonly joins: readonly DrizzleJoin[];
  where?: DrizzleCondition;
  readonly orderBy: readonly DrizzleOrderBy[];
  readonly limit?: number;
  readonly offset?: number;
  /** `true` no statement de contagem: o executor emite `count(*)`. */
  readonly countOnly: boolean;
}

/** Contexto entregue a `customize`, uma vez por query do escopo. */
export interface DrizzleNativeQuery {
  readonly kind: 'data' | 'count';
  readonly statement: DrizzleStatement;
}

/**
 * Executor fornecido pelo consumidor.
 *
 * O adapter compila o plano para um statement completo e explícito; a
 * materialização em SQL do Drizzle 1.x, por dialeto, ainda é responsabilidade
 * do consumidor. Enquanto o Drizzle 1.x estiver em RC, esta é a fronteira
 * declarada da fase 5 — e não uma degradação silenciosa.
 */
export interface DrizzleDatabase {
  executeData(statement: DrizzleStatement): Promise<readonly object[]>;
  executeCount(statement: DrizzleStatement): Promise<number>;
}

export interface DrizzleSourceInput {
  readonly db: DrizzleDatabase;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations: DrizzleRelationMap;
  readonly schema: QuerySchema;
}

export interface DrizzleSourceOptions {
  readonly db: DrizzleDatabase;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations?: DrizzleRelationMap;
}

export interface CompiledDrizzleQuery {
  readonly db: DrizzleDatabase;
  readonly data: DrizzleStatement;
  readonly count: DrizzleStatement;
  readonly paginate: boolean;
}
