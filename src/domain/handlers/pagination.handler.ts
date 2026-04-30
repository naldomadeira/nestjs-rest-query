import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import { QueryResult } from '@contracts/query-result.interface';
import { PaginationConfig } from '@contracts/query-builder-config.interface';
import { parseIntParam } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

function parsePaginationParams(
  query: QueryInput,
  config?: PaginationConfig
): { page: number; perPage: number; offset: number } {
  const defaultPerPage = config?.defaultPerPage ?? 10;
  const maxPerPage = config?.maxPerPage ?? 100;

  const page = parseIntParam(query.page, 'page', 1);
  const requested = parseIntParam(query.perPage, 'perPage', defaultPerPage);
  const perPage = Math.min(requested, maxPerPage);
  const offset = (page - 1) * perPage;

  return { page, perPage, offset };
}

function validatePaginationParams(page: number, perPage: number): void {
  if (page < 1) {
    throw new BadRequestException('"page" must be >= 1');
  }

  if (perPage < 1) {
    throw new BadRequestException('"perPage" must be >= 1');
  }
}

export async function applyPagination<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  config?: PaginationConfig,
  logger?: DQBLogger
): Promise<QueryResult<T>> {
  const log = logger?.withContext('applyPagination') ?? DQBLogger.noop();

  const { page, perPage, offset } = parsePaginationParams(query, config);

  validatePaginationParams(page, perPage);

  log.debug('executing paginated query', { page, perPage, offset });

  const [data, total] = await qb.skip(offset).take(perPage).getManyAndCount();

  const lastPage = Math.max(1, Math.ceil(total / perPage));

  log.debug('pagination result', { total, lastPage, count: data.length });

  return { data, page, perPage, total, lastPage };
}
