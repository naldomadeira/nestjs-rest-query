/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  notIlike,
  notInArray,
  notLike,
  or,
  type AnyColumn,
  type SQL,
  type Table,
} from 'drizzle-orm';

import type {
  DrizzleRelation,
  DrizzleSource,
} from '@contracts/drizzle-source.interface';
import type { QueryInput } from '@contracts/query-input.interface';
import type { QueryResult } from '@contracts/query-result.interface';
import type {
  OperatorsConfig,
  PaginationConfig,
} from '@contracts/query-builder-config.interface';
import type { RestQueryAdapter } from '@contracts/rest-query-adapter.interface';
import {
  FIELD_NOT_ALLOWED,
  INVALID_DATE_VALUE,
  INVALID_FIELD_FORMAT,
  INVALID_FILTER_FORMAT,
  NO_RELATION_REGISTERED,
  OPERATOR_NOT_ALLOWED,
  PAGE_MUST_BE_POSITIVE,
  PER_PAGE_MUST_BE_POSITIVE,
  SORT_NOT_IN_FIELDS,
  SORT_THROUGH_MANY,
  UNKNOWN_COLUMN_RELATION,
  UNKNOWN_COLUMN_ROOT,
  UNSUPPORTED_OPERATOR,
} from '@contracts/error-messages';
import { ALL_OPERATORS, QueryOperator } from '@domain/operators/operator.types';
import {
  coerceForBetween,
  coerceForIn,
  coerceValue,
  isSafeFieldPath,
  parseCSV,
  parseIntParam,
  toBool,
} from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';

// =====================================================================
// Internal types
// =====================================================================

type JoinReason = 'where' | 'presentation';

type JoinEntry = { table: Table; on: SQL; cardinality: 'one' | 'many' };

/**
 * Internal accumulator passed through `applyX` calls. NOT exported as
 * the public adapter type — see `DrizzleQB` below for the consumer
 * surface.
 */
interface DrizzleQBState {
  source: DrizzleSource<Table, unknown>;
  alias: string;
  whereClauses: SQL[];
  orderByClauses: SQL[];
  sortEntries: Array<{ column: AnyColumn; dir: 'ASC' | 'DESC' }>;
  /**
   * When set, the adapter emits a table-grouped projection instead of
   * the default full-row select. Root columns + per-relation columns.
   */
  selectFields?: {
    rootColumns: AnyColumn[];
    relationColumns: Map<string, AnyColumn[]>;
  };
  /** Joins required to evaluate WHERE — included in BOTH data and count queries. */
  whereJoins: Map<string, JoinEntry>;
  /** Joins only needed for SELECT / ORDER BY / consumer includes — data query ONLY. */
  presentationJoins: Map<string, JoinEntry>;
  logger?: DQBLogger;
}

/**
 * Public alias so consumers can type their `customize` callback:
 * ```ts
 * service.execute<MyRow, DrizzleQB>(source, query, rules, (qb) => { ... })
 * ```
 */
export type DrizzleQB = DrizzleQBState;

// =====================================================================
// Helpers
// =====================================================================

/** `company.owner` → `company_owner`. Stable, JS-identifier-safe. */
function sanitizeKey(joinPath: string): string {
  return joinPath.replace(/\./g, '_');
}

/**
 * Construction-time validation. Throws synchronously on invalid
 * `relations` map. Called from `createQueryBuilder`.
 */
function validateRelations(source: DrizzleSource<Table, unknown>): void {
  if (!source.relations) return;
  for (const [path, rel] of Object.entries(source.relations)) {
    if (rel.cardinality === 'many' && !rel.primaryKey) {
      throw new Error(
        `DrizzleAdapter: relation "${path}" has cardinality 'many' but no primaryKey. ` +
          `'many' relations require relations["${path}"].primaryKey for deduplication. ` +
          `If this is a 1:1 relation, change cardinality to 'one' (or omit it).`
      );
    }
  }
}

