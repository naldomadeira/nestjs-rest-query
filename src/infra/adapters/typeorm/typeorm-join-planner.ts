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
    // Mesma regra do filtro, e pela mesma razão: alvo de busca por relação
    // `many` vira EXISTS no compilador. Juntá-lo aqui duplicaria o root uma
    // vez por item casado e o LIMIT da página cairia sobre as duplicatas.
    if (target.existential) continue;
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

/** Prefixo dos aliases da subquery existencial, para não colidir com joins. */
const SUBQUERY_PREFIX = 'dqb_ex_';

/** Sufixo do alias da tabela de junção de uma many-to-many. */
const JUNCTION_SUFFIX = '_j';

/** Uma tabela da subquery existencial, ligada à anterior por `on`. */
export interface ExistentialStep {
  readonly table: string;
  readonly alias: string;
  /**
   * Pares que ligam este alias ao anterior — o root, no primeiro passo.
   *
   * O passo não sabe o alias do pai de propósito: quem emite o SQL é que
   * conhece a ordem, e é sempre o alias imediatamente anterior da cadeia.
   */
  readonly on: readonly {
    readonly column: string;
    readonly parentColumn: string;
  }[];
}

/**
 * Cadeia de tabelas de um caminho existencial, do root até a folha.
 *
 * O primeiro passo vai no `FROM` da subquery e é o único correlacionado com o
 * root; os demais são `INNER JOIN` **dentro** dela. É a forma que o Drizzle já
 * usa, e a razão é aritmética: correlacionar o segundo salto por fora
 * multiplicaria os roots e estragaria o `total`, que é justamente o que o
 * `EXISTS` existe para evitar.
 *
 * A cadeia é montada percorrendo a metadata do TypeORM salto a salto, e não o
 * registry lógico: só a metadata sabe de que lado a FK mora e que tabela de
 * junção existe.
 */
export function existentialChain(
  root: EntityMetadata,
  relationPath: readonly string[]
): readonly ExistentialStep[] {
  const steps: ExistentialStep[] = [];
  const traversed: string[] = [];
  let metadata = root;

  for (const property of relationPath) {
    const relation = metadata.findRelationWithPropertyPath(property)!;
    // O alias acumula o caminho inteiro: `posts.tags` não colide com `tags`, e
    // uma relação que volta para a própria entidade não colide consigo mesma.
    traversed.push(property);
    steps.push(
      ...relationSteps(relation, `${SUBQUERY_PREFIX}${traversed.join('_')}`)
    );
    metadata = relation.inverseEntityMetadata;
  }

  return steps;
}

/** Passos de um único salto: um para relação direta, dois para many-to-many. */
function relationSteps(
  relation: RelationMetadata,
  alias: string
): ExistentialStep[] {
  if (relation.isManyToMany) return manyToManySteps(relation, alias);

  const table = relation.inverseEntityMetadata.tableName;

  // FK deste lado (many-to-one, ou one-to-one dona): a coluna dona está no
  // pai e a referenciada no alvo, então o par sai invertido em relação ao
  // caso abaixo.
  if (relation.isWithJoinColumn) {
    return [
      {
        table,
        alias,
        on: relation.joinColumns.map((column: ColumnMetadata) => ({
          column: column.referencedColumn!.databaseName,
          parentColumn: column.databaseName,
        })),
      },
    ];
  }

  // Sobram one-to-many e one-to-one inversa: a FK vive no alvo, e é a relação
  // dona (o lado inverso) que a descreve. TypeORM exige `inverseSide` nos dois
  // casos, então o inverso sempre existe e sempre tem join columns.
  const owning = relation.inverseRelation!;

  return [
    {
      table,
      alias,
      on: owning.joinColumns.map((column: ColumnMetadata) => ({
        column: column.databaseName,
        parentColumn: column.referencedColumn!.databaseName,
      })),
    },
  ];
}

/**
 * Many-to-many atravessa a **tabela de junção**, e é isso que o guard antigo
 * recusava por não saber fazer.
 *
 * O defeito que ele substituiu era silencioso: numa m2m o lado dono *tem*
 * `joinColumns` — só que são colunas da junção —, enquanto `entityMetadata`
 * continua sendo a entidade que declara a relação. Correlacionar com esse par
 * produzia `EXISTS (SELECT 1 FROM articles ... WHERE articles.articlesId =
 * root.id)`: SQL válido, tabela errada, resultado errado. Aqui a junção entra
 * como tabela própria, e o alvo é alcançado a partir dela.
 *
 * Só o lado dono guarda `junctionEntityMetadata` e as duas listas de colunas;
 * do lado inverso elas vêm do dono, com os papéis trocados — o que aponta para
 * o alvo, de lá, é o que aponta para o pai, daqui.
 *
 * A junção é a única tabela do SQL cujo nome e cujas colunas **não** vêm do
 * consumidor: a estratégia de nomes do TypeORM os gera em camelCase
 * (`articlesId`). O resto deste compilador emite identificadores crus, e sem
 * aspas o PostgreSQL dobra `articlesId` para minúsculas e não acha a coluna —
 * então só estes três passam pelo `escape` do driver. Uniformizar a citação
 * do compilador inteiro é decisão maior que esta emenda.
 */
function manyToManySteps(
  relation: RelationMetadata,
  alias: string
): ExistentialStep[] {
  const owning = relation.isOwning ? relation : relation.inverseRelation!;
  const toParent = relation.isOwning
    ? owning.joinColumns
    : owning.inverseJoinColumns;
  const toTarget = relation.isOwning
    ? owning.inverseJoinColumns
    : owning.joinColumns;
  const { driver } = relation.entityMetadata.dataSource;

  return [
    {
      table: driver.escape(owning.junctionEntityMetadata!.tableName),
      alias: `${alias}${JUNCTION_SUFFIX}`,
      on: toParent.map((column: ColumnMetadata) => ({
        column: driver.escape(column.databaseName),
        parentColumn: column.referencedColumn!.databaseName,
      })),
    },
    {
      table: relation.inverseEntityMetadata.tableName,
      alias,
      on: toTarget.map((column: ColumnMetadata) => ({
        column: column.referencedColumn!.databaseName,
        parentColumn: driver.escape(column.databaseName),
      })),
    },
  ];
}
