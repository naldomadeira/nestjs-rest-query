import { configurationError } from '@core/errors';
import type {
  DrizzleColumnRef,
  DrizzleJoin,
  DrizzleRelation,
  DrizzleRelationMap,
  DrizzleTable,
} from './drizzle-statement.interface';

export type JoinPurpose = 'predicate' | 'presentation';

interface PlannedJoin {
  readonly join: DrizzleJoin;
  predicate: boolean;
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
        existing.predicate ||= purpose === 'predicate';
      } else {
        this.joins.set(path, {
          predicate: purpose === 'predicate',
          join: {
            path,
            table: relation.target.name,
            alias,
            parentAlias,
            sourceColumn: relation.sourceColumn,
            targetColumn: relation.targetColumn,
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
    const column = segments[segments.length - 1];
    const alias = this.join(segments.slice(0, -1), purpose);
    return { alias, column };
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
    subqueryFrom = this.oneOnlyPrefix(relationPath).length
  ): readonly DrizzleJoin[] {
    const prefix = relationPath.slice(0, subqueryFrom);
    let parentAlias = this.join(prefix, 'predicate');
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
        sourceColumn: relation.sourceColumn,
        targetColumn: relation.targetColumn,
        kind: 'inner',
      });

      parentAlias = alias;
    }

    return chain;
  }

  /** Todas as junções do statement de dados, na ordem de registro. */
  all(): readonly DrizzleJoin[] {
    return [...this.joins.values()].map((planned) =>
      planned.predicate
        ? { ...planned.join, kind: 'inner' as const }
        : planned.join
    );
  }

  /** Só as junções necessárias ao `where`: o que o count precisa. */
  predicateOnly(): readonly DrizzleJoin[] {
    return [...this.joins.values()]
      .filter((planned) => planned.predicate)
      .map((planned) => ({ ...planned.join, kind: 'inner' as const }));
  }
}