function relationFor(
  qb: DrizzleQBState,
  joinPath: string
): DrizzleRelation | undefined {
  return qb.source.relations?.[joinPath];
}

function ensureJoin(
  qb: DrizzleQBState,
  joinPath: string,
  reason: JoinReason
): void {
  const rel = relationFor(qb, joinPath);
  if (!rel) {
    throw new BadRequestException(NO_RELATION_REGISTERED(joinPath));
  }
  const entry: JoinEntry = {
    table: rel.table,
    on: rel.on,
    cardinality: rel.cardinality === 'many' ? 'many' : 'one',
  };

  if (reason === 'where') {
    if (qb.whereJoins.has(joinPath)) return;
    // Promote: presentation → where (count query needs the join now).
    qb.presentationJoins.delete(joinPath);
    qb.whereJoins.set(joinPath, entry);
    return;
  }

  if (qb.whereJoins.has(joinPath)) return;
  if (qb.presentationJoins.has(joinPath)) return;
  qb.presentationJoins.set(joinPath, entry);
}

/**
 * Resolve a dot-notation field path to an `AnyColumn`. Side effect:
 * ensures the prefix join is present in `qb` for the given reason.
 */
function resolveDottedField(
  qb: DrizzleQBState,
  fieldPath: string,
  reason: JoinReason
): AnyColumn {
  // 1. Direct lookup in columnMap (most specific).
  const mapped = qb.source.columnMap?.[fieldPath];
  if (mapped) {
    if (fieldPath.includes('.')) {
      const joinPath = fieldPath.split('.').slice(0, -1).join('.');
      ensureJoin(qb, joinPath, reason);
    }
    return mapped;
  }

  // 2. Single-segment → root table column.
  if (!fieldPath.includes('.')) {
    const col = (qb.source.table as any)[fieldPath];
    if (!col) {
      throw new BadRequestException(UNKNOWN_COLUMN_ROOT(fieldPath));
    }
    return col as AnyColumn;
  }

  // 3. Dotted → ensure prefix join, return final column from joined table.
  const parts = fieldPath.split('.');
  const last = parts[parts.length - 1];
  const joinPath = parts.slice(0, -1).join('.');
  ensureJoin(qb, joinPath, reason);

  const rel = qb.source.relations![joinPath];
  const col = (rel.table as any)[last];
  if (!col) {
    throw new BadRequestException(
      UNKNOWN_COLUMN_RELATION(last, joinPath, fieldPath)
    );
  }
  return col as AnyColumn;
}

function coerceValueForOperator(
  operator: QueryOperator,
  raw: unknown
): unknown {
  switch (operator) {
    case 'in':
    case 'notIn':
      return coerceForIn(raw as string);
    case 'between':
      return coerceForBetween(raw as string);
    case 'isNull':
      return toBool(raw, false);
    default:
      return coerceValue(raw as string);
  }
}

function isTemporalColumn(column: AnyColumn): boolean {
  const candidate = column as any;
  const dataType = candidate?.dataType ?? candidate?._?.dataType;
  const columnType = candidate?.columnType ?? candidate?._?.columnType;

  return (
    dataType === 'date' ||
    (typeof columnType === 'string' &&
      /(Date|Timestamp|Datetime)/.test(columnType))
  );
}

function coerceTemporalValue(raw: unknown): Date | unknown {
  if (raw === null || raw === undefined || raw instanceof Date) return raw;

  if (typeof raw === 'string' || typeof raw === 'number') {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(INVALID_DATE_VALUE(String(raw)));
    }
    return date;
  }

  return raw;
}

