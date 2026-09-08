import { inputError } from '../errors';
import { resolvePath, type ResolvedFieldPath } from '../schema';
import type { UntypedPagination, UntypedQueryAst } from '../query-parser';
import type { QueryOperator } from '../../domain/operators/operator.types';
import type {
  CompiledQueryRules,
  CompiledSearchTarget,
} from './compiled-rules';

export interface ResolvedFilterTerm {
  readonly path: string;
  readonly operator: QueryOperator;
  readonly rawValue: unknown;
  readonly resolved: ResolvedFieldPath;
}

export interface ResolvedSortTerm {
  readonly path: string;
  readonly direction: 'asc' | 'desc';
  readonly resolved: ResolvedFieldPath;
}

export interface ResolvedProjection {
  readonly root: readonly string[];
  readonly relations: ReadonlyMap<string, readonly string[]>;
}

export interface ResolvedSearch {
  readonly term: string;
  readonly targets: readonly CompiledSearchTarget[];
}

export interface ResolvedQueryAst {
  readonly model: string;
  readonly filters: readonly ResolvedFilterTerm[];
  readonly sorts: readonly ResolvedSortTerm[];
  readonly projection: ResolvedProjection;
  readonly includes: readonly string[];
  readonly search: ResolvedSearch | null;
  readonly pagination: UntypedPagination;
}

const notAllowed = (
  scope: string,
  path: string,
  allowed: Iterable<string>
): never => {
  throw inputError(
    'FIELD_NOT_ALLOWED',
    `${scope} path is not allowed: ${path}`,
    { path, scope, allowed: [...allowed] }
  );
};

/**
 * Aplica a whitelist exata do endpoint sobre a AST (spec §8.3).
 *
 * Paths são comparados literalmente: autorizar `company` não autoriza
 * `company.name`. É o que fecha a brecha da v2, onde a checagem olhava só o
 * primeiro segmento do caminho.
 */
export function authorize(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules
): ResolvedQueryAst {
  const includes = authorizeIncludes(ast, rules);

  return Object.freeze({
    model: rules.model,
    filters: Object.freeze(authorizeFilters(ast, rules)),
    sorts: Object.freeze(authorizeSorts(ast, rules)),
    projection: authorizeProjection(ast, rules, includes),
    includes: Object.freeze(includes),
    search: authorizeSearch(ast, rules),
    pagination: ast.pagination,
  });
}

function authorizeFilters(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules
): ResolvedFilterTerm[] {
  return ast.filters.map((term) => {
    const operators = rules.filters.get(term.path);
    if (!operators) {
      notAllowed('filter', term.path, rules.filters.keys());
    }
    if (!operators!.has(term.operator as QueryOperator)) {
      throw inputError(
        'OPERATOR_NOT_ALLOWED',
        `Operator ${term.operator} is not allowed for ${term.path}`,
        { path: term.path, operator: term.operator, allowed: [...operators!] }
      );
    }

    return {
      path: term.path,
      operator: term.operator as QueryOperator,
      rawValue: term.rawValue,
      resolved: resolvePath(rules.registry, rules.model, term.path, {
        allowRelationLeaf: true,
      }),
    };
  });
}

function authorizeSorts(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules
): ResolvedSortTerm[] {
  return ast.sorts.map((term) => {
    if (!rules.sorts.has(term.path)) {
      notAllowed('sort', term.path, rules.sorts);
    }
    return {
      path: term.path,
      direction: term.direction,
      resolved: resolvePath(rules.registry, rules.model, term.path),
    };
  });
}

function authorizeIncludes(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules
): string[] {
  for (const path of ast.includes) {
    if (!rules.includes.has(path)) {
      notAllowed('includes', path, rules.includes);
    }
    if (path.includes('.')) {
      const parent = path.slice(0, path.lastIndexOf('.'));
      if (!ast.includes.includes(parent)) {
        notAllowed('includes', path, rules.includes);
      }
    }
  }
  return [...ast.includes];
}

function authorizeProjection(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules,
  includes: readonly string[]
): ResolvedProjection {
  // Sem `fields` na URL: defaults de root e de cada relação incluída.
  if (ast.fields === null) {
    return Object.freeze({
      root: rules.fields.root.default,
      relations: relationDefaults(rules, includes),
    });
  }

  const root: string[] = [];
  const requested = new Map<string, string[]>();

  for (const token of ast.fields) {
    if (!token.includes('.')) {
      if (!rules.fields.root.allowed.includes(token)) {
        notAllowed('fields', token, rules.fields.root.allowed);
      }
      if (!root.includes(token)) root.push(token);
      continue;
    }

    const relationPath = token.slice(0, token.lastIndexOf('.'));
    const leaf = token.slice(token.lastIndexOf('.') + 1);

    // Seleção nunca inclui relação implicitamente (spec §13).
    if (!includes.includes(relationPath)) {
      notAllowed('fields', token, includes);
    }

    const projection = rules.fields.relations.get(relationPath);
    if (!projection || !projection.allowed.includes(leaf)) {
      notAllowed('fields', token, projection?.allowed ?? []);
    }

    const bucket = requested.get(relationPath) ?? [];
    if (!bucket.includes(leaf)) bucket.push(leaf);
    requested.set(relationPath, bucket);
  }

  // Relação incluída sem field dotted cai no seu default.
  const relations = new Map<string, readonly string[]>();
  for (const relationPath of includes) {
    relations.set(
      relationPath,
      Object.freeze(
        requested.get(relationPath) ??
          rules.fields.relations.get(relationPath)!.default
      )
    );
  }

  return Object.freeze({ root: Object.freeze(root), relations });
}

function relationDefaults(
  rules: CompiledQueryRules,
  includes: readonly string[]
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    includes.map((path) => [path, rules.fields.relations.get(path)!.default])
  );
}

function authorizeSearch(
  ast: UntypedQueryAst,
  rules: CompiledQueryRules
): ResolvedSearch | null {
  if (ast.search === null) return null;

  if (rules.search.length === 0) {
    notAllowed('search', ast.search, []);
  }

  return Object.freeze({ term: ast.search, targets: rules.search });
}
