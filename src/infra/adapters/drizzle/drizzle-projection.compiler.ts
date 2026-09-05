import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { DrizzleJoinPlanner } from './drizzle-join-planner';
import type {
  DrizzleManyProjection,
  DrizzleSelection,
} from './drizzle-statement.interface';

export interface CompiledProjection {
  readonly select: readonly DrizzleSelection[];
  readonly many: readonly DrizzleManyProjection[];
}

/**
 * `internalProjection` -> seleções qualificadas (spec §13 e §14).
 *
 * Cada alias é projetado explicitamente; não existe `SELECT *` nem PK de root
 * presumida. Relações `one` viram junções de apresentação; relações `many`
 * saem do statement principal e ganham uma consulta própria, porque juntá-las
 * inflaria os roots e faria `LIMIT` cortar uma coleção pela metade.
 */
export function compileProjection(
  plan: TypedQueryPlan,
  planner: DrizzleJoinPlanner
): CompiledProjection {
  // O plano fala em campos lógicos; a seleção carrega os dois nomes, porque um
  // vai ao SQL e o outro é a chave da linha hidratada.
  const select: DrizzleSelection[] = plan.internalProjection.root.map(
    (field) => ({
      alias: planner.rootAlias,
      field,
      column: planner.column([], field),
      path: '',
    })
  );
  const many: DrizzleManyProjection[] = [];

  for (const [path, columns] of plan.internalProjection.relations) {
    const relationPath = path.split('.');

    if (!planner.crossesMany(relationPath)) {
      const alias = planner.join(relationPath, 'presentation');
      for (const field of columns) {
        select.push({
          alias,
          field,
          column: planner.column(relationPath, field),
          path,
        });
      }
      continue;
    }

    many.push(manyProjection(plan, planner, path, relationPath, columns));
  }

  // A correlação precisa da coluna do root mesmo quando o cliente não a pediu;
  // o normalizador descarta o excedente ao montar o JSON.
  for (const projection of many) {
    const present = select.some(
      (selection) =>
        selection.alias === planner.rootAlias &&
        selection.field === projection.sourceField
    );
    if (!present) {
      select.push({
        alias: planner.rootAlias,
        field: projection.sourceField,
        column: planner.column([], projection.sourceField),
        path: '',
      });
    }
  }

  return { select, many };
}

function manyProjection(
  plan: TypedQueryPlan,
  planner: DrizzleJoinPlanner,
  path: string,
  relationPath: readonly string[],
  columns: readonly string[]
): DrizzleManyProjection {
  // Uma coleção pendurada em outra relação exigiria hidratar em três níveis;
  // falha fechado em vez de devolver a coleção vazia (spec §3).
  if (relationPath.length > 1) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `Drizzle adapter cannot project the nested to-many relation ${path}`,
      { path }
    );
  }

  const relation = planner.relation(relationPath);
  const target = plan.registry.get(relation.target.model);

  if (!target) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      `Drizzle relation ${path} targets the unknown model ${relation.target.model}`,
      { path, model: relation.target.model }
    );
  }

  // A coluna de correlação entra na projeção mesmo sem o cliente a pedir: é
  // por ela que o filho encontra o seu root.
  const fields = [...new Set([...columns, relation.targetColumn])];

  return {
    path,
    table: relation.target.name,
    sourceField: relation.sourceColumn,
    targetColumn: planner.column(relationPath, relation.targetColumn),
    targetField: relation.targetColumn,
    columns: fields.map((field) => ({
      field,
      column: planner.column(relationPath, field),
    })),
    orderBy: target.primaryKey.map((field) =>
      planner.column(relationPath, field)
    ),
  };
}