function coerceValueForColumn(
  column: AnyColumn,
  operator: QueryOperator,
  raw: unknown
): unknown {
  const value = coerceValueForOperator(operator, raw);
  if (!isTemporalColumn(column)) return value;

  if (operator === 'between') {
    const [a, b] = value as [unknown, unknown];
    return [coerceTemporalValue(a), coerceTemporalValue(b)] as const;
  }

  if (operator === 'in' || operator === 'notIn') {
    return Array.isArray(value) ? value.map(coerceTemporalValue) : value;
  }

  if (operator === 'isNull') return value;

  return coerceTemporalValue(value);
}

function translateOperator(
  column: AnyColumn,
  operator: QueryOperator,
  value: unknown
): SQL | undefined {
  switch (operator) {
    case 'eq':
      return eq(column, value as never);
    case 'ne':
      return ne(column, value as never);
    case 'gt':
      return gt(column, value as never);
    case 'gte':
      return gte(column, value as never);
    case 'lt':
      return lt(column, value as never);
    case 'lte':
      return lte(column, value as never);
    case 'like':
      return like(column, `%${value as string}%`);
    case 'ilike':
      return ilike(column, `%${value as string}%`);
    case 'notLike':
      return notLike(column, `%${value as string}%`);
    case 'notIlike':
      return notIlike(column, `%${value as string}%`);
    case 'in':
      return inArray(column, value as unknown[]);
    case 'notIn':
      return notInArray(column, value as unknown[]);
    case 'between': {
      const [a, b] = value as [unknown, unknown];
      return and(gte(column, a as never), lte(column, b as never));
    }
    case 'isNull':
      // value=true → IS NULL; value=false → IS NOT NULL.
      return value === true ? isNull(column) : isNotNull(column);
    default:
      return undefined;
  }
}

// =====================================================================
// Adapter
// =====================================================================

/**
 * Drizzle ORM adapter for `nestjs-rest-query`. Translates parsed REST
 * query input into a `db.select().from(table).$dynamic()` pipeline,
 * with auto-join for dotted paths and two-phase pagination for 1:N
 * relations.
 *
 * Source contract: `DrizzleSource<TTable, TDb>` — see
 * `src/contracts/drizzle-source.interface.ts` for the full shape.
 */
export class DrizzleAdapter implements RestQueryAdapter<
  DrizzleQBState,
  DrizzleSource<Table, unknown>
