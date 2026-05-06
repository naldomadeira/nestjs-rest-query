/**
 * Centralized 400 error message templates (G7).
 *
 * Every `throw new BadRequestException(...)` in adapters, handlers, and
 * normalizers should import its string from here so that the same logical
 * error emits the same byte-for-byte message regardless of which ORM the
 * consumer wired up. The G6 cross-adapter parity matrix asserts on these
 * exact strings.
 *
 * These are template functions, not classes — the public contract is the
 * string they return, not the function identity. Renaming an export is a
 * breaking change only if a consumer imports it; rewording the returned
 * string is a breaking change for anyone parsing `error.message`.
 */

export type FieldScope = 'filter' | 'sort' | 'fields' | 'search' | 'includes';

const SCOPE_FORMAT_LABEL: Record<FieldScope, string> = {
  filter: 'filter field',
  sort: 'sort field',
  fields: 'field name',
  search: 'search field',
  includes: 'include',
};

const SCOPE_NOT_ALLOWED_NOUN: Record<FieldScope, string> = {
  filter: 'Filter field(s)',
  sort: 'Sort field(s)',
  fields: 'Field(s)',
  search: 'Search field(s)',
  includes: 'Include(s)',
};

const SCOPE_NOT_ALLOWED_LABEL: Record<FieldScope, string> = {
  filter: 'Allowed fields',
  sort: 'Allowed sorts',
  fields: 'Allowed fields',
  search: 'Allowed search fields',
  includes: 'Allowed includes',
};

const joinList = (v: string | readonly string[], sep: string): string =>
  Array.isArray(v) ? (v as readonly string[]).join(sep) : (v as string);

// --- Field path validation (regex syntax: only alphanumeric/underscore/dots) ---

export const INVALID_FIELD_FORMAT = (
  scope: FieldScope,
  paths: string | readonly string[]
): string =>
  `Invalid ${SCOPE_FORMAT_LABEL[scope]} format: "${joinList(paths, '", "')}". Only alphanumeric, underscore, and dots are allowed.`;

// --- Whitelist (field not in RulesConfig) ---

export const FIELD_NOT_ALLOWED = (
  scope: FieldScope,
  names: string | readonly string[],
  allowed: string | readonly string[]
): string =>
  `${SCOPE_NOT_ALLOWED_NOUN[scope]} not allowed: ${joinList(names, ', ')}. ${SCOPE_NOT_ALLOWED_LABEL[scope]}: ${joinList(allowed, ', ')}`;

export const SORT_NOT_IN_FIELDS = (
  outside: string | readonly string[],
  allowed: string | readonly string[]
): string =>
  `Cannot sort by field(s) not in the allowed fields list: ${joinList(outside, ', ')}. Allowed fields: ${joinList(allowed, ', ')}`;

// --- Operator validation ---

export const OPERATOR_NOT_ALLOWED = (
  operator: string,
  allowed: string | readonly string[]
): string =>
  `Operator "${operator}" is not allowed. Allowed operators: ${joinList(allowed, ', ')}`;

export const OPERATOR_NOT_IMPLEMENTED = (operator: string): string =>
  `Operator "${operator}" is not implemented`;

export const UNSUPPORTED_OPERATOR = (
  operator: string,
  field: string,
  supported: string | readonly string[]
): string =>
  `Unsupported operator "${operator}" for field "${field}". Supported: ${joinList(supported, ', ')}`;

export const INVALID_FILTER_FORMAT = (field: string): string =>
  `Invalid filter format for field "${field}". Expected string, number, or object with operators.`;

// --- Operator value validation ---

export const OPERATOR_VALUE_REQUIRED = (
  field: string,
  operator: string
): string => `filter[${field}][${operator}] requires a value`;

export const OPERATOR_VALUE_ARRAY_REQUIRED = (
  field: string,
  operator: string
): string => `filter[${field}][${operator}] requires a non-empty array`;

export const OPERATOR_BETWEEN_VALUES = (field: string): string =>
  `filter[${field}][between] requires exactly two values`;

export const OPERATOR_ISNULL_BOOLEAN = (field: string): string =>
  `filter[${field}][isNull] requires a boolean`;

// --- Operator on relation ---

export const OPERATOR_ON_RELATION = (operator: string, path: string): string =>
  `Operator "${operator}" cannot be applied directly to relation "${path}". Use a dotted path to a scalar field on the relation.`;

export const ISNULL_ON_MANY = (path: string): string =>
  `Operator "isNull" is not supported on to-many relation "${path}".`;

// --- Sort on relation ---

export const SORT_THROUGH_MANY = (path: string): string =>
  `Cannot sort by '${path}': sorting through to-many relations is not supported.`;

export const SORT_ON_RELATION_DIRECT = (path: string): string =>
  `Cannot sort by relation '${path}' directly. Sort by a scalar field on the relation.`;

// --- Search / Fields on relation ---

export const SEARCH_ON_RELATION = (field: string): string =>
  `Search field "${field}" cannot be a relation. Use a dotted path to a scalar field on the relation.`;

export const FIELDS_ON_RELATION = (path: string): string =>
  `Field "${path}" cannot be a relation. Use scalar field paths.`;

// --- Source structure ---

export const UNKNOWN_RELATION = (hop: string, fullPath: string): string =>
  `Unknown relation '${hop}' in path '${fullPath}'. Declare it in source.relations.`;

export const UNKNOWN_COLUMN_ROOT = (fieldPath: string): string =>
  `Column "${fieldPath}" not found on root table.`;

export const UNKNOWN_COLUMN_RELATION = (
  column: string,
  joinPath: string,
  fieldPath: string
): string =>
  `Column "${column}" not found on relation "${joinPath}". Map it explicitly via source.columnMap["${fieldPath}"].`;

export const NO_RELATION_REGISTERED = (joinPath: string): string =>
  `No relation registered for "${joinPath}". Add it to source.relations.`;

export const INVALID_PRISMA_SOURCE =
  'PrismaAdapter requires a PrismaSource: { prisma, model, ... }';

export const PRISMA_SOURCE_MISSING_CLIENT = 'PrismaSource.prisma is required.';

export const PRISMA_SOURCE_MISSING_MODEL =
  'PrismaSource.model is required and must be a string (the delegate key).';

// --- Pagination ---

export const PAGE_MUST_BE_POSITIVE = '"page" must be >= 1';
export const PER_PAGE_MUST_BE_POSITIVE = '"perPage" must be >= 1';

// --- Date / Value coercion ---

export const INVALID_DATE_VALUE = (raw: string): string =>
  `Invalid date value: "${raw}"`;

// --- Normalizers (param parsing) ---

export const MULTIVALUE_FORBIDDEN = (param: string): string =>
  `"${param}" cannot have multiple values`;

export const INVALID_INTEGER = (param: string, value: unknown): string =>
  `"${param}" must be a valid integer, got "${String(value)}"`;

export const BETWEEN_REQUIRES_ARRAY =
  'Operator "between" expects array or comma-separated string with 2 values';

export const BETWEEN_REQUIRES_TWO = (actual: number): string =>
  `Operator "between" expects exactly 2 values, got ${actual}`;
