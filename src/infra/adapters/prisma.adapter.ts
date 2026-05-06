/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import type { QueryInput } from '@contracts/query-input.interface';
import type { QueryResult } from '@contracts/query-result.interface';
import type {
  OperatorsConfig,
  PaginationConfig,
} from '@contracts/query-builder-config.interface';
import type { RestQueryAdapter } from '@contracts/rest-query-adapter.interface';
import type {
  PrismaSource,
  PrismaRelation,
} from '@contracts/prisma-source.interface';
import {
  FIELDS_ON_RELATION,
  FIELD_NOT_ALLOWED,
  INVALID_FIELD_FORMAT,
  INVALID_FILTER_FORMAT,
  INVALID_PRISMA_SOURCE,
  OPERATOR_BETWEEN_VALUES,
  OPERATOR_ISNULL_BOOLEAN,
  OPERATOR_NOT_ALLOWED,
  OPERATOR_NOT_IMPLEMENTED,
  OPERATOR_ON_RELATION,
  OPERATOR_VALUE_ARRAY_REQUIRED,
  OPERATOR_VALUE_REQUIRED,
  PAGE_MUST_BE_POSITIVE,
  PER_PAGE_MUST_BE_POSITIVE,
  PRISMA_SOURCE_MISSING_CLIENT,
  PRISMA_SOURCE_MISSING_MODEL,
  SEARCH_ON_RELATION,
  SORT_ON_RELATION_DIRECT,
  SORT_THROUGH_MANY,
  UNKNOWN_RELATION,
  UNSUPPORTED_OPERATOR,
} from '@contracts/error-messages';
import type { QueryOperator } from '@domain/operators/operator.types';
import { operatorRegistry } from '@domain/operators/operator.registry';
import {
  isSafeFieldPath,
  parseCSV,
  coerceValue,
  coerceForIn,
  coerceForBetween,
  toBool,
  parseIntParam,
} from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';

/**
 * Internal accumulator that the Prisma adapter mutates across the
 * apply* phases. The final `findMany` / `count` arguments are built from
 * this object inside `applyPagination` / `getMany` so customization (and
 * the post-customize snapshot guarantee for paginated queries) is honored.
 *
 * Repeated filters always stack under `where.AND`, never structurally merge.
 */
export interface PrismaQB {
  source: PrismaSource;
  alias: string;
  where: { AND: any[] };
  orderBy: any[];
  include?: Record<string, any>;
  select?: Record<string, any>;
}

interface PathHop {
  name: string;
  cardinality: 'one' | 'many';
  meta: PrismaRelation;
}

interface ResolvedPath {
  hops: PathHop[];
  leafField: string;
  /** True only when the entire path resolves to a relation node (used for `isNull` on a relation). */
  leafIsRelation: boolean;
  /** Cardinality of the leaf relation when `leafIsRelation` is true. */
  leafCardinality?: 'one' | 'many';
}

function walkPath(source: PrismaSource, fieldPath: string): ResolvedPath {
  const segments = fieldPath.split('.');
  if (segments.length === 1) {
    const seg = segments[0];
    const relation = source.relations?.[seg];
    if (relation) {
      return {
        hops: [],
        leafField: seg,
        leafIsRelation: true,
        leafCardinality: relation.cardinality ?? 'one',
      };
    }
    return { hops: [], leafField: seg, leafIsRelation: false };
  }

  const hops: PathHop[] = [];
  let currentRelations: Record<string, PrismaRelation> | undefined =
    source.relations;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const relation = currentRelations?.[seg];
    if (!relation) {
      throw new BadRequestException(UNKNOWN_RELATION(seg, fieldPath));
    }
    hops.push({
      name: seg,
      cardinality: relation.cardinality ?? 'one',
      meta: relation,
    });
    currentRelations = relation.relations;
  }

  const leafField = segments[segments.length - 1];
  return { hops, leafField, leafIsRelation: false };
}

