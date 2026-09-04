import type { EntityMetadata } from 'typeorm';
import type { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';

export interface JoinNode {
  /** Path lógico completo, ex.: `company.owner`. */
  readonly path: string;
  /** Alias determinístico, ex.: `root_company_owner`. */
  readonly alias: string;
  readonly parentAlias: string;
  readonly property: string;
  readonly cardinality: 'one' | 'many';
  /** Join necessário para avaliar um predicado. */
  predicate: boolean;
  /** Join necessário para projetar campos no JSON. */
  presentation: boolean;
}

export interface JoinPlan {
  readonly rootAlias: string;
  /** Nós indexados por path lógico; a ordem é a de inserção (pais antes). */
  readonly nodes: ReadonlyMap<string, JoinNode>;
  /** `true` quando algum join de apresentação pode inflar as linhas de root. */
  readonly hasManyPresentation: boolean;
}

export const ROOT_ALIAS = 'root';

/**
 * Planeja os joins do TypeORM (spec §15.1).
 *
 * Duas propriedades importam: os aliases são determinísticos e derivados do
 * path, então o mesmo caminho pedido por filtro e por include reutiliza um
 * único join; e cada nó registra se é necessário ao predicado, à apresentação
 * ou a ambos, para que um join criado só para filtrar não vaze para a
 * projeção.
 *
 * Caminhos que cruzam uma relação `many` não geram join: viram subquery
 * existencial no compilador de filtros, o que evita inflar os roots.
 */
export function planJoins(plan: TypedQueryPlan): JoinPlan {
  const nodes = new Map<string, JoinNode>();

  const ensure = (path: string, usage: 'predicate' | 'presentation'): void => {
    const segments = path.split('.');
    let currentPath = '';
    let parentAlias = ROOT_ALIAS;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;

      const existing = nodes.get(currentPath);
      if (existing) {
        existing[usage] = true;
        parentAlias = existing.alias;
        continue;
      }

      const relation = relationAt(plan, currentPath);
      const node: JoinNode = {
        path: currentPath,
        alias: `${ROOT_ALIAS}_${currentPath.split('.').join('_')}`,
        parentAlias,
        property: segment,
        cardinality: relation,
        predicate: usage === 'predicate',
        presentation: usage === 'presentation',
      };
      nodes.set(currentPath, node);
      parentAlias = node.alias;
    }
  };

  for (const filter of plan.filters) {
    if (filter.existential) continue; // vira EXISTS, não join
    if (filter.relationPath.length === 0) continue;
    ensure(filter.relationPath.join('.'), 'predicate');
  }

  for (const sort of plan.sorts) {
    if (sort.relationPath.length === 0) continue;
    ensure(sort.relationPath.join('.'), 'predicate');
  }

  for (const target of plan.search?.targets ?? []) {
    if (target.relationPath.length === 0) continue;
    ensure(target.relationPath.join('.'), 'predicate');
  }

  for (const include of plan.includes) {
    ensure(include, 'presentation');
  }

  return {
    rootAlias: ROOT_ALIAS,
    nodes,
    hasManyPresentation: [...nodes.values()].some(
      (node) => node.presentation && node.cardinality === 'many'
    ),
  };
}

function relationAt(plan: TypedQueryPlan, path: string): 'one' | 'many' {
  const segments = path.split('.');
  let model = plan.model;

  for (let index = 0; index < segments.length; index++) {
    const schema = plan.registry.get(model);
    const relation = schema?.relations.get(segments[index]);
    if (!relation) {
      throw configurationError(
        'ADAPTER_CONTRACT_VIOLATION',
        `Join planner could not resolve relation ${segments[index]} in ${path}`,
        { path }
      );
    }
    if (index === segments.length - 1) return relation.cardinality;
    model = relation.target;
  }

  /* istanbul ignore next — o loop sempre retorna na última iteração */
  throw configurationError(
    'ADAPTER_CONTRACT_VIOLATION',
    `Empty relation path`,
    { path }
  );
}

/**
 * Colunas que correlacionam uma relação `many` com o root, para a subquery
 * existencial. TypeORM guarda as join columns no lado dono da relação.
 */
export function correlationColumns(relation: RelationMetadata): {
  readonly owner: EntityMetadata;
  readonly pairs: readonly {
    readonly ownerColumn: string;
    readonly referencedColumn: string;
  }[];
} {
  const owning = relation.isOwning ? relation : relation.inverseRelation;

  if (!owning || owning.joinColumns.length === 0) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Relation ${relation.propertyPath} has no join columns; many-to-many existential filters are not supported yet`,
      { path: relation.propertyPath }
    );
  }

  return {
    owner: owning.entityMetadata,
    pairs: owning.joinColumns.map((column: ColumnMetadata) => ({
      ownerColumn: column.databaseName,
      referencedColumn: column.referencedColumn!.databaseName,
    })),
  };
}
