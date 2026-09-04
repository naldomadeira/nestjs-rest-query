import { inputError } from '../errors';
import {
  hasTotalPortableOrder,
  OPAQUE_KINDS,
  TEXTUAL_KINDS,
  type FieldDescriptor,
} from '../schema';
import {
  ALL_OPERATORS,
  type QueryOperator,
} from '../../domain/operators/operator.types';

/** Operadores de comparação de ordem (spec §11). */
export const ORDER_OPERATORS: readonly QueryOperator[] = [
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
];

/** Operadores de padrão textual: input literal, sem wildcards. */
export const PATTERN_OPERATORS: readonly QueryOperator[] = [
  'like',
  'notLike',
  'ilike',
  'notIlike',
];

/** Operadores que exigem um `foldedField` sob o perfil `portable-strict`. */
export const FOLDED_OPERATORS: readonly QueryOperator[] = ['ilike', 'notIlike'];

export const LIST_OPERATORS: readonly QueryOperator[] = ['in', 'notIn'];

const KNOWN_OPERATORS = new Set<string>(ALL_OPERATORS);
const ORDER = new Set<QueryOperator>(ORDER_OPERATORS);
const PATTERN = new Set<QueryOperator>(PATTERN_OPERATORS);
const FOLDED = new Set<QueryOperator>(FOLDED_OPERATORS);

/**
 * Matriz operador × tipo × capacidade (spec §11).
 *
 * É chamada duas vezes: na construção das regras, para que uma configuração
 * impossível falhe na inicialização, e na validação do termo, para o caso de
 * `transformPlan` ou de uma source com metadata diferente. Falhar aqui é
 * sempre melhor que aproximar silenciosamente.
 */
export function assertOperatorSupported(
  field: FieldDescriptor,
  operator: QueryOperator
): void {
  if (!KNOWN_OPERATORS.has(operator)) {
    throw inputError('OPERATOR_NOT_ALLOWED', `Unknown operator ${operator}`, {
      path: field.path,
      operator,
    });
  }

  if (operator === 'isNull') {
    if (!field.nullable) {
      throw inputError(
        'OPERATOR_TYPE_MISMATCH',
        `Field ${field.path} is not nullable`,
        { path: field.path, operator }
      );
    }
    return;
  }

  if (OPAQUE_KINDS.has(field.kind)) {
    throw inputError(
      'OPERATOR_TYPE_MISMATCH',
      `Operator ${operator} is not inferred for ${field.kind} fields`,
      { path: field.path, operator, expected: field.kind }
    );
  }

  if (PATTERN.has(operator) && !TEXTUAL_KINDS.has(field.kind)) {
    throw inputError(
      'OPERATOR_TYPE_MISMATCH',
      `Operator ${operator} requires a textual field`,
      { path: field.path, operator, expected: field.kind }
    );
  }

  if (FOLDED.has(operator) && !field.foldedField) {
    throw inputError(
      'CAPABILITY_UNAVAILABLE',
      `Field ${field.path} declares no folded field for ${operator}`,
      { path: field.path, operator }
    );
  }

  if (
    ORDER.has(operator) &&
    !hasTotalPortableOrder(field.kind) &&
    !field.portableOrderField
  ) {
    throw inputError(
      'CAPABILITY_UNAVAILABLE',
      `Field ${field.path} has no portable total order`,
      { path: field.path, operator, expected: field.kind }
    );
  }
}
