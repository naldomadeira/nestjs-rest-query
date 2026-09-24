import { configurationError } from '@core/errors';
import { physicalColumn } from './drizzle-schema.resolver';
import type {
  DrizzleColumnRef,
  DrizzleJoin,
  DrizzleRelation,
  DrizzleRelationMap,
  DrizzleTable,
} from './drizzle-statement.interface';

/**
 * Por que um path foi juntado.
 *
 * - `predicate`: termo de filtro (AND). A junção é INNER e entra no count.
 * - `or-predicate`: alvo de `search`, um termo dentro de um OR. A junção entra
 *   no count, mas fica LEFT: um INNER derrubaria o root sem a relação mesmo
 *   quando ele casa por outro alvo do OR.
 * - `presentation`: projeção e sort. LEFT, e fora do count.
 */
export type JoinPurpose = 'predicate' | 'or-predicate' | 'presentation';

interface PlannedJoin {
  readonly join: DrizzleJoin;
  /** Algum termo AND exige a relação: a junção vira INNER. */
  predicate: boolean;
  /** O `where` cita a relação: o count precisa da junção. */
  counted: boolean;
}

/**
 * Resolve aliases e junções a partir dos paths do plano (spec §15.3).
 *
 * Duas regras governam tudo aqui:
 *
 * 1. Junções são idempotentes e derivadas do path, então filter, sort e fields
 *    que citam a mesma relação compartilham um único alias.
 * 2. Uma relação `many` **nunca** é juntada no statement principal: ela vira
 *    subconsulta correlacionada, para o root não inflar e o `total` continuar
 *    correto sem `distinct`.
 */
export class DrizzleJoinPlanner {
  private readonly joins = new Map<string, PlannedJoin>();

  constructor(
    private readonly table: DrizzleTable,
    private readonly relations: DrizzleRelationMap
  ) {}

  get rootAlias(): string {
    return this.table.name;
  }

  aliasFor(relationPath: readonly string[]): string {
    if (relationPath.length === 0) return this.rootAlias;
    return `${this.rootAlias}__${relationPath.join('__')}`;
  }

  /**
   * Tabela dona de um path: o root, ou o alvo do último salto.
   *
   * É o que permite traduzir campo lógico em coluna física no nível certo —
   * `company.name` pergunta a `companies`, não a `users`.
   */
  tableFor(relationPath: readonly string[]): DrizzleTable {
    if (relationPath.length === 0) return this.table;
    return this.relation(relationPath).target;
  }

  /** Coluna física de um campo lógico, resolvida na tabela do path. */
  column(relationPath: readonly string[], field: string): string {
    return physicalColumn(this.tableFor(relationPath), field);
  }

  relation(relationPath: readonly string[]): DrizzleRelation {
    const path = relationPath.join('.');
    const relation = this.relations[path];
    if (!relation) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Drizzle source has no relation declared for path ${path}`,
        { table: this.table.name, path }
      );
    }
    return relation;
  }

  /** `true` quando qualquer salto do caminho é `many`. */
  crossesMany(relationPath: readonly string[]): boolean {
    return relationPath.some(
      (_, index) =>
        this.relation(relationPath.slice(0, index + 1)).cardinality === 'many'
    );
  }

  /** Prefixo inicial do caminho formado apenas por relações `one`. */
  oneOnlyPrefix(relationPath: readonly string[]): readonly string[] {
    const prefix: string[] = [];
    for (const segment of relationPath) {
      const next = [...prefix, segment];
      if (this.relation(next).cardinality === 'many') break;
      prefix.push(segment);
    }
    return prefix;
  }

  /**
   * Registra (ou reaproveita) as junções até `relationPath` e devolve o alias
   * da folha. Um caminho `many` aqui é erro de programação do compiler.
   */
  join(relationPath: readonly string[], purpose: JoinPurpose): string {
    let parentAlias = this.rootAlias;

    for (let index = 0; index < relationPath.length; index++) {
      const chain = relationPath.slice(0, index + 1);
      const relation = this.relation(chain);
      if (relation.cardinality === 'many') {
        throw configurationError(
          'ADAPTER_CONTRACT_VIOLATION',
          `Drizzle cannot join through the to-many relation ${chain.join('.')}`,
          { table: this.table.name, path: chain.join('.') }
        );
      }

      const path = chain.join('.');
      const alias = this.aliasFor(chain);
      const existing = this.joins.get(path);

      if (existing) {
        // AND vence: uma relação que é filtro e alvo de busca continua INNER.
        existing.predicate ||= purpose === 'predicate';
        existing.counted ||= purpose !== 'presentation';
      } else {
        this.joins.set(path, {
          predicate: purpose === 'predicate',
          counted: purpose !== 'presentation',
          join: {
            path,
            table: relation.target.name,
            alias,
            parentAlias,
            // A condição de junção é SQL: os dois lados já entram traduzidos.
            sourceColumn: this.column(
              chain.slice(0, -1),
              relation.sourceColumn
            ),
            targetColumn: physicalColumn(
              relation.target,
              relation.targetColumn
            ),
            kind: 'left',
          },
        });
      }

      parentAlias = alias;
    }

    return parentAlias;
  }

  /** Coluna qualificada de um path pontuado (`company.name` -> alias.coluna). */
  ref(columnPath: string, purpose: JoinPurpose): DrizzleColumnRef {
    const segments = columnPath.split('.');
    const relationPath = segments.slice(0, -1);
    const alias = this.join(relationPath, purpose);
    return {
      alias,
      column: this.column(relationPath, segments[segments.length - 1]),
    };
  }

  /**
   * Cadeia de junções de uma subconsulta correlacionada.
   *
   * O prefixo `one` é juntado no statement externo; a subconsulta começa no
   * alias desse prefixo, de modo que `company.employees.name` correlacione com
   * a `company` já juntada, e não de novo com o root. `subqueryFrom` permite
   * forçar um início mais raso, como em `filter[company][isNull]`, onde a
   * própria relação terminal precisa ficar dentro da subconsulta.
   */
  existsChain(
    relationPath: readonly string[],
    subqueryFrom = this.oneOnlyPrefix(relationPath).length,
    purpose: Exclude<JoinPurpose, 'presentation'> = 'predicate'
  ): readonly DrizzleJoin[] {
    const prefix = relationPath.slice(0, subqueryFrom);
    let parentAlias = this.join(prefix, purpose);
    const chain: DrizzleJoin[] = [];

    for (let index = prefix.length; index < relationPath.length; index++) {
      const segment = relationPath.slice(0, index + 1);
      const relation = this.relation(segment);
      const alias = `${this.aliasFor(segment)}__x`;

      chain.push({
        path: segment.join('.'),
        table: relation.target.name,
        alias,
        parentAlias,
        sourceColumn: this.column(segment.slice(0, -1), relation.sourceColumn),
        targetColumn: physicalColumn(relation.target, relation.targetColumn),
        kind: 'inner',
      });

      parentAlias = alias;
    }

    return chain;
  }

  /** Todas as junções do statement de dados, na ordem de registro. */
  all(): readonly DrizzleJoin[] {
    return [...this.joins.values()].map(kindOf);
  }

  /** Só as junções necessárias ao `where`: o que o count precisa. */
  predicateOnly(): readonly DrizzleJoin[] {
    return [...this.joins.values()]
      .filter((planned) => planned.counted)
      .map(kindOf);
  }
}

function kindOf(planned: PlannedJoin): DrizzleJoin {
  return planned.predicate
    ? { ...planned.join, kind: 'inner' as const }
    : planned.join;
}
