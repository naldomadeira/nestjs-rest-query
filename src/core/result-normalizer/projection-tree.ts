import { encodeScalar } from '../coercion';
import { requireSchema, resolvePath } from '../schema';
import type { FieldDescriptor, RelationDescriptor } from '../schema';
import type { TypedQueryPlan } from '../query-plan';

export interface ProjectionNode {
  readonly fields: readonly FieldDescriptor[];
  readonly relations: ReadonlyMap<
    string,
    { readonly relation: RelationDescriptor; readonly node: ProjectionNode }
  >;
}

/**
 * Converte a projeção plana do plano (`company`, `company.owner`) na árvore
 * que o JSON precisa ter. É essa árvore que garante que relações profundas
 * permaneçam aninhadas em vez de virarem `company_owner` (spec §13).
 */
export function buildProjectionTree(plan: TypedQueryPlan): ProjectionNode {
  const root = createNode(plan, plan.model, plan.projection.root);

  // Includes ordenados por profundidade: o pai sempre existe antes do filho.
  const ordered = [...plan.includes].sort(
    (a, b) => a.split('.').length - b.split('.').length
  );

  for (const path of ordered) {
    const segments = path.split('.');
    const parentPath = segments.slice(0, -1).join('.');
    const leaf = segments[segments.length - 1];

    const parent = parentPath ? findNode(root, parentPath) : root;
    if (!parent) continue;

    const target = resolvePath(plan.registry, plan.model, path, {
      allowRelationLeaf: true,
    });

    (parent.relations as Map<string, unknown>).set(leaf, {
      relation: target.relation!,
      node: createNode(
        plan,
        target.ownerModel,
        plan.projection.relations.get(path) ?? []
      ),
    });
  }

  return root;
}

function createNode(
  plan: TypedQueryPlan,
  model: string,
  columns: readonly string[]
): ProjectionNode {
  const schema = requireSchema(plan.registry, model);
  return {
    fields: columns
      .map((column) => schema.fields.get(column))
      .filter((field): field is FieldDescriptor => Boolean(field)),
    relations: new Map(),
  };
}

function findNode(root: ProjectionNode, path: string): ProjectionNode | null {
  let node: ProjectionNode | undefined = root;
  for (const segment of path.split('.')) {
    node = node?.relations.get(segment)?.node;
    if (!node) return null;
  }
  return node;
}

/** Aplica a árvore a uma linha hidratada, produzindo o JSON canônico. */
export function projectRow(
  node: ProjectionNode,
  row: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const field of node.fields) {
    output[field.path] = encodeScalar(field, row[field.path]);
  }

  for (const [name, child] of node.relations) {
    const value = row[name];

    if (child.relation.cardinality === 'many') {
      output[name] = Array.isArray(value)
        ? value.map((item) =>
            projectRow(child.node, item as Record<string, unknown>)
          )
        : [];
      continue;
    }

    output[name] =
      value === null || value === undefined
        ? null
        : projectRow(child.node, value as Record<string, unknown>);
  }

  return output;
}
