/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { QueryInput } from '@contracts/query-input.interface';
import { OperatorsConfig } from '@contracts/query-builder-config.interface';
import { QueryOperator } from '@domain/operators/operator.types';
import { operatorRegistry } from '../operators/operator.registry';
import {
  isSafeFieldPath,
  coerceValue,
  toBool,
  coerceForIn,
  coerceForBetween,
} from '@domain/normalizers/normalizers';
import { DQBLogger } from '@infra/logger';

function resolveFieldPath(fieldPath: string): {
  finalAlias: string;
  finalField: string;
} {
  const parts = fieldPath.split('.');

  if (parts.length === 2) {
    return { finalAlias: parts[0], finalField: parts[1] };
  }

  return {
    finalAlias: parts.slice(0, -1).join('_'),
    finalField: parts[parts.length - 1],
  };
}

function coerceValueForOperator(operator: QueryOperator, rawValue: any): any {
  switch (operator) {
    case 'in':
    case 'notIn':
      return coerceForIn(rawValue);
    case 'between':
      return coerceForBetween(rawValue);
    case 'isNull':
      return toBool(rawValue, false);
    default:
      return coerceValue(rawValue);
  }
}

function applyOperator(
  qb: SelectQueryBuilder<any>,
  fieldPath: string,
  operator: QueryOperator,
  rawValue: any,
  index: number,
  operatorsConfig?: OperatorsConfig
): void {
  if (operatorsConfig?.allowed !== undefined) {
    if (!operatorsConfig.allowed.includes(operator as any)) {
      throw new BadRequestException(
        `Operator "${operator}" is not allowed. Allowed operators: ${operatorsConfig.allowed.join(', ')}`
      );
    }
  }

  const handler = operatorRegistry[operator];
  if (!handler) {
    throw new BadRequestException(`Operator "${operator}" is not implemented`);
  }

  const { finalAlias, finalField } = resolveFieldPath(fieldPath);
  const paramKey = `filter_${index}`;
  const value = coerceValueForOperator(operator, rawValue);

  if (
    (operator === 'in' || operator === 'notIn') &&
    Array.isArray(value) &&
    value.length === 0
  ) {
    return;
  }

  handler(qb, finalAlias, finalField, paramKey, value);
}

export function applyFilters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: QueryInput,
  alias: string,
  allowedFilters: string[],
  operatorsConfig?: OperatorsConfig,
  logger?: DQBLogger
): void {
  const log = logger?.withContext('applyFilters') ?? DQBLogger.noop();

  const filterParam = query.filter;
  if (!filterParam || typeof filterParam !== 'object') return;

  const entries = Object.entries(filterParam);
  log.debug('processing filters', {
    count: entries.length,
    fields: Object.keys(filterParam),
  });

  const invalidFields: string[] = [];
  let paramIndex = 0;

  for (const [field, valueOrOps] of entries) {
    if (!isSafeFieldPath(field)) {
      throw new BadRequestException(
        `Invalid filter field name: "${field}". Only alphanumeric, underscore, and dots are allowed.`
      );
    }

    const rootField = field.includes('.') ? field.split('.')[0] : field;

    const isAllowed = field.includes('.')
      ? allowedFilters.includes(rootField) || allowedFilters.includes(field)
      : allowedFilters.includes(field);

    if (!isAllowed) {
      invalidFields.push(field);
      continue;
    }

    const fieldPath = field.includes('.') ? field : `${alias}.${field}`;

    if (typeof valueOrOps === 'string' || typeof valueOrOps === 'number') {
      applyOperator(
        qb,
        fieldPath,
        'eq',
        valueOrOps,
        paramIndex++,
        operatorsConfig
      );
      continue;
    }

    if (typeof valueOrOps === 'object' && valueOrOps !== null) {
      for (const [op, value] of Object.entries(valueOrOps)) {
        if (!operatorRegistry[op as QueryOperator]) {
          throw new BadRequestException(
            `Unsupported operator "${op}" for field "${field}". Supported: ${Object.keys(operatorRegistry).join(', ')}`
          );
        }

        applyOperator(
          qb,
          fieldPath,
          op as QueryOperator,
          value,
          paramIndex++,
          operatorsConfig
        );
      }
      continue;
    }

    throw new BadRequestException(
      `Invalid filter format for field "${field}". Expected string, number, or object with operators.`
    );
  }

  if (invalidFields.length > 0) {
    const unique = Array.from(new Set(invalidFields));
    throw new BadRequestException(
      `Filter field(s) not allowed: ${unique.join(', ')}. Allowed fields: ${allowedFilters.join(', ')}`
    );
  }
}