function translateOperator(
  operator: QueryOperator,
  value: unknown,
  isRelationLeaf: boolean
): unknown {
  switch (operator) {
    case 'eq':
      return { equals: value };
    case 'ne':
      return { not: value };
    case 'gt':
      return { gt: value };
    case 'gte':
      return { gte: value };
    case 'lt':
      return { lt: value };
    case 'lte':
      return { lte: value };
    case 'like':
      return { contains: value };
    case 'ilike':
      return { contains: value, mode: 'insensitive' };
    case 'notLike':
      return { not: { contains: value } };
    case 'notIlike':
      return { not: { contains: value, mode: 'insensitive' } };
    case 'in':
      return { in: value as unknown[] };
    case 'notIn':
      return { notIn: value as unknown[] };
    case 'between': {
      const [a, b] = value as [unknown, unknown];
      return { gte: a, lte: b };
    }
    case 'isNull':
      // Relation leaves use `is`/`isNot`; Prisma rejects `not` on relations.
      if (isRelationLeaf) {
        return value === true ? { is: null } : { isNot: null };
      }
      return value === true ? null : { not: null };
    default: {
      const _exhaustive: never = operator;
      throw new BadRequestException(OPERATOR_NOT_IMPLEMENTED(_exhaustive));
    }
  }
}

function coerceValueForOperator(operator: QueryOperator, raw: any): any {
  switch (operator) {
    case 'in':
    case 'notIn':
      return coerceForIn(raw);
    case 'between':
      return coerceForBetween(raw);
    case 'isNull':
      return toBool(raw, false);
    default:
      return coerceValue(raw);
  }
}

function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'false', '1', '0'].includes(normalized);
  }
  return false;
}

function validateOperatorValue(
  fieldPath: string,
  operator: QueryOperator,
  value: unknown
): void {
  if (value === undefined) {
    throw new BadRequestException(OPERATOR_VALUE_REQUIRED(fieldPath, operator));
  }

  if (operator === 'in' || operator === 'notIn') {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(
        OPERATOR_VALUE_ARRAY_REQUIRED(fieldPath, operator)
      );
    }
    if (value.some((item) => item === undefined)) {
      throw new BadRequestException(
        OPERATOR_VALUE_REQUIRED(fieldPath, operator)
      );
    }
  }

  if (operator === 'between') {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      value.some((item) => item === undefined)
    ) {
      throw new BadRequestException(OPERATOR_BETWEEN_VALUES(fieldPath));
    }
  }
}

function buildRelationAwareWhere(
  hops: PathHop[],
  leafKey: string,
  leafFragment: unknown
): Record<string, unknown> {
  let inner: Record<string, unknown> = { [leafKey]: leafFragment };
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i];
    inner =
      hop.cardinality === 'many'
        ? { [hop.name]: { some: inner } }
        : { [hop.name]: inner };
  }
  return inner;
}

function buildRelationLeafWhere(
  fieldPath: string,
  cardinality: 'one' | 'many',
  operator: QueryOperator,
  value: unknown
): Record<string, unknown> {
  if (operator !== 'isNull') {
    throw new BadRequestException(OPERATOR_ON_RELATION(operator, fieldPath));
  }
  // many-rel: filter[<rel>][isNull]=true   → roots with NO related row
  //           filter[<rel>][isNull]=false  → roots with at least one
  // Equivalent to TypeORM's `LEFT JOIN ... WHERE rel.id IS [NOT] NULL`.
  if (cardinality === 'many') {
    return value === true
      ? { [fieldPath]: { none: {} } }
      : { [fieldPath]: { some: {} } };
  }
  const fragment = translateOperator('isNull', value, true);
  return { [fieldPath]: fragment };
}

function mergeIncludeTree(
  target: Record<string, any>,
  segments: string[]
): void {
  if (segments.length === 0) return;
  const [head, ...rest] = segments;
  const existing = target[head];
  if (rest.length === 0) {
    // Only set to `true` if there's nothing more specific already there.
    if (existing === undefined) {
      target[head] = true;
    }
    return;
  }
  if (existing === undefined || existing === true) {
    target[head] = { include: {} };
  }
  if (target[head].include === undefined) {
    target[head].include = {};
  }
  mergeIncludeTree(target[head].include, rest);
}

function getRelationByPath(
  source: PrismaSource,
  pathSegments: string[]
): PrismaRelation | undefined {
  let current: Record<string, PrismaRelation> | undefined = source.relations;
  let relation: PrismaRelation | undefined;
  for (const seg of pathSegments) {
    relation = current?.[seg];
    if (!relation) return undefined;
    current = relation.relations;
  }
  return relation;
}

/**
 * Recursively converts an `include` tree (from `applyIncludes`) into a
 * `select` tree, reducing each included relation to its primary key.
 * Existing entries in `selectTarget` (from dotted-field selections) are
 * preserved and merged with the auto-injected PK.
 */
