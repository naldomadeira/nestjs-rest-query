import type { QueryInput } from './query-input.interface';
import type { QueryResult } from './query-result.interface';
import type {
  OperatorsConfig,
  PaginationConfig,
} from './query-builder-config.interface';
import type { DQBLogger } from '../infra/logger';

/**
 * Adapter contract that lets `nestjs-rest-query` work with any ORM/query
 * builder by translating the parsed REST query input into native calls.
 *
 * The default `TypeOrmAdapter` is wired automatically when `forRoot()` is
 * called without `adapter`. To support another ORM (e.g. Drizzle), implement
 * this interface and pass an instance to `forRoot({ adapter })`.
 *
 * Type parameters:
 * - `TQB`: the native query builder type (e.g. `SelectQueryBuilder<T>` for
 *   TypeORM, an internal accumulator for Drizzle).
 * - `TSource`: the input the adapter accepts to build a query (e.g.
 *   `Repository<T>` for TypeORM, `{ db, table, ... }` for Drizzle).
 */
export interface RestQueryAdapter<TQB = unknown, TSource = unknown> {
  /** Create a native query builder bound to the source. */
  createQueryBuilder(source: TSource, alias: string): TQB;

  /**
   * Apply filter clauses parsed from `query.filter` against the rules
   * whitelist. Adapter is responsible for parsing/coercing values from the
   * raw query input.
   */
  applyFilters(
    qb: TQB,
    query: QueryInput,
    alias: string,
    allowedFilters: string[],
    operatorsConfig?: OperatorsConfig,
    logger?: DQBLogger
  ): void;

  /** Apply ORDER BY clauses parsed from `query.sort`. */
  applySorts(
    qb: TQB,
    query: QueryInput,
    alias: string,
    allowedSorts: string[],
    allowedFields?: string[],
    logger?: DQBLogger
  ): void;

  /** Apply relation joins parsed from `query.includes`. */
  applyIncludes(
    qb: TQB,
    query: QueryInput,
    alias: string,
    allowedIncludes: string[],
    logger?: DQBLogger
  ): void;

  /** Apply full-text search across `searchFields` for `query.search`. */
  applySearch(
    qb: TQB,
    query: QueryInput,
    alias: string,
    searchFields: string[],
    logger?: DQBLogger
  ): void;

  /**
   * Apply field projection parsed from `query.fields`. Adapters MUST
   * preserve the root primary key in the projection (see
   * `fields.handler.ts:68-69` for the TypeORM reference behavior).
   */
  applyFields(
    qb: TQB,
    query: QueryInput,
    alias: string,
    allowedFields: string[],
    allowedIncludes?: string[],
    logger?: DQBLogger
  ): void;

  /**
   * Apply LIMIT/OFFSET and run a parallel COUNT, returning the paginated
   * result envelope. Used when `query.paginate` is truthy (default).
   */
  applyPagination<T = unknown>(
    qb: TQB,
    query: QueryInput,
    paginationConfig?: PaginationConfig,
    logger?: DQBLogger
  ): Promise<QueryResult<T>>;

  /**
   * Run the query without LIMIT/OFFSET and without COUNT, returning rows
   * only. Used when `query.paginate=false`.
   */
  getMany<T = unknown>(qb: TQB): Promise<T[]>;

  /**
   * Pass-through hook so consumers can drop down to the native query
   * builder for arbitrary customizations.
   */
  customize(qb: TQB, fn: (qb: TQB) => void): void;
}
