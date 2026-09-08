import { configurationError, RestQueryError } from '../errors';
import {
  crossesMany,
  requireSchema,
  resolvePath,
  TEXTUAL_KINDS,
  type SchemaRegistry,
} from '../schema';
import { assertOperatorSupported } from '../semantic-validator/operator-matrix';
import type { QueryOperator } from '../../domain/operators/operator.types';
import type {
  CompiledFieldProjection,
  CompiledQueryRules,
  CompiledSearchTarget,
} from './compiled-rules';
import type { FieldProjectionInput, QueryRulesInput } from './rules-input';

const invalid = (message: string, details?: Record<string, unknown>): never => {
  throw configurationError('SOURCE_CONFIGURATION_INVALID', message, details);
};

/**
 * Reetiqueta um erro de input vindo da resolução de path/operador como erro de
 * configuração: aqui estamos validando o que o *desenvolvedor* declarou, não o
 * que o cliente enviou, e isso precisa falhar na inicialização.
 */
function asConfiguration<T>(run: () => T, context: string): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof RestQueryError && error.statusCode === 400) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `${context}: ${error.message}`,
        error.details
      );
    }
    throw error;
  }
}

/**
 * Compila e valida as regras de um endpoint (spec §8.3).
 *
 * Toda a validação acontece aqui, uma vez, na construção: paths existem,
 * defaults são subconjunto de allowed, campos de busca são textuais e têm
 * folded field, operadores são compatíveis com o tipo, relações projetadas
 * estão autorizadas em includes e sort não atravessa relação many. Depois
 * disso, `authorize()` só precisa comparar contra conjuntos.
 */
export function defineQueryRules(
  registry: SchemaRegistry,
  model: string,
  input: QueryRulesInput
): CompiledQueryRules {
  requireSchema(registry, model);

  const includes = compileIncludes(registry, model, input.includes ?? []);
  const filters = compileFilters(registry, model, input);
  const sorts = compileSorts(registry, model, input.sorts ?? []);
  const fields = compileFields(registry, model, input, includes);
  const search = compileSearch(registry, model, input.search ?? []);

  return Object.freeze({
    registry,
    model,
    filters,
    sorts,
    fields,
    includes,
    search,
  });
}

function compileIncludes(
  registry: SchemaRegistry,
  model: string,
  includes: readonly string[]
): ReadonlySet<string> {
  for (const path of includes) {
    const resolved = asConfiguration(
      () => resolvePath(registry, model, path, { allowRelationLeaf: true }),
      `includes.${path}`
    );
    if (!resolved.relation) {
      invalid(`Include ${path} does not resolve to a relation`, { path });
    }
    // Include profundo exige que o prefixo também esteja autorizado, senão a
    // projeção de `company.owner` existiria sem `company` no JSON.
    if (path.includes('.')) {
      const parent = path.slice(0, path.lastIndexOf('.'));
      if (!includes.includes(parent)) {
        invalid(`Include ${path} requires its parent include ${parent}`, {
          path,
        });
      }
    }
  }
  return Object.freeze(new Set(includes));
}

function compileFilters(
  registry: SchemaRegistry,
  model: string,
  input: QueryRulesInput
): ReadonlyMap<string, ReadonlySet<QueryOperator>> {
  const filters = new Map<string, ReadonlySet<QueryOperator>>();

  for (const rule of input.filters ?? []) {
    if (filters.has(rule.path)) {
      invalid(`Duplicate filter rule for path ${rule.path}`, {
        path: rule.path,
      });
    }
    if (rule.operators.length === 0) {
      invalid(`Filter rule ${rule.path} authorizes no operator`, {
        path: rule.path,
      });
    }

    const resolved = asConfiguration(
      () =>
        resolvePath(registry, model, rule.path, { allowRelationLeaf: true }),
      `filters.${rule.path}`
    );

    if (!resolved.field) {
      // Relação como alvo: só nulidade faz sentido (spec §11.1).
      for (const operator of rule.operators) {
        if (operator !== 'isNull') {
          invalid(
            `Filter ${rule.path} targets a relation, so only isNull is valid`,
            { path: rule.path, operator }
          );
        }
      }
    } else {
      for (const operator of rule.operators) {
        asConfiguration(
          () => assertOperatorSupported(resolved.field!, operator),
          `filters.${rule.path}`
        );
      }
    }

    filters.set(rule.path, Object.freeze(new Set(rule.operators)));
  }

  return filters;
}