function mergeIncludeIntoSelect(
  includeTree: Record<string, any>,
  selectTarget: Record<string, any>,
  source: PrismaSource,
  pathSoFar: string[]
): void {
  for (const [key, value] of Object.entries(includeTree)) {
    const relation = getRelationByPath(source, [...pathSoFar, key]);
    if (!relation) {
      throw new BadRequestException(
        UNKNOWN_RELATION(key, [...pathSoFar, key].join('.'))
      );
    }
    const pk = relation.primaryKeyField ?? 'id';

    // Existing select entry shape: undefined | { select: {...} }
    let existing: { select: Record<string, any> } | undefined =
      selectTarget[key];
    if (!existing) {
      existing = { select: {} };
      selectTarget[key] = existing;
    } else if (!existing.select) {
      existing.select = {};
    }
    // Auto-inject PK.
    if (existing.select[pk] === undefined) {
      existing.select[pk] = true;
    }

    // Recurse into nested includes, if any.
    if (value && typeof value === 'object' && value.include) {
      mergeIncludeIntoSelect(value.include, existing.select, source, [
        ...pathSoFar,
        key,
      ]);
    }
  }
}

function setNestedSelect(
  selectRoot: Record<string, any>,
  hops: PathHop[],
  leafField: string
): void {
  let current = selectRoot;
  for (const hop of hops) {
    if (current[hop.name] === undefined) {
      current[hop.name] = { select: {} };
    } else if (current[hop.name] === true) {
      current[hop.name] = { select: {} };
    } else if (!current[hop.name].select) {
      current[hop.name].select = {};
    }
    current = current[hop.name].select;
  }
  current[leafField] = true;
}

function buildOrderByEntry(
  hops: PathHop[],
  leafField: string,
  direction: 'asc' | 'desc'
): Record<string, any> {
  let inner: Record<string, any> = { [leafField]: direction };
  for (let i = hops.length - 1; i >= 0; i--) {
    inner = { [hops[i].name]: inner };
  }
  return inner;
}

function buildFindManyArgs(
  qb: PrismaQB,
  pagination?: { take: number; skip: number }
): Record<string, any> {
  const args: Record<string, any> = {};
  const where = compactWhere(qb.where);
  if (where !== undefined) args.where = where;
  if (qb.orderBy.length > 0) args.orderBy = qb.orderBy;
  if (qb.select) {
    args.select = qb.select;
  } else if (qb.include) {
    args.include = qb.include;
  }
  if (pagination) {
    args.take = pagination.take;
    args.skip = pagination.skip;
  }
  return args;
}

/**
 * Strip empty `AND: []` so generated args look natural in Prisma logs and
 * `count` calls don't carry a meaningless wrapper.
 */
function compactWhere(where: { AND: any[] }): Record<string, any> | undefined {
  if (where.AND.length === 0) return undefined;
  if (where.AND.length === 1) return where.AND[0];
  return { AND: where.AND };
}

/**
 * Adapter for Prisma. Implements the full `RestQueryAdapter` contract,
 * translating the existing REST query grammar into nested `where`,
 * `orderBy`, `include`, and `select` shapes that `prisma[model].findMany`
 * understands.
 *
 * Filters/searches that traverse to-many relations wrap each `'many'`
 * hop in `some` so the semantics ("any related row matches") match the
 * existing TypeORM/Drizzle behavior.
 *
 * `select` and `include` are reconciled inside `applyFields` because
 * Prisma rejects both at the same level.
 */
export class PrismaAdapter implements RestQueryAdapter<
  PrismaQB,
  PrismaSource<any>
