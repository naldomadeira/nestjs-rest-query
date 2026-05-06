import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import { INVALID_FIELD_FORMAT } from '@contracts/error-messages';
import { isSafeFieldPath } from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

type JoinAttribute = {
  alias?: { name?: string };
  entityOrProperty?: string;
};

const LIKE_ESCAPE_SQL = "'\\'";

function validateSearchTokens(tokens: string[]): void {
  const unsafePaths: string[] = [];

  for (const path of tokens) {
    if (!isSafeFieldPath(path)) unsafePaths.push(path);
  }

  if (unsafePaths.length > 0) {
    throw new BadRequestException(INVALID_FIELD_FORMAT('search', unsafePaths));
  }
}

function escapeSearchTerm(term: string): string {
  // Escape the escape character first, otherwise the % / _ replacements
  // below introduce new backslashes that an attacker could subvert by
  // sneaking a literal backslash into the input.
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function getJoinAttributes(qb: SelectQueryBuilder<any>): JoinAttribute[] {
  return (qb.expressionMap.joinAttributes ?? []) as JoinAttribute[];
}

function findJoinAlias(
  qb: SelectQueryBuilder<any>,
  joinPath: string,
  joinAlias: string
): string | undefined {
  const joinAttributes = getJoinAttributes(qb);

  const match = joinAttributes.find(
    (join) =>
      join.alias?.name === joinAlias || join.entityOrProperty === joinPath
  );

  return match?.alias?.name;
}

function ensureJoinPath(
  qb: SelectQueryBuilder<any>,
  rootAlias: string,
  relationPath: string
): string {
  const parts = relationPath.split('.').filter(Boolean);

  let currentAlias = rootAlias;
  const accumulated: string[] = [];

  for (const part of parts) {
    accumulated.push(part);
    const joinPath = `${currentAlias}.${part}`;
    const joinAlias = accumulated.join('_');
    const existingAlias = findJoinAlias(qb, joinPath, joinAlias);

    if (existingAlias) {
      currentAlias = existingAlias;
      continue;
    }

    qb.leftJoin(joinPath, joinAlias);
    currentAlias = joinAlias;
  }

  return currentAlias;
}

function buildSearchCondition(
  qb: SelectQueryBuilder<any>,
  alias: string,
  fieldPath: string
): string {
  if (!fieldPath.includes('.')) {
    return `LOWER(${alias}.${fieldPath}) LIKE LOWER(:dqb_search) ESCAPE ${LIKE_ESCAPE_SQL}`;
  }

  const parts = fieldPath.split('.');
  const relationPath = parts.slice(0, -1).join('.');
  const finalField = parts[parts.length - 1];
  const relationAlias = ensureJoinPath(qb, alias, relationPath);

  return `LOWER(${relationAlias}.${finalField}) LIKE LOWER(:dqb_search) ESCAPE ${LIKE_ESCAPE_SQL}`;
}

export function applySearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  alias: string,
  searchFields: string[],
  logger?: DQBLogger
): void {
  const log = logger?.withContext('applySearch') ?? DQBLogger.noop();

  const searchValue = query.search;
  if (typeof searchValue !== 'string') return;

  const term = searchValue.trim();
  if (!term) return;

  const tokens = Array.from(
    new Set(searchFields.map((field) => field.trim()).filter(Boolean))
  );
  if (tokens.length === 0) return;

  validateSearchTokens(tokens);

  const escapedTerm = escapeSearchTerm(term);
  const conditions = tokens.map((field) =>
    buildSearchCondition(qb, alias, field)
  );

  if (conditions.length === 0) return;

  log.debug('applying search', {
    count: conditions.length,
    fields: tokens,
  });

  qb.andWhere(`(${conditions.join(' OR ')})`, {
    dqb_search: `%${escapedTerm}%`,
  });
}
