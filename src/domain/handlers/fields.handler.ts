import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import {
  FIELD_NOT_ALLOWED,
  INVALID_FIELD_FORMAT,
} from '@contracts/error-messages';
import { isSafeFieldPath, parseCSV } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

function validateFieldTokens(tokens: string[], allowedFields: string[]): void {
  const unsafePaths: string[] = [];
  const notAllowed: string[] = [];

  for (const token of tokens) {
    if (!isSafeFieldPath(token)) {
      unsafePaths.push(token);
      continue;
    }

    const root = token.split('.')[0];
    if (!allowedFields.includes(root)) notAllowed.push(token);
  }

  if (unsafePaths.length > 0) {
    throw new BadRequestException(INVALID_FIELD_FORMAT('fields', unsafePaths));
  }

  if (notAllowed.length > 0) {
    throw new BadRequestException(
      FIELD_NOT_ALLOWED('fields', notAllowed, allowedFields)
    );
  }
}

function classifyField(
  field: string,
  alias: string,
  allowedIncludes?: string[]
): string {
  if (field.includes('.')) return field;

  const isRelation = allowedIncludes?.includes(field) ?? false;
  return isRelation ? field : `${alias}.${field}`;
}

export function applyFields<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  alias: string,
  allowedFields: string[],
  allowedIncludes?: string[],
  logger?: DQBLogger
): void {
  const log = logger?.withContext('applyFields') ?? DQBLogger.noop();

  const fieldsValue = query.fields;
  if (!fieldsValue || typeof fieldsValue !== 'string') return;

  const tokens = parseCSV(fieldsValue);
  if (tokens.length === 0) return;

  validateFieldTokens(tokens, allowedFields);

  const unique = Array.from(new Set(tokens));
  const selectFields = unique.map((f) =>
    classifyField(f, alias, allowedIncludes)
  );

  const pkField = `${alias}.id`;
  if (!selectFields.includes(pkField)) selectFields.unshift(pkField);

  log.debug('fields classified', {
    count: selectFields.length,
    fields: selectFields,
  });

  qb.select(selectFields);
}
