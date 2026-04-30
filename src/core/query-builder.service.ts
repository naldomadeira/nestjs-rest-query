import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  applyFilters,
  applySorts,
  applyIncludes,
  applySearch,
  applyFields,
  applyPagination,
} from '@domain/handlers';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { DQB_CONFIG_TOKEN } from './constants';
import {
  QueryBuilderConfig,
  QueryInput,
  QueryResult,
  RulesConfig,
} from '@contracts';
import { toBool } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';

@Injectable()
export class QueryBuilderService {
  private logger: DQBLogger;

  constructor(
    @Optional()
    @Inject(DQB_CONFIG_TOKEN)
    private readonly config?: QueryBuilderConfig
  ) {
    this.logger = new DQBLogger(this.config?.logging ?? {});
  }

  buildQuery<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: QueryInput,
    rules: RulesConfig = {}
  ): SelectQueryBuilder<T> {
    const alias = rules.alias || 'root';
    const qb = repository.createQueryBuilder(alias);

    this.logger.debug('[buildQuery] building query', { alias, rules, query });

    if (rules.filters?.length) {
      applyFilters(
        qb,
        query,
        alias,
        rules.filters,
        this.config?.operators,
        this.logger
      );
    }

    if (rules.includes?.length) {
      applyIncludes(qb, query, alias, rules.includes, this.logger);
    }

    if (rules.search?.length) {
      applySearch(qb, query, alias, rules.search, this.logger);
    }

    if (rules.fields?.length) {
      applyFields(qb, query, alias, rules.fields, rules.includes, this.logger);
    }

    if (rules.sorts?.length) {
      applySorts(qb, query, alias, rules.sorts, rules.fields, this.logger);
    }

    return qb;
  }

  async execute<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: QueryInput,
    rules: RulesConfig = {},
    customize?: (qb: SelectQueryBuilder<T>) => void
  ): Promise<QueryResult<T>> {
    const qb = this.buildQuery(repository, query, rules);

    customize?.(qb);

    const paginate = toBool(query.paginate, true);

    if (paginate) {
      this.logger.info('[execute] paginated query', {
        page: query.page,
        perPage: query.perPage,
      });
      return applyPagination(qb, query, this.config?.pagination, this.logger);
    }

    this.logger.info('[execute] unpaginated query');
    const data = await qb.getMany();
    return { data };
  }
}
