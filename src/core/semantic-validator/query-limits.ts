import { configurationError, inputError } from '../errors';
import { parseValueList } from '../coercion';
import type { UntypedFilterTerm, UntypedQueryAst } from '../query-parser';

/**
 * Limites anti-abuso de uma requisição.
 *
 * A whitelist decide *o que* o cliente pode pedir; estes números decidem
 * *quanto*. São checados sobre a AST, antes da autorização e da coerção, para
 * que uma requisição desproporcional seja recusada pelo caminho mais barato e
 * nunca chegue a virar SQL.
 */
export interface QueryLimits {
  /** Termos de filtro (`filter[path][operador]`), somados entre os paths. */
  readonly maxFilters: number;
  /** Valores de uma lista: `in`, `notIn` e `between`, em CSV ou em array. */
  readonly maxListItems: number;
  /** Campos de `sort`. */
  readonly maxSorts: number;
  /** Comprimento de `search` depois do `trim`, em unidades UTF-16. */
  readonly maxSearchLength: number;
  /**
   * Comprimento de cada valor de filtro string, em unidades UTF-16. Numa
   * lista, vale por item: cem UUIDs juntos passam de 255 caracteres, e
   * recusá-los seria recusar o uso legítimo de `in`.
   */
  readonly maxFilterValueLength: number;
}

/**
 * Defaults da biblioteca.
 *
 * Escolhidos para que nenhuma tela razoável os encontre e nenhum abuso barato
 * caiba neles: um formulário de busca raramente passa de dez filtros, e um
 * `in` de cem valores já é uma seleção em massa.
 */
export const DEFAULT_QUERY_LIMITS: QueryLimits = Object.freeze({
  maxFilters: 20,
  maxListItems: 100,
  maxSorts: 5,
  maxSearchLength: 100,
  maxFilterValueLength: 255,
});

const LIMIT_KEYS: ReadonlySet<string> = new Set(
  Object.keys(DEFAULT_QUERY_LIMITS)
);

/** Operadores cujo valor é uma lista, e portanto medido item a item. */
const LIST_VALUE_OPERATORS: ReadonlySet<string> = new Set([
  'in',
  'notIn',
  'between',
]);

/**
 * Valida limites declarados por quem configura (`forRoot` ou
 * `defineQueryRules`), na inicialização.
 *
 * Chave desconhecida é recusada em vez de ignorada: `maxFilter` digitado sem
 * o "s" deixaria o endpoint com o default achando que tinha apertado o limite.
 */
export function assertQueryLimitsInput(
  input: Partial<QueryLimits> | undefined,
  context: string
): void {
  if (input === undefined) return;

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `${context} must be an object`,
      { context }
    );
  }

  for (const [key, value] of Object.entries(input)) {
    if (!LIMIT_KEYS.has(key)) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `${context}.${key} is not a known limit; expected one of ${[...LIMIT_KEYS].join(', ')}`,
        { context, key }
      );
    }
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `${context}.${key} must be a positive integer`,
        { context, key, value }
      );
    }
  }
}

/**
 * Política efetiva: cada camada substitui só as chaves que declarou.
 *
 * Mesma regra da paginação (`build-query-plan.ts`): `undefined` não apaga a
 * camada de baixo, senão `forRoot({ limits: {} })` desligaria o default.
 */
export function resolveQueryLimits(
  ...layers: readonly (Partial<QueryLimits> | undefined)[]
): QueryLimits {
  const resolved: { -readonly [K in keyof QueryLimits]: number } = {
    ...DEFAULT_QUERY_LIMITS,
  };
  for (const layer of layers) {
    if (!layer) continue;
    for (const key of LIMIT_KEYS) {
      const value = layer[key as keyof QueryLimits];
      if (value !== undefined) resolved[key as keyof QueryLimits] = value;
    }
  }
  return Object.freeze(resolved);
}

function exceeded(
  message: string,
  details: Readonly<Record<string, unknown>>
): never {
  // `details` leva o nome do limite e o teto, nunca o valor enviado: é a
  // regra do envelope (spec §17.1), e um segredo colado na URL não pode voltar
  // no corpo do 400.
  throw inputError('QUERY_LIMIT_EXCEEDED', message, details);
}

/** Recusa a AST que passa de qualquer limite (400 `QUERY_LIMIT_EXCEEDED`). */
export function assertWithinQueryLimits(
  ast: UntypedQueryAst,
  limits: QueryLimits
): void {
  if (ast.filters.length > limits.maxFilters) {
    exceeded(
      `Too many filter terms: at most ${limits.maxFilters} are allowed`,
      { param: 'filter', limit: 'maxFilters', max: limits.maxFilters }
    );
  }

  for (const term of ast.filters) assertFilterTerm(term, limits);

  if (ast.sorts.length > limits.maxSorts) {
    exceeded(`Too many sort fields: at most ${limits.maxSorts} are allowed`, {
      param: 'sort',
      limit: 'maxSorts',
      max: limits.maxSorts,
    });
  }

  if (ast.search !== null && ast.search.length > limits.maxSearchLength) {
    exceeded(
      `search is too long: at most ${limits.maxSearchLength} characters are allowed`,
      {
        param: 'search',
        limit: 'maxSearchLength',
        max: limits.maxSearchLength,
      }
    );
  }
}

function assertFilterTerm(term: UntypedFilterTerm, limits: QueryLimits): void {
  const where = { param: 'filter', path: term.path, operator: term.operator };
  const label = `filter[${term.path}][${term.operator}]`;

  // Um array já expandido pelo `qs` é lista em qualquer operador; uma string
  // só é lista nos operadores de lista — em `eq`, "a,b" é um valor só.
  const items = Array.isArray(term.rawValue)
    ? term.rawValue
    : typeof term.rawValue === 'string' &&
        LIST_VALUE_OPERATORS.has(term.operator)
      ? parseValueList(term.rawValue)
      : [term.rawValue];

  if (items.length > limits.maxListItems) {
    exceeded(
      `Too many values in ${label}: at most ${limits.maxListItems} are allowed`,
      { ...where, limit: 'maxListItems', max: limits.maxListItems }
    );
  }

  for (const item of items) {
    if (typeof item !== 'string') continue;
    if (item.length > limits.maxFilterValueLength) {
      exceeded(
        `Value of ${label} is too long: at most ${limits.maxFilterValueLength} characters are allowed`,
        {
          ...where,
          limit: 'maxFilterValueLength',
          max: limits.maxFilterValueLength,
        }
      );
    }
  }
}
