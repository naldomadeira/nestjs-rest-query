import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import {
  FIELD_NOT_ALLOWED,
  INVALID_FIELD_FORMAT,
  SORT_NOT_IN_FIELDS,
} from '@contracts/error-messages';
import { isSafeFieldPath, parseCSV } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

type SortToken = { field: string; direction: 'ASC' | 'DESC' };

function parseSortTokens(sortValue: string): SortToken[] {
  return parseCSV(sortValue).map((token) => {
    const isDesc = token.startsWith('-');
    return {
      field: isDesc ? token.slice(1) : token,
      direction: isDesc ? 'DESC' : 'ASC',
    };
  });
}

function validateSortTokens(tokens: SortToken[], allowedSorts: string[]): void {
  const unsafePaths: string[] = [];
  const notAllowed: string[] = [];

  for (const { field } of tokens) {
    if (!isSafeFieldPath(field)) {
      unsafePaths.push(field);
      continue;
    }

    const root = field.split('.')[0];
    if (!allowedSorts.includes(field) && !allowedSorts.includes(root))
      notAllowed.push(field);
  }

  if (unsafePaths.length > 0) {
    throw new BadRequestException(INVALID_FIELD_FORMAT('sort', unsafePaths));
  }

  if (notAllowed.length > 0) {
    throw new BadRequestException(
      FIELD_NOT_ALLOWED('sort', notAllowed, allowedSorts)
    );
  }
}

function deduplicateSortTokens(
  tokens: SortToken[]
): Map<string, 'ASC' | 'DESC'> {
  const sortMap = new Map<string, 'ASC' | 'DESC'>();
  for (const { field, direction } of tokens) sortMap.set(field, direction);
  return sortMap;
}

function validateSortConsistency(
  sortMap: Map<string, 'ASC' | 'DESC'>,
  fieldsRule: string[]
): void {
  const outsideFields: string[] = [];

  for (const field of sortMap.keys()) {
    if (field.includes('.')) continue; // campo de relação — validado por allowedSorts, não por fields
    if (!fieldsRule.includes(field)) outsideFields.push(field);
  }

  if (outsideFields.length > 0) {
    throw new BadRequestException(
      SORT_NOT_IN_FIELDS(outsideFields, fieldsRule)
    );
  }
}

export function applySorts<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  alias: string,
  allowedSorts: string[],
  fieldsRule?: string[],
  logger?: DQBLogger
): void {
  const log = logger?.withContext('applySorts') ?? DQBLogger.noop();

  const sortValue = query.sort;
  if (!sortValue || typeof sortValue !== 'string') return;

  const tokens = parseSortTokens(sortValue);
  if (tokens.length === 0) return;

  validateSortTokens(tokens, allowedSorts);

  const sortMap = deduplicateSortTokens(tokens);

  if (fieldsRule && fieldsRule.length > 0) {
    validateSortConsistency(sortMap, fieldsRule);
  }

  log.debug('sorts resolved', {
    sorts: Array.from(sortMap.entries()).map(([f, d]) => `${f} ${d}`),
  });

  for (const [field, direction] of sortMap.entries()) {
    const fullPath = field.includes('.') ? field : `${alias}.${field}`;
    qb.addOrderBy(fullPath, direction);
  }
}
