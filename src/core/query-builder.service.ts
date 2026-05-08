/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { DQB_CONFIG_TOKEN } from './constants';
import {
  QueryBuilderConfig,
  QueryInput,
  QueryResult,
  RestQueryAdapter,
  RulesConfig,
} from '@contracts';
import { toBool } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { TypeOrmAdapter } from '@infra/adapters';

/**
 * Builds and executes REST queries against the configured adapter.
 *
 * The public surface is typed against TypeORM (`Repository<T>`,
 * `SelectQueryBuilder<T>`) for backward compatibility with `1.0.x`.
 * Internally it delegates every operation to the configured
 * `RestQueryAdapter` (default: `TypeOrmAdapter`).
 *
 * To use a different ORM, pass a custom adapter via
 * `forRoot({ adapter: new DrizzleAdapter() })`. Adapter authors should
 * cast call sites or wait for the 2.0 type rework if their source
 * differs from `Repository<T>`.
 */
@Injectable()
export class QueryBuilderService {
  private readonly adapter: RestQueryAdapter<any, any>;
  private logger: DQBLogger;

  constructor(
    @Optional()
    @Inject(DQB_CONFIG_TOKEN)
    private readonly config?: QueryBuilderConfig
  ) {
    this.adapter =
      (config?.adapter as RestQueryAdapter<any, any>) ?? new TypeOrmAdapter();
    this.logger = new DQBLogger(this.config?.logging ?? {});
  }

  buildQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: QueryInput,
    rules: RulesConfig = {}
  ): SelectQueryBuilder<T> {
    const alias = rules.alias || 'root';
    const qb = this.adapter.createQueryBuilder(
      repository,
      alias
    ) as SelectQueryBuilder<T>;

    this.logger.debug('[buildQuery] building query', { alias, rules, query });

    if (rules.filters?.length) {
      const operatorsConfig = Object.prototype.hasOwnProperty.call(
        rules,
        'operators'
      )
        ? rules.operators
        : this.config?.operators;

      this.adapter.applyFilters(
        qb,
        query,
        alias,
        rules.filters,
        operatorsConfig,
        this.logger
      );
    }

    if (rules.includes?.length) {
      this.adapter.applyIncludes(qb, query, alias, rules.includes, this.logger);
    }

    if (rules.search?.length) {
      this.adapter.applySearch(qb, query, alias, rules.search, this.logger);
    }

    if (rules.fields?.length) {
      this.adapter.applyFields(
        qb,
        query,
        alias,
        rules.fields,
        rules.includes,
        this.logger
      );
    }

    if (rules.sorts?.length) {
      this.adapter.applySorts(
        qb,
        query,
        alias,
        rules.sorts,
        rules.fields,
        this.logger
      );
    }

    return qb;
  }

  /**
   * Build the query, optionally let the caller customize the native
   * builder, then either paginate or return all rows depending on
   * `query.paginate` (default `true`).
   *
   * `paginate=false` is preserved as in `1.0.x`: returns `{ data }` only,
   * without `page`/`perPage`/`total`/`lastPage`.
   */
  async execute<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: QueryInput,
    rules: RulesConfig = {},
    customize?: (qb: SelectQueryBuilder<T>) => void
  ): Promise<QueryResult<T>> {
    const qb = this.buildQuery(repository, query, rules);

    if (customize) this.adapter.customize(qb, customize);

    const paginate = toBool(query.paginate, true);

    if (!paginate) {
      this.logger.info('[execute] unpaginated query');
      const data = (await this.adapter.getMany(qb)) as T[];
      return { data };
    }

    this.logger.info('[execute] paginated query', {
      page: query.page,
      perPage: query.perPage,
    });
    return this.adapter.applyPagination<T>(
      qb,
      query,
      this.config?.pagination,
      this.logger
    );
  }
}
