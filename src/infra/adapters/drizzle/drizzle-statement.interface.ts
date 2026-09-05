import type { SqlDialect } from '@contracts/v3';
import type { QuerySchema, ScalarKind } from '@core/schema';

export interface DrizzleColumn {
  /**
   * Nome **físico** da coluna, o identificador que vai ao SQL.
   *
   * A chave do mapa `columns` é outra coisa: é o campo **lógico** — o nome que
   * a API expõe, que as regras autorizam e que volta no JSON. Os dois só
   * coincidem quando o banco e a API usam a mesma convenção;
   * `{ companyId: { name: 'company_id' } }` é a forma normal de um banco
   * snake_case atrás de uma API camelCase, e é traduzida aqui, não pelo
   * consumidor.
   */
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
  /**
   * Campo **lógico** do lado de origem que participa da condição de junção —
   * chave do mapa `columns` da tabela de origem, não o nome físico. O
   * identificador emitido sai do `name` daquela coluna, como em qualquer outro
   * ponto do compilador; uma chave não declarada falha na construção da source.
   */
  readonly sourceColumn: string;
  /** Campo lógico do alvo, chave do mapa `columns` de `target`. */
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
  /** Colunas **físicas** dos dois lados: daqui para baixo tudo é SQL. */
  readonly sourceColumn: string;
  readonly targetColumn: string;
  /** `left` preserva roots sem correspondência; usado na apresentação. */
  readonly kind: 'inner' | 'left';
}

/**
 * Coluna projetada, nas duas identidades que ela precisa ter.
 *
 * `column` é o que o SQL pede à tabela; `field` é a chave sob a qual o valor
 * volta ao objeto hidratado, e é o nome que o normalizador e as regras
 * conhecem. Guardar só um dos dois foi o que fez `DrizzleColumn.name` ser
 * declarado e ignorado.
 */
export interface DrizzleProjectedColumn {
  /** Campo lógico: chave no objeto hidratado. */
  readonly field: string;
  /** Coluna física: identificador no SQL. */
  readonly column: string;
}

export interface DrizzleSelection extends DrizzleProjectedColumn {
  readonly alias: string;
  /** Path da relação dona da coluna; string vazia no root. */
  readonly path: string;
}

export interface DrizzleOrderBy {
  readonly alias: string;
  /** Coluna física. */
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export interface DrizzleColumnRef {
  readonly alias: string;
  /** Coluna física: `DrizzleColumnRef` só existe para virar SQL. */
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

/**
 * Relação `many` da projeção, hidratada por uma consulta própria.
 *
 * Juntá-la ao statement principal inflaria os roots e quebraria `LIMIT`; a
 * consulta separada é a segunda fase da §14 para este adapter.
 */
export interface DrizzleManyProjection {
  readonly path: string;
  readonly table: string;
  /**
   * Campo **lógico** do root que correlaciona com a relação: a chave é lida da
   * linha já hidratada, não da linha crua do driver.
   */
  readonly sourceField: string;
  /** Coluna física do alvo, usada no `IN` da segunda consulta. */
  readonly targetColumn: string;
  /** Campo lógico do alvo, usado para agrupar os filhos hidratados. */
  readonly targetField: string;
  /** Colunas a projetar no alvo, já sem as internas do plano. */
  readonly columns: readonly DrizzleProjectedColumn[];
  /** Chave primária do alvo em colunas físicas, para ordenar a coleção. */
  readonly orderBy: readonly string[];
}

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
  /** Chave primária do root em campos lógicos, como o plano a declara. */
  readonly rootKey: readonly string[];
  readonly manyProjections: readonly DrizzleManyProjection[];
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
export interface DrizzleDatabase<TRow extends object = object> {
  /**
   * Dialeto que este executor materializa, quando ele sabe declará-lo.
   *
   * `drizzleDatabase()` sempre declara. Um executor escrito à mão pode omitir,
   * e nesse caso a coincidência com o dialeto da source fica por conta de quem
   * escreveu — porque o modo de falha é silencioso: SQL compilado para um
   * dialeto e executado por outro devolve resultado errado, não erro.
   */
  readonly dialect?: SqlDialect;
  executeData(statement: DrizzleStatement): Promise<readonly TRow[]>;
  executeCount(statement: DrizzleStatement): Promise<number>;
}

/**
 * `TRow` é o tipo da linha que o executor promete devolver.
 *
 * Ele entra por aqui, e não por afirmação do adapter, porque é o executor —
 * `drizzleDatabase()` ou uma implementação do consumidor — o único ponto que
 * de fato produz as linhas. O adapter apenas propaga o que foi prometido, e é
 * isso que faz `execute()` inferir o tipo da linha sem cast no uso público.
 */
export interface DrizzleSourceInput<TRow extends object = object> {
  readonly db: DrizzleDatabase<TRow>;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations: DrizzleRelationMap;
  readonly schema: QuerySchema;
}

export interface DrizzleSourceOptions<TRow extends object = object> {
  readonly db: DrizzleDatabase<TRow>;
  readonly dialect: SqlDialect;
  readonly table: DrizzleTable;
  readonly relations?: DrizzleRelationMap;
}

export interface CompiledDrizzleQuery<TRow extends object = object> {
  readonly db: DrizzleDatabase<TRow>;
  readonly data: DrizzleStatement;
  readonly count: DrizzleStatement;
  readonly paginate: boolean;
}