> {
  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('drizzle-orm');
    } catch {
      throw new Error(
        'DrizzleAdapter requires "drizzle-orm" to be installed. Run: pnpm add drizzle-orm'
      );
    }
  }

  // ------------------------------------------------------------------
  // RestQueryAdapter implementation
  // ------------------------------------------------------------------

  createQueryBuilder(
    source: DrizzleSource<Table, unknown>,
    alias: string
  ): DrizzleQBState {
    validateRelations(source);
    return {
      source,
      alias,
      whereClauses: [],
      orderByClauses: [],
      sortEntries: [],
      selectFields: undefined,
      whereJoins: new Map(),
      presentationJoins: new Map(),
    };
  }

  applyFilters(
    qb: DrizzleQBState,
    query: QueryInput,
    alias: string,
    allowedFilters: string[],
    operatorsConfig?: OperatorsConfig,
    logger?: DQBLogger
  ): void {
    const log =
      logger?.withContext('DrizzleAdapter.applyFilters') ?? DQBLogger.noop();
    const filterParam = query.filter;
    if (!filterParam || typeof filterParam !== 'object') return;

    const entries = Object.entries(filterParam);
    log.debug('processing filters', { count: entries.length });

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
        this.pushFilter(qb, field, 'eq', valueOrOps, operatorsConfig);
        continue;
      }

      if (typeof valueOrOps === 'object' && valueOrOps !== null) {
        for (const [op, raw] of Object.entries(valueOrOps)) {
          if (!this.isKnownOperator(op)) {
            throw new BadRequestException(
              UNSUPPORTED_OPERATOR(op, field, ALL_OPERATORS)
            );
          }
          this.pushFilter(qb, field, op as QueryOperator, raw, operatorsConfig);
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

  applySorts(
    qb: DrizzleQBState,
    query: QueryInput,
    alias: string,
    allowedSorts: string[],
    allowedFields?: string[],
    logger?: DQBLogger
  ): void {
    const log =
      logger?.withContext('DrizzleAdapter.applySorts') ?? DQBLogger.noop();
    const sortValue = query.sort;
    if (!sortValue || typeof sortValue !== 'string') return;

    const tokens = parseCSV(sortValue).map((t) => {
      const isDesc = t.startsWith('-');
      return {
        field: isDesc ? t.slice(1) : t,
        dir: isDesc ? ('DESC' as const) : ('ASC' as const),
      };
    });
    if (tokens.length === 0) return;

    // Validation: safe paths + allowedSorts list.
    const unsafe: string[] = [];
    const notAllowed: string[] = [];
    for (const { field } of tokens) {
      if (!isSafeFieldPath(field)) unsafe.push(field);
      else {
        const root = field.split('.')[0];
        if (!allowedSorts.includes(field) && !allowedSorts.includes(root))
          notAllowed.push(field);
      }
    }
    if (unsafe.length)
      throw new BadRequestException(INVALID_FIELD_FORMAT('sort', unsafe));
    if (notAllowed.length)
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('sort', notAllowed, allowedSorts)
      );

    // Optional consistency vs allowedFields.
    if (allowedFields && allowedFields.length > 0) {
      const outside = tokens
        .map((t) => t.field)
        .filter((f) => !f.includes('.') && !allowedFields.includes(f));
      if (outside.length)
        throw new BadRequestException(
          SORT_NOT_IN_FIELDS(outside, allowedFields)
        );
    }

    const seen = new Set<string>();
    for (const { field, dir } of tokens) {
      if (seen.has(field)) continue;
      seen.add(field);

      // Reject ORDER BY through 'many' relations (semantic ambiguity under DISTINCT collapse).
      if (field.includes('.')) {
        const joinPath = field.split('.').slice(0, -1).join('.');
        const rel = qb.source.relations?.[joinPath];
        if (rel?.cardinality === 'many') {
          throw new BadRequestException(SORT_THROUGH_MANY(field));
        }
      }

      const column = resolveDottedField(qb, field, 'presentation');
      qb.orderByClauses.push(dir === 'DESC' ? desc(column) : asc(column));
      qb.sortEntries.push({ column, dir });
    }
    log.debug('sorts resolved', { count: seen.size });
  }

  applyIncludes(
    qb: DrizzleQBState,
    query: QueryInput,
    alias: string,
    allowedIncludes: string[],
    logger?: DQBLogger
  ): void {
    const log =
      logger?.withContext('DrizzleAdapter.applyIncludes') ?? DQBLogger.noop();
    const includeValue = query.includes;
    if (!includeValue || typeof includeValue !== 'string') return;

    const tokens = parseCSV(includeValue);
    if (tokens.length === 0) return;

    const unsafe: string[] = [];
    const notAllowed: string[] = [];
    for (const t of tokens) {
      if (!isSafeFieldPath(t)) unsafe.push(t);
      else {
        const root = t.split('.')[0];
        if (!allowedIncludes.includes(root)) notAllowed.push(t);
      }
    }
    if (unsafe.length)
      throw new BadRequestException(INVALID_FIELD_FORMAT('includes', unsafe));
    if (notAllowed.length)
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('includes', notAllowed, allowedIncludes)
      );

    const unique = Array.from(new Set(tokens));
    log.debug('applying includes', { includes: unique });
    for (const path of unique) ensureJoin(qb, path, 'presentation');
  }

  applySearch(
    qb: DrizzleQBState,
    query: QueryInput,
    alias: string,
    searchFields: string[],
    logger?: DQBLogger
  ): void {
    const log =
      logger?.withContext('DrizzleAdapter.applySearch') ?? DQBLogger.noop();
    const searchValue = query.search;
    if (typeof searchValue !== 'string') return;

    const term = searchValue.trim();
    if (!term) return;

    const fields = Array.from(
      new Set(searchFields.map((f) => f.trim()).filter(Boolean))
    );
    if (fields.length === 0) return;

    const unsafe = fields.filter((f) => !isSafeFieldPath(f));
    if (unsafe.length)
      throw new BadRequestException(INVALID_FIELD_FORMAT('search', unsafe));

    // Escape ILIKE metacharacters so the term is treated literally.
    // Parity with the TypeORM handler at search.handler.ts.
    const escapedTerm = term.replace(/%/g, '\\%').replace(/_/g, '\\_');

    log.debug('applying search', { count: fields.length });
    const clauses = fields.map((f) =>
      ilike(resolveDottedField(qb, f, 'where'), `%${escapedTerm}%`)
    );
    const orClause = or(...clauses);
    if (orClause) qb.whereClauses.push(orClause);
  }

  applyFields(
    qb: DrizzleQBState,
    query: QueryInput,
    alias: string,
    allowedFields: string[],
    allowedIncludes?: string[],
    logger?: DQBLogger
  ): void {
    const log =
      logger?.withContext('DrizzleAdapter.applyFields') ?? DQBLogger.noop();
    const fieldsValue = query.fields;
    if (!fieldsValue || typeof fieldsValue !== 'string') return;

    const tokens = parseCSV(fieldsValue);
    if (tokens.length === 0) return;

    const unsafe: string[] = [];
    const notAllowed: string[] = [];
    for (const t of tokens) {
      if (!isSafeFieldPath(t)) unsafe.push(t);
      else {
        const root = t.split('.')[0];
        if (!allowedFields.includes(root)) notAllowed.push(t);
      }
    }
    if (unsafe.length)
      throw new BadRequestException(INVALID_FIELD_FORMAT('fields', unsafe));
    if (notAllowed.length)
      throw new BadRequestException(
        FIELD_NOT_ALLOWED('fields', notAllowed, allowedFields)
      );

    const unique = Array.from(new Set(tokens));
    const rootColumns: AnyColumn[] = [];
    const relationColumns = new Map<string, AnyColumn[]>();

    for (const f of unique) {
      const col = resolveDottedField(qb, f, 'presentation');
      if (f.includes('.')) {
        const joinPath = f.split('.').slice(0, -1).join('.');
        const list = relationColumns.get(joinPath) ?? [];
        list.push(col);
        relationColumns.set(joinPath, list);
      } else {
        rootColumns.push(col);
      }
    }

    // Auto-inject root primary key (matches TypeORM's fields.handler.ts:68-69 behavior).
    const pk = qb.source.primaryKey;
    if (!rootColumns.some((c) => c === pk)) rootColumns.unshift(pk);

    qb.selectFields = { rootColumns, relationColumns };
    log.debug('fields classified', {
      root: rootColumns.length,
      relations: relationColumns.size,
      includes: allowedIncludes?.length ?? 0,
    });
  }

  async applyPagination<T = unknown>(
    qb: DrizzleQBState,
    query: QueryInput,
    paginationConfig?: PaginationConfig,
    logger?: DQBLogger
  ): Promise<QueryResult<T>> {
    const log =
      logger?.withContext('DrizzleAdapter.applyPagination') ?? DQBLogger.noop();
    const { page, perPage, offset } = parsePagination(query, paginationConfig);

    if (!this.hasManyJoin(qb)) {
      const dataQuery = this.buildDataQuery(qb).limit(perPage).offset(offset);
      const countQuery = this.buildCountQuery(qb);
      const [rows, countRows] = await Promise.all([dataQuery, countQuery]);
      const total = Number(
        (countRows as Array<{ value: number }>)[0]?.value ?? 0
      );
      const lastPage = Math.max(1, Math.ceil(total / perPage));
      log.debug('paginated (single-pass)', { total, perPage, page });
      return {
        data: this.aggregate(qb, rows as any[]) as T[],
        page,
        perPage,
        total,
        lastPage,
      };
    }

    // Two-phase pagination for 1:N joins.
    const idsQuery = this.buildRootIdsQuery(qb).limit(perPage).offset(offset);
    const countQuery = this.buildCountQuery(qb);
    const [rootIdRows, countRows] = await Promise.all([idsQuery, countQuery]);
    const total = Number(
      (countRows as Array<{ value: number }>)[0]?.value ?? 0
    );
    const lastPage = Math.max(1, Math.ceil(total / perPage));

    const pkName = qb.source.primaryKey.name;
    const rootIds = (rootIdRows as Array<Record<string, unknown>>).map(
      (r) => r[pkName]
    );

    if (rootIds.length === 0) {
      log.debug('paginated (two-phase, empty)', { total, perPage, page });
      return { data: [], page, perPage, total, lastPage };
    }

    const dataRows = await this.buildDataQueryForIds(qb, rootIds);
    log.debug('paginated (two-phase)', {
      total,
      perPage,
      page,
      phase2Rows: (dataRows as any[]).length,
    });
    return {
      data: this.aggregate(qb, dataRows as any[], rootIds) as T[],
      page,
      perPage,
      total,
      lastPage,
    };
  }

  async getMany<T = unknown>(qb: DrizzleQBState): Promise<T[]> {
    const rows = await this.buildDataQuery(qb);
    return this.aggregate(qb, rows as any[]) as T[];
  }

  customize(qb: DrizzleQBState, fn: (qb: DrizzleQBState) => void): void {
    fn(qb);
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private isKnownOperator(op: string): op is QueryOperator {
    return [
      'eq',
      'ne',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      'notLike',
      'notIlike',
      'in',
      'notIn',
      'between',
      'isNull',
    ].includes(op);
  }

  private pushFilter(
    qb: DrizzleQBState,
    field: string,
    operator: QueryOperator,
    raw: unknown,
    operatorsConfig?: OperatorsConfig
  ): void {
    if (
      operatorsConfig?.allowed &&
      !operatorsConfig.allowed.includes(operator)
    ) {
      throw new BadRequestException(
        OPERATOR_NOT_ALLOWED(operator, operatorsConfig.allowed)
      );
    }

    const column = resolveDottedField(qb, field, 'where');
    const value = coerceValueForColumn(column, operator, raw);

    // Skip empty IN / NOT IN — matches existing TypeORM handler behavior.
    if (
      (operator === 'in' || operator === 'notIn') &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      return;
    }

    const sql = translateOperator(column, operator, value);
    if (sql) qb.whereClauses.push(sql);
  }

  private hasManyJoin(qb: DrizzleQBState): boolean {
    for (const [, j] of qb.whereJoins)
      if (j.cardinality === 'many') return true;
    for (const [, j] of qb.presentationJoins)
      if (j.cardinality === 'many') return true;
    return false;
  }

  private buildSelectShape(
    qb: DrizzleQBState
  ): Record<string, Record<string, AnyColumn>> {
    if (!qb.selectFields) {
      const shape: Record<string, Record<string, AnyColumn>> = {
        [qb.alias]: getTableColumns(qb.source.table) as Record<
          string,
          AnyColumn
        >,
      };
      const allJoins = new Map<string, JoinEntry>([
        ...qb.whereJoins,
        ...qb.presentationJoins,
      ]);
      for (const [path, j] of allJoins) {
        shape[sanitizeKey(path)] = getTableColumns(j.table) as Record<
          string,
          AnyColumn
        >;
      }
      return shape;
    }

    const shape: Record<string, Record<string, AnyColumn>> = {
      [qb.alias]: Object.fromEntries(
        qb.selectFields.rootColumns.map((c) => [c.name, c])
      ) as Record<string, AnyColumn>,
    };
    for (const [joinPath, cols] of qb.selectFields.relationColumns) {
      shape[sanitizeKey(joinPath)] = Object.fromEntries(
        cols.map((c) => [c.name, c])
      ) as Record<string, AnyColumn>;
    }
    return shape;
  }

  private buildDataQuery(qb: DrizzleQBState) {
    const { db, table } = qb.source;
    const shape = this.buildSelectShape(qb);

    let q: any = (db as any).select(shape).from(table).$dynamic();
    for (const [, j] of qb.whereJoins) q = q.leftJoin(j.table, j.on);
    for (const [, j] of qb.presentationJoins) q = q.leftJoin(j.table, j.on);
    if (qb.whereClauses.length) {
      const composed = and(...qb.whereClauses);
      if (composed) q = q.where(composed);
    }
    for (const o of qb.orderByClauses) q = q.orderBy(o);
    return q;
  }

  private buildCountQuery(qb: DrizzleQBState) {
    const { db, table, primaryKey } = qb.source;
    const hasWhereJoins = qb.whereJoins.size > 0;
    const counter = hasWhereJoins ? countDistinct(primaryKey) : count();

    let q: any = (db as any).select({ value: counter }).from(table).$dynamic();
    if (hasWhereJoins) {
      for (const [, j] of qb.whereJoins) q = q.leftJoin(j.table, j.on);
    }
    if (qb.whereClauses.length) {
      const composed = and(...qb.whereClauses);
      if (composed) q = q.where(composed);
    }
    return q;
  }

  private buildRootIdsQuery(qb: DrizzleQBState) {
    const { db, table, primaryKey } = qb.source;
    const distinctShape: Record<string, AnyColumn> = {
      [primaryKey.name]: primaryKey,
    };
    qb.sortEntries.forEach(({ column }, index) => {
      distinctShape[`__sort_${index}`] = column;
    });

    let q: any = (db as any)
      .selectDistinct(distinctShape)
      .from(table)
      .$dynamic();
    for (const [, j] of qb.whereJoins) q = q.leftJoin(j.table, j.on);
    for (const [, j] of qb.presentationJoins) q = q.leftJoin(j.table, j.on);
    if (qb.whereClauses.length) {
      const composed = and(...qb.whereClauses);
      if (composed) q = q.where(composed);
    }
    for (const o of qb.orderByClauses) q = q.orderBy(o);
    return q;
  }

  private buildDataQueryForIds(qb: DrizzleQBState, rootIds: unknown[]) {
    const { db, table, primaryKey } = qb.source;
    const shape = this.buildSelectShape(qb);

    let q: any = (db as any).select(shape).from(table).$dynamic();
    for (const [, j] of qb.whereJoins) q = q.leftJoin(j.table, j.on);
    for (const [, j] of qb.presentationJoins) q = q.leftJoin(j.table, j.on);
    q = q.where(inArray(primaryKey, rootIds as never[]));
    for (const o of qb.orderByClauses) q = q.orderBy(o);

    // Stability sort: append asc(relationPK) for every 'many' relation so
    // children of the same root land in a deterministic order regardless
    // of the database's natural row ordering. ORDER BY through 'many' is
    // already rejected at applySort, so this can only happen here.
    const allJoins = new Map<string, JoinEntry>([
      ...qb.whereJoins,
      ...qb.presentationJoins,
    ]);
    for (const [path, j] of allJoins) {
      if (j.cardinality !== 'many') continue;
      const relPK = (qb.source.relations![path] as DrizzleRelation).primaryKey;
      if (relPK) q = q.orderBy(asc(relPK));
    }
    return q;
  }

  /**
   * Group flat joined rows into the cardinality-aware result shape
   * exposed to consumers. Root columns are spread to the top level
   * (TypeORM-compatible flat shape); relations are nested as keys at
   * the same level — object for `'one'`, array for `'many'`.
   *
   * Input row layout (Drizzle's native table-grouped select):
   * ```
   * { <alias>: {...rootColumns}, company: {...} | null, posts: {...} | null }
   * ```
   *
   * Output bucket per root (flat):
   * ```
   * { ...rootColumns, company: {...} | null, posts: [...] }
   * ```
   *
   * - `'one'` relations: take first non-null occurrence per root.
   * - `'many'` relations: array, deduplicated by `relation.primaryKey`.
   * - Order: `rootIdsOrder` (when supplied, e.g. two-phase pagination)
   *   takes precedence; otherwise insertion order.
   *
   * If a root column has the same name as a relation key, the relation
   * overwrites the column. Document and avoid at schema design time.
   */
  private aggregate(
    qb: DrizzleQBState,
    rows: Array<Record<string, any>>,
    rootIdsOrder?: unknown[]
  ): Array<Record<string, any>> {
    const rootKey = qb.alias;
    const rootPKName = qb.source.primaryKey.name;
    const allJoins = new Map<string, JoinEntry>([
      ...qb.whereJoins,
      ...qb.presentationJoins,
    ]);

    const buckets = new Map<unknown, Record<string, any>>();
    const insertionOrder: unknown[] = [];

    for (const row of rows) {
      const rootObj = row[rootKey];
      if (!rootObj) continue;
      const rootId = rootObj[rootPKName];

      let bucket: Record<string, any> | undefined = buckets.get(rootId);
      if (!bucket) {
        // Spread root columns to the top level, then layer relation slots on top.
        bucket = { ...rootObj } as Record<string, any>;
        for (const [path, j] of allJoins) {
          const key = sanitizeKey(path);
          bucket[key] = j.cardinality === 'many' ? [] : null;
        }
        buckets.set(rootId, bucket);
        insertionOrder.push(rootId);
      }

      for (const [path, j] of allJoins) {
        const key = sanitizeKey(path);
        const relRow = row[key];
        if (!relRow) continue;

        if (j.cardinality === 'many') {
          // Construction validation guarantees primaryKey for 'many'. Re-assert defensively.
          const rel = qb.source.relations![path] as DrizzleRelation;
          const relPKName = rel.primaryKey?.name;
          if (!relPKName) {
            throw new Error(
              `DrizzleAdapter: relation "${path}" is 'many' but has no primaryKey at aggregate time. ` +
                `This indicates the construction validation was bypassed.`
            );
          }
          const arr = bucket[key] as Record<string, any>[];
          // Skip duplicates and rows where the relation PK itself is null.
          if (relRow[relPKName] == null) continue;
          if (
            !arr.some((existing) => existing[relPKName] === relRow[relPKName])
          ) {
            arr.push(relRow);
          }
        } else if (bucket[key] === null) {
          bucket[key] = relRow;
        }
      }
    }

    const order = rootIdsOrder ?? insertionOrder;
    const out: Array<Record<string, any>> = [];
    for (const id of order) {
      const b = buckets.get(id);
      if (b) out.push(b);
    }
    return out;
  }
}

// =====================================================================
// Local pagination helper (mirrors the TypeORM handler's parser)
// =====================================================================

function parsePagination(
  query: QueryInput,
  config?: PaginationConfig
): { page: number; perPage: number; offset: number } {
  const defaultPerPage = config?.defaultPerPage ?? 10;
  const maxPerPage = config?.maxPerPage ?? 100;
  const page = parseIntParam(query.page, 'page', 1);
  const requested = parseIntParam(query.perPage, 'perPage', defaultPerPage);
  const perPage = Math.min(requested, maxPerPage);
  if (page < 1) throw new BadRequestException(PAGE_MUST_BE_POSITIVE);
  if (perPage < 1) throw new BadRequestException(PER_PAGE_MUST_BE_POSITIVE);
  return { page, perPage, offset: (page - 1) * perPage };
}
