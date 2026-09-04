import { inputError } from '../errors';
import { parseValueList } from '../coercion';
import type {
  UntypedFilterTerm,
  UntypedQueryAst,
  UntypedSortTerm,
} from './untyped-ast';

/**
 * Alfabeto seguro de paths. Por construção rejeita `*`, `;`, `..`, path vazio
 * e qualquer caractere que pudesse escapar para o SQL, o que mantém o wildcard
 * fora do alcance do cliente (spec §8.3).
 */
const SAFE_PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const SAFE_OPERATOR_RE = /^[A-Za-z][A-Za-z0-9]*$/;

/** Query params reconhecidos pela gramática (spec §10). */
export interface QueryInputLike {
  page?: unknown;
  perPage?: unknown;
  paginate?: unknown;
  sort?: unknown;
  fields?: unknown;
  includes?: unknown;
  filter?: unknown;
  search?: unknown;
  [key: string]: unknown;
}

function assertSafePath(path: string, param: string): string {
  if (!SAFE_PATH_RE.test(path)) {
    throw inputError('QUERY_SYNTAX_INVALID', `Invalid ${param} path syntax`, {
      param,
      path,
    });
  }
  return path;
}

function readPathList(raw: unknown, param: string): string[] {
  return parseValueList(raw).map((item) => {
    if (typeof item !== 'string') {
      throw inputError(
        'QUERY_SYNTAX_INVALID',
        `Invalid ${param} entry: expected a path`,
        { param }
      );
    }
    return assertSafePath(item, param);
  });
}

function parseFilters(raw: unknown): UntypedFilterTerm[] {
  if (raw === undefined || raw === null) return [];

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw inputError('QUERY_SYNTAX_INVALID', 'filter must be an object', {
      param: 'filter',
    });
  }

  const terms: UntypedFilterTerm[] = [];

  for (const [path, valueOrOperators] of Object.entries(
    raw as Record<string, unknown>
  )) {
    assertSafePath(path, 'filter');

    // Forma curta: `filter[name]=Ada` significa `eq`.
    if (
      valueOrOperators === null ||
      typeof valueOrOperators !== 'object' ||
      Array.isArray(valueOrOperators)
    ) {
      terms.push({ path, operator: 'eq', rawValue: valueOrOperators });
      continue;
    }

    for (const [operator, rawValue] of Object.entries(
      valueOrOperators as Record<string, unknown>
    )) {
      if (!SAFE_OPERATOR_RE.test(operator)) {
        throw inputError(
          'QUERY_SYNTAX_INVALID',
          'Invalid filter operator syntax',
          { param: 'filter', path }
        );
      }
      terms.push({ path, operator, rawValue });
    }
  }

  return terms;
}

function parseSorts(raw: unknown): UntypedSortTerm[] {
  if (raw === undefined || raw === null) return [];

  return parseValueList(raw).map((item) => {
    if (typeof item !== 'string') {
      throw inputError('QUERY_SYNTAX_INVALID', 'Invalid sort entry', {
        param: 'sort',
      });
    }
    const descending = item.startsWith('-');
    const path = descending ? item.slice(1) : item;
    return {
      path: assertSafePath(path, 'sort'),
      direction: descending ? ('desc' as const) : ('asc' as const),
    };
  });
}

export function parseQueryInput(input: QueryInputLike): UntypedQueryAst {
  const search = typeof input.search === 'string' ? input.search.trim() : null;

  return Object.freeze({
    filters: Object.freeze(parseFilters(input.filter)),
    sorts: Object.freeze(parseSorts(input.sort)),
    fields:
      input.fields === undefined || input.fields === null
        ? null
        : Object.freeze(readPathList(input.fields, 'fields')),
    includes: Object.freeze(
      input.includes === undefined || input.includes === null
        ? []
        : readPathList(input.includes, 'includes')
    ),
    search: search === '' ? null : search,
    pagination: Object.freeze({
      page: input.page,
      perPage: input.perPage,
      paginate: input.paginate,
    }),
  });
}
