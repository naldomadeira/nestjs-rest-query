import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import {
  FIELD_NOT_ALLOWED,
  INVALID_FIELD_FORMAT,
} from '@contracts/error-messages';
import { isSafeFieldPath, parseCSV } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

function validateIncludeTokens(
  tokens: string[],
  allowedIncludes: string[]
): void {
  const unsafePaths: string[] = [];
  const notAllowed: string[] = [];

  for (const path of tokens) {
    if (!isSafeFieldPath(path)) {
      unsafePaths.push(path);
      continue;
    }

    const root = path.split('.')[0];
    if (!allowedIncludes.includes(root)) notAllowed.push(path);
  }

  if (unsafePaths.length > 0) {
    throw new BadRequestException(
      INVALID_FIELD_FORMAT('includes', unsafePaths)
    );
  }

  if (notAllowed.length > 0) {
    throw new BadRequestException(
      FIELD_NOT_ALLOWED('includes', notAllowed, allowedIncludes)
    );
  }
}

function applyJoins<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  paths: string[],
  rootAlias: string
): void {
  const appliedJoins = new Set<string>();

  for (const path of paths) {
    const parts = path.split('.').filter(Boolean);
    let currentAlias = rootAlias;
    const accumulated: string[] = [];

    for (const part of parts) {
      accumulated.push(part);
      const joinPath = `${currentAlias}.${part}`;
      const joinAlias = accumulated.join('_');

      if (!appliedJoins.has(joinAlias)) {
        qb.leftJoinAndSelect(joinPath, joinAlias);
        appliedJoins.add(joinAlias);
      }

      currentAlias = joinAlias;
    }
  }
}

export function applyIncludes<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  alias: string,
  allowedIncludes: string[],
  logger?: DQBLogger
): void {
  const log = logger?.withContext('applyIncludes') ?? DQBLogger.noop();

  const includeValue = query.includes;
  if (!includeValue || typeof includeValue !== 'string') return;

  const tokens = parseCSV(includeValue);
  if (tokens.length === 0) return;

  validateIncludeTokens(tokens, allowedIncludes);

  const unique = Array.from(new Set(tokens));

  log.debug('applying joins', { includes: unique });

  applyJoins(qb, unique, alias);
}