function compileSorts(
  registry: SchemaRegistry,
  model: string,
  sorts: readonly string[]
): ReadonlySet<string> {
  for (const path of sorts) {
    const resolved = asConfiguration(
      () => resolvePath(registry, model, path),
      `sorts.${path}`
    );
    if (crossesMany(resolved.relationChain)) {
      invalid(
        `Sort ${path} crosses a many relation, which has no deterministic order`,
        { path }
      );
    }
    // Herda a checagem de ordem portável da matriz de operadores.
    asConfiguration(
      () => assertOperatorSupported(resolved.field!, 'gt'),
      `sorts.${path}`
    );
  }
  return Object.freeze(new Set(sorts));
}

function compileFields(
  registry: SchemaRegistry,
  model: string,
  input: QueryRulesInput,
  includes: ReadonlySet<string>
): CompiledQueryRules['fields'] {
  const root = compileProjection(
    registry,
    model,
    '',
    input.fields.root,
    'fields.root'
  );

  const relations = new Map<string, CompiledFieldProjection>();
  for (const [relationPath, projection] of Object.entries(
    input.fields.relations ?? {}
  )) {
    if (!includes.has(relationPath)) {
      invalid(
        `Projection for relation ${relationPath} requires it to be authorized in includes`,
        { path: relationPath }
      );
    }
    relations.set(
      relationPath,
      compileProjection(
        registry,
        model,
        relationPath,
        projection,
        `fields.relations.${relationPath}`
      )
    );
  }

  for (const relationPath of includes) {
    if (!relations.has(relationPath)) {
      invalid(
        `Include ${relationPath} has no field projection; declare fields.relations.${relationPath}`,
        { path: relationPath }
      );
    }
  }

  return Object.freeze({ root, relations });
}

function compileProjection(
  registry: SchemaRegistry,
  model: string,
  relationPath: string,
  projection: FieldProjectionInput,
  context: string
): CompiledFieldProjection {
  const prefix = relationPath ? `${relationPath}.` : '';
  const wildcard = relationPath ? `${relationPath}.*` : null;

  let allowed: string[];
  if (wildcard && projection.allowed.includes(wildcard)) {
    if (projection.allowed.length !== 1) {
      invalid(`${context}: wildcard must be the only allowed entry`, {
        path: relationPath,
      });
    }
    const target = asConfiguration(
      () =>
        resolvePath(registry, model, relationPath, { allowRelationLeaf: true }),
      context
    );
    const schema = requireSchema(registry, target.ownerModel);
    allowed = [...schema.fields.values()]
      .filter((field) => !field.internal)
      .map((field) => field.path);
  } else {
    for (const entry of projection.allowed) {
      if (entry.includes('*')) {
        invalid(`${context}: wildcard must be written as "${relationPath}.*"`, {
          path: entry,
        });
      }
    }
    allowed = [...projection.allowed];
    for (const entry of allowed) {
      asConfiguration(
        () => resolvePath(registry, model, `${prefix}${entry}`),
        context
      );
    }
  }

  if (projection.default.length === 0) {
    invalid(`${context}: default projection must not be empty`, {
      path: relationPath,
    });
  }
  for (const entry of projection.default) {
    if (!allowed.includes(entry)) {
      invalid(`${context}: default field ${entry} is not in allowed`, {
        path: entry,
      });
    }
  }

  return Object.freeze({
    allowed: Object.freeze(allowed),
    default: Object.freeze([...projection.default]),
  });
}

function compileSearch(
  registry: SchemaRegistry,
  model: string,
  search: readonly string[]
): readonly CompiledSearchTarget[] {
  return Object.freeze(
    search.map((path) => {
      const resolved = asConfiguration(
        () => resolvePath(registry, model, path),
        `search.${path}`
      );
      const field = resolved.field!;

      if (!TEXTUAL_KINDS.has(field.kind)) {
        invalid(`Search field ${path} must be textual`, {
          path,
          expected: field.kind,
        });
      }
      if (!field.foldedField) {
        invalid(`Search field ${path} declares no folded field`, { path });
      }

      const prefix = path.includes('.')
        ? `${path.slice(0, path.lastIndexOf('.'))}.`
        : '';

      return Object.freeze({
        path,
        field,
        column: `${prefix}${field.foldedField}`,
        relationPath: Object.freeze(
          resolved.relationChain.map((relation) => relation.path)
        ),
        // Mesmo `crossesMany` de `validate-filter.ts`: buscar por uma folha
        // atravessando `many` é "algum item casa o termo", nunca um join de
        // predicado — que duplicaria roots e encurtaria a página.
        existential: crossesMany(resolved.relationChain),
      });
    })
  );
}