> {
  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@prisma/client');
    } catch {
      throw new Error(
        'PrismaAdapter requires "@prisma/client" to be installed. Run: pnpm add @prisma/client && pnpm add -D prisma'
      );
    }
  }

  createQueryBuilder(source: PrismaSource<any>, alias: string): PrismaQB {
    if (!source || typeof source !== 'object') {
      throw new BadRequestException(INVALID_PRISMA_SOURCE);
    }
    if (!source.prisma) {
      throw new BadRequestException(PRISMA_SOURCE_MISSING_CLIENT);
    }
    if (!source.model || typeof source.model !== 'string') {
      throw new BadRequestException(PRISMA_SOURCE_MISSING_MODEL);
    }
    return {
      source,
      alias,
      where: { AND: [] },
      orderBy: [],
    };
  }

  applyFilters(
    qb: PrismaQB,
    query: QueryInput,
    _alias: string,
    allowedFilters: string[],
    operatorsConfig?: OperatorsConfig,
    logger?: DQBLogger
  ): void {
    const log = logger?.withContext('applyFilters') ?? DQBLogger.noop();
    const filterParam = query.filter;
    if (!filterParam || typeof filterParam !== 'object') return;

    const entries = Object.entries(filterParam);
    log.debug('processing filters', {
      count: entries.length,
      fields: Object.keys(filterParam),
    });

    const invalidFields: string[] = [];

    for (const [field, valueOrOps] of entries) {
      if (!isSafeFieldPath(field)) {
        throw new BadRequestException(INVALID_FIELD_FORMAT('filter', [field]));
      }

      const rootField = field.includes('.') ? field.split('.')[0] : field;
      const isAllowed = field.includes('.')
        ? allowedFilters.includes(rootField) || allowedFilters.includes(field)
        : allowedFilters.includes(field);

      if (!isAllowed) {
        invalidFields.push(field);
        continue;
      }

      if (typeof valueOrOps === 'string' || typeof valueOrOps === 'number') {
        this.applySingleFilter(qb, field, 'eq', valueOrOps, operatorsConfig);
        continue;
      }

      if (typeof valueOrOps === 'object' && valueOrOps !== null) {
        for (const [op, value] of Object.entries(valueOrOps)) {
          if (!operatorRegistry[op as QueryOperator]) {
            throw new BadRequestException(
              UNSUPPORTED_OPERATOR(op, field, Object.keys(operatorRegistry))
            );
          }
          this.applySingleFilter(
            qb,
            field,
            op as QueryOperator,
            value,
            operatorsConfig
          );
        }
        continue;
      }

      throw new BadRequestException(INVALID_FILTER_FORMAT(field));
    }

    if (invalidFields.length > 0) {
      const unique = Array.from(new Set(invalidFields));
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('filter', unique, allowedFilters)
      );
    }
  }

  private applySingleFilter(
    qb: PrismaQB,
    fieldPath: string,
    operator: QueryOperator,
    rawValue: any,
    operatorsConfig?: OperatorsConfig
  ): void {
    if (operatorsConfig?.allowed !== undefined) {
      if (!operatorsConfig.allowed.includes(operator)) {
        throw new BadRequestException(
          OPERATOR_NOT_ALLOWED(operator, operatorsConfig.allowed)
        );
      }
    }

    if (operator === 'isNull' && !isBooleanLike(rawValue)) {
      throw new BadRequestException(OPERATOR_ISNULL_BOOLEAN(fieldPath));
    }

    const value = coerceValueForOperator(operator, rawValue);

    // Empty in/notIn is a no-op, matching TypeORM and Drizzle. Bail
    // before validateOperatorValue so the empty array doesn't trip the
    // non-empty-array guard.
    if (
      (operator === 'in' || operator === 'notIn') &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      return;
    }

    validateOperatorValue(fieldPath, operator, value);

    const resolved = walkPath(qb.source, fieldPath);

    if (resolved.leafIsRelation) {
      const fragment = buildRelationLeafWhere(
        resolved.leafField,
        resolved.leafCardinality ?? 'one',
        operator,
        value
      );
      qb.where.AND.push(fragment);
      return;
    }

    const leafFragment = translateOperator(operator, value, false);
    const fragment = buildRelationAwareWhere(
      resolved.hops,
      resolved.leafField,
      leafFragment
    );
    qb.where.AND.push(fragment);
  }

  applySorts(
    qb: PrismaQB,
    query: QueryInput,
    _alias: string,
    allowedSorts: string[],
    allowedFields?: string[],
    logger?: DQBLogger
  ): void {
    const log = logger?.withContext('applySorts') ?? DQBLogger.noop();
    if (!query.sort || typeof query.sort !== 'string') return;

    const tokens = parseCSV(query.sort);
    if (tokens.length === 0) return;
    log.debug('processing sorts', { count: tokens.length });

    const invalid: string[] = [];

    for (const token of tokens) {
      const direction: 'asc' | 'desc' = token.startsWith('-') ? 'desc' : 'asc';
      const path = token.startsWith('-') ? token.slice(1) : token;

      if (!isSafeFieldPath(path)) {
        throw new BadRequestException(INVALID_FIELD_FORMAT('sort', [path]));
      }

      const rootField = path.includes('.') ? path.split('.')[0] : path;
      const allowedBySort = path.includes('.')
        ? allowedSorts.includes(rootField) || allowedSorts.includes(path)
        : allowedSorts.includes(path);
      const allowedByField =
        allowedFields?.includes(rootField) || allowedFields?.includes(path);

      if (!allowedBySort && !allowedByField) {
        invalid.push(path);
        continue;
      }

      const resolved = walkPath(qb.source, path);
      if (resolved.hops.some((h) => h.cardinality === 'many')) {
        throw new BadRequestException(SORT_THROUGH_MANY(path));
      }
      if (resolved.leafIsRelation) {
        throw new BadRequestException(SORT_ON_RELATION_DIRECT(path));
      }

      qb.orderBy.push(
        buildOrderByEntry(resolved.hops, resolved.leafField, direction)
      );
    }

    if (invalid.length > 0) {
      const unique = Array.from(new Set(invalid));
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('sort', unique, allowedSorts)
      );
    }
  }

  applyIncludes(
    qb: PrismaQB,
    query: QueryInput,
    _alias: string,
    allowedIncludes: string[],
    logger?: DQBLogger
  ): void {
    const log = logger?.withContext('applyIncludes') ?? DQBLogger.noop();
    if (!query.includes || typeof query.includes !== 'string') return;

    const tokens = parseCSV(query.includes);
    if (tokens.length === 0) return;
    log.debug('processing includes', { count: tokens.length });

    // Process longer paths first so a more-specific entry isn't clobbered
    // by a later top-level `true`.
    const sorted = [...tokens].sort(
      (a, b) => b.split('.').length - a.split('.').length
    );

    const invalid: string[] = [];
    qb.include = qb.include ?? {};

    for (const path of sorted) {
      if (!isSafeFieldPath(path)) {
        throw new BadRequestException(INVALID_FIELD_FORMAT('includes', [path]));
      }

      const rootField = path.includes('.') ? path.split('.')[0] : path;
      const isAllowed = path.includes('.')
        ? allowedIncludes.includes(rootField) || allowedIncludes.includes(path)
        : allowedIncludes.includes(path);

      if (!isAllowed) {
        invalid.push(path);
        continue;
      }

      const segments = path.split('.');
      // Validate every hop exists in the relations metadata.
      let cursor: Record<string, PrismaRelation> | undefined =
        qb.source.relations;
      for (const seg of segments) {
        const rel = cursor?.[seg];
        if (!rel) {
          throw new BadRequestException(UNKNOWN_RELATION(seg, path));
        }
        cursor = rel.relations;
      }

      mergeIncludeTree(qb.include, segments);
    }

    if (invalid.length > 0) {
      const unique = Array.from(new Set(invalid));
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('includes', unique, allowedIncludes)
      );
    }
  }

  applySearch(
    qb: PrismaQB,
    query: QueryInput,
    _alias: string,
    searchFields: string[],
    logger?: DQBLogger
  ): void {
    const log = logger?.withContext('applySearch') ?? DQBLogger.noop();
    if (!query.search || typeof query.search !== 'string') return;
    const term = query.search.trim();
    if (!term) return;
    if (searchFields.length === 0) return;
    log.debug('processing search', { term, fields: searchFields.length });

    const orFragments: Record<string, unknown>[] = [];
    for (const field of searchFields) {
      if (!isSafeFieldPath(field)) {
        throw new BadRequestException(INVALID_FIELD_FORMAT('search', [field]));
      }
      const resolved = walkPath(qb.source, field);
      if (resolved.leafIsRelation) {
        throw new BadRequestException(SEARCH_ON_RELATION(field));
      }
      const leaf = { contains: term, mode: 'insensitive' };
      orFragments.push(
        buildRelationAwareWhere(resolved.hops, resolved.leafField, leaf)
      );
    }

    if (orFragments.length > 0) {
      qb.where.AND.push({ OR: orFragments });
    }
  }

  applyFields(
    qb: PrismaQB,
    query: QueryInput,
    _alias: string,
    allowedFields: string[],
    _allowedIncludes?: string[],
    logger?: DQBLogger
  ): void {
    const log = logger?.withContext('applyFields') ?? DQBLogger.noop();
    if (!query.fields || typeof query.fields !== 'string') return;

    const tokens = parseCSV(query.fields);
    if (tokens.length === 0) return;
    log.debug('processing fields', { count: tokens.length });

    const select: Record<string, any> = {};
    const rootPk = qb.source.primaryKeyField ?? 'id';
    select[rootPk] = true;

    const invalid: string[] = [];

    for (const path of tokens) {
      if (!isSafeFieldPath(path)) {
        throw new BadRequestException(INVALID_FIELD_FORMAT('fields', [path]));
      }

      const rootField = path.includes('.') ? path.split('.')[0] : path;
      const isAllowed = path.includes('.')
        ? allowedFields.includes(rootField) || allowedFields.includes(path)
        : allowedFields.includes(path);

      if (!isAllowed) {
        invalid.push(path);
        continue;
      }

      if (!path.includes('.')) {
        const resolved = walkPath(qb.source, path);
        if (resolved.leafIsRelation) {
          throw new BadRequestException(FIELDS_ON_RELATION(path));
        }
        select[path] = true;
        continue;
      }

      const resolved = walkPath(qb.source, path);
      if (resolved.leafIsRelation) {
        throw new BadRequestException(FIELDS_ON_RELATION(path));
      }
      setNestedSelect(select, resolved.hops, resolved.leafField);
    }

    if (invalid.length > 0) {
      const unique = Array.from(new Set(invalid));
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('fields', unique, allowedFields)
      );
    }

    // Reconcile any prior `include` state into `select` form. Prisma rejects
    // both at the same level, so once we choose `select`, included relations
    // must move under it as nested `select` trees with their PK injected.
    if (qb.include) {
      mergeIncludeIntoSelect(qb.include, select, qb.source, []);
      qb.include = undefined;
    }

    qb.select = select;
  }

  async applyPagination<T = unknown>(
    qb: PrismaQB,
    query: QueryInput,
    paginationConfig?: PaginationConfig,
    logger?: DQBLogger
  ): Promise<QueryResult<T>> {
    const log = logger?.withContext('applyPagination') ?? DQBLogger.noop();
    const defaultPerPage = paginationConfig?.defaultPerPage ?? 10;
    const maxPerPage = paginationConfig?.maxPerPage ?? 100;

    const page = parseIntParam(query.page, 'page', 1);
    const requested = parseIntParam(query.perPage, 'perPage', defaultPerPage);
    const perPage = Math.min(requested, maxPerPage);
    if (page < 1) throw new BadRequestException(PAGE_MUST_BE_POSITIVE);
    if (perPage < 1) throw new BadRequestException(PER_PAGE_MUST_BE_POSITIVE);

    const skip = (page - 1) * perPage;
    log.debug('executing paginated query', { page, perPage, skip });

    // Build args here, AFTER customize had its chance to mutate `qb`.
    // Both findMany and count must read from the same post-customize `where`.
    const findArgs = buildFindManyArgs(qb, { take: perPage, skip });
    const countArgs: Record<string, any> = {};
    const compactedWhere = compactWhere(qb.where);
    if (compactedWhere !== undefined) countArgs.where = compactedWhere;

    const delegate = this.getDelegate(qb);
    const [data, total] = await Promise.all([
      delegate.findMany(findArgs),
      delegate.count(countArgs),
    ]);

    const lastPage = Math.max(1, Math.ceil(total / perPage));
    log.debug('pagination result', { total, lastPage, count: data.length });

    return { data: data as T[], page, perPage, total, lastPage };
  }

  async getMany<T = unknown>(qb: PrismaQB): Promise<T[]> {
    const args = buildFindManyArgs(qb);
    const delegate = this.getDelegate(qb);
    const rows = await delegate.findMany(args);
    return rows as T[];
  }

  customize(qb: PrismaQB, fn: (qb: PrismaQB) => void): void {
    fn(qb);
  }

  private getDelegate(qb: PrismaQB): {
    findMany(args: Record<string, any>): Promise<unknown[]>;
    count(args: Record<string, any>): Promise<number>;
  } {
    const delegate = (qb.source.prisma as any)?.[qb.source.model];
    if (
      !delegate ||
      typeof delegate.findMany !== 'function' ||
      typeof delegate.count !== 'function'
    ) {
      throw new Error(
        `PrismaAdapter: model "${qb.source.model}" not found on the provided Prisma client (expected prisma.${qb.source.model}.findMany / .count to be functions).`
      );
    }
    return delegate;
  }
}
