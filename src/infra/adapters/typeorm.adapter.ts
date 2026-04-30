import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  applyFields as applyFieldsHandler,
  applyFilters as applyFiltersHandler,
  applyIncludes as applyIncludesHandler,
  applyPagination as applyPaginationHandler,
  applySearch as applySearchHandler,
  applySorts as applySortsHandler,
} from '@domain/handlers';
import type { QueryInput } from '@contracts/query-input.interface';
import type { QueryResult } from '@contracts/query-result.interface';
import type {
  OperatorsConfig,
  PaginationConfig,
} from '@contracts/query-builder-config.interface';
import type { RestQueryAdapter } from '@contracts/rest-query-adapter.interface';
import { DQBLogger } from '@infra/logger';

/**
 * Default adapter for TypeORM. Wraps the existing handler functions so
 * behavior is identical to pre-1.1.0 — including the `${alias}.id`
 * auto-injection in `applyFields`, the idempotent join walk in
 * `applyIncludes`, and the OR-joined `LOWER() LIKE LOWER()` strategy in
 * `applySearch`.
 *
 * Lazy-requires `typeorm` at construction time so consumers that switched
 * to a different adapter (and uninstalled `typeorm`) get a clear error if
 * this class is accidentally instantiated.
 */
export class TypeOrmAdapter<T extends ObjectLiteral = ObjectLiteral>
  implements RestQueryAdapter<SelectQueryBuilder<T>, Repository<T>>
{
  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('typeorm');
    } catch {
      throw new Error(
        'TypeOrmAdapter requires "typeorm" to be installed. Run: pnpm add typeorm'
      );
    }
  }

  createQueryBuilder(
    repository: Repository<T>,
    alias: string
  ): SelectQueryBuilder<T> {
    return repository.createQueryBuilder(alias);
  }

  applyFilters(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    alias: string,
    allowedFilters: string[],
    operatorsConfig?: OperatorsConfig,
    logger?: DQBLogger
  ): void {
    applyFiltersHandler(
      qb,
      query,
      alias,
      allowedFilters,
      operatorsConfig,
      logger
    );
  }

  applySorts(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    alias: string,
    allowedSorts: string[],
    allowedFields?: string[],
    logger?: DQBLogger
  ): void {
    applySortsHandler(qb, query, alias, allowedSorts, allowedFields, logger);
  }

  applyIncludes(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    alias: string,
    allowedIncludes: string[],
    logger?: DQBLogger
  ): void {
    applyIncludesHandler(qb, query, alias, allowedIncludes, logger);
  }

  applySearch(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    alias: string,
    searchFields: string[],
    logger?: DQBLogger
  ): void {
    applySearchHandler(qb, query, alias, searchFields, logger);
  }

  applyFields(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    alias: string,
    allowedFields: string[],
    allowedIncludes?: string[],
    logger?: DQBLogger
  ): void {
    applyFieldsHandler(
      qb,
      query,
      alias,
      allowedFields,
      allowedIncludes,
      logger
    );
  }

  async applyPagination<TRow = T>(
    qb: SelectQueryBuilder<T>,
    query: QueryInput,
    paginationConfig?: PaginationConfig,
    logger?: DQBLogger
  ): Promise<QueryResult<TRow>> {
    return applyPaginationHandler(
      qb,
      query,
      paginationConfig,
      logger
    ) as unknown as Promise<QueryResult<TRow>>;
  }

  async getMany<TRow = T>(qb: SelectQueryBuilder<T>): Promise<TRow[]> {
    return qb.getMany() as unknown as Promise<TRow[]>;
  }

  customize(
    qb: SelectQueryBuilder<T>,
    fn: (qb: SelectQueryBuilder<T>) => void
  ): void {
    fn(qb);
  }
}
