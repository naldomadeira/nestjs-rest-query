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
  IS_NULL: 'isNull',
  BETWEEN: 'between',
} as const;

// Derivado automaticamente do objeto — nunca sai de sincronia
export type QueryOperator = (typeof Operator)[keyof typeof Operator];

export const ALL_OPERATORS = Object.values(Operator) as QueryOperator[];
