// Order intentionally matches `operatorRegistry` so any list rendered
// from either source is identical byte-for-byte (parity G7).
export const Operator = {
  EQ: 'eq',
  NE: 'ne',
  LIKE: 'like',
  ILIKE: 'ilike',
  NOT_LIKE: 'notLike',
  NOT_ILIKE: 'notIlike',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IN: 'in',
  NOT_IN: 'notIn',
  BETWEEN: 'between',
  IS_NULL: 'isNull',
} as const;

// Derivado automaticamente do objeto — nunca sai de sincronia
export type QueryOperator = (typeof Operator)[keyof typeof Operator];

export const ALL_OPERATORS = Object.values(Operator) as QueryOperator[];
