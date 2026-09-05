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
export interface QueryGrammarParams {
  page?: unknown;
  perPage?: unknown;
  paginate?: unknown;
  sort?: unknown;
  fields?: unknown;
  includes?: unknown;
  filter?: unknown;
  search?: unknown;
}

/**
 * A gramática como *dado*, para que a whitelist de runtime e a interface não
 * possam divergir: `Record<keyof QueryGrammarParams, true>` reprova em
 * compilação tanto o param declarado e esquecido aqui quanto o inventado aqui e
 * não declarado lá. Sem isso, um param novo entraria em produção sendo recusado
 * como desconhecido — ou pior, um removido continuaria sendo aceito calado.
 */
const GRAMMAR_PARAMS: Readonly<Record<keyof QueryGrammarParams, true>> = {
  page: true,
  perPage: true,
  paginate: true,
  sort: true,
  fields: true,
  includes: true,
  filter: true,
  search: true,
};

const GRAMMAR_PARAM_NAMES: ReadonlySet<string> = new Set(
  Object.keys(GRAMMAR_PARAMS)
);

/**
 * A index signature é o que permite receber `req.query` cru — e, portanto, o
 * que torna possível *ver* o param desconhecido para recusá-lo. Ela não é
 * permissão para ignorá-lo: quem valida é `assertKnownParams`.
 */
export interface QueryInputLike extends QueryGrammarParams {
  [key: string]: unknown;
}

/**
 * Param fora da gramática é recusado, não ignorado (spec §5.6).
 *
 * O nome do param vai nos detalhes porque o consumidor precisa saber *qual*
 * chave corrigir; o valor enviado nunca vai, que é a regra do envelope (§17.1)
 * e o que impede um segredo colado na URL de voltar no corpo do 400.
 */
function assertKnownParams(input: QueryInputLike): void {
  for (const param of Object.keys(input)) {
    if (GRAMMAR_PARAM_NAMES.has(param)) continue;
    // Chave presente valendo `undefined` é ausência: é assim que a própria
    // gramática lê `page` e `filter`, e é a forma que uma classe DTO
    // transpilada para ES2022 assume — todo campo declarado vira own property
    // `undefined`. Recusar aqui puniria a DTO por existir.
    if (input[param] === undefined) continue;

    throw inputError(
      'QUERY_SYNTAX_UNKNOWN_PARAM',
      `Unknown query parameter "${param}"`,
      { param }
    );
  }
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
  assertKnownParams(input);

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
