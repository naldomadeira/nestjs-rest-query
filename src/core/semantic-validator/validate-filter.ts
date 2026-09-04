import { inputError } from '../errors';
import { crossesMany, hasTotalPortableOrder } from '../schema';
import { decodeScalar, parseValueList, type LogicalValue } from '../coercion';
import { foldText } from '../text-profile';
import type { ResolvedFilterTerm } from '../authorization';
import { assertOperatorSupported, ORDER_OPERATORS } from './operator-matrix';
import type { PlanFilter } from './plan-terms';

const ORDER = new Set(ORDER_OPERATORS);
const BOOLEAN_LITERALS: Readonly<Record<string, boolean>> = {
  true: true,
  false: false,
  '1': true,
  '0': false,
};

function readStrictBoolean(path: string, raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (
    typeof raw !== 'string' ||
    !Object.prototype.hasOwnProperty.call(BOOLEAN_LITERALS, raw)
  ) {
    throw inputError(
      'FILTER_VALUE_INVALID',
      `Invalid value for isNull on ${path}: expected true, false, 1 or 0`,
      { path, operator: 'isNull', expected: 'boolean' }
    );
  }
  return BOOLEAN_LITERALS[raw];
}

/**
 * Converte um termo autorizado em `PlanFilter` tipado (spec §10 e §11).
 *
 * Aqui o valor deixa de ser texto HTTP e vira valor lógico, sempre pelo codec
 * do campo. Nada chega ao compiler sem ter passado por esta função.
 */
export function validateFilterTerm(term: ResolvedFilterTerm): PlanFilter {
  const relationPath = term.resolved.relationChain.map((r) => r.path);
  const existential = crossesMany(term.resolved.relationChain);

  // Alvo é a própria relação: só nulidade/presença faz sentido.
  if (!term.resolved.field) {
    if (term.operator !== 'isNull') {
      throw inputError(
        'OPERATOR_TYPE_MISMATCH',
        `Operator ${term.operator} cannot be applied to relation ${term.path}`,
        { path: term.path, operator: term.operator }
      );
    }
    return freeze({
      path: term.path,
      target: 'relation',
      relationPath,
      column: term.path,
      field: null,
      relation: term.resolved.relation ?? null,
      operator: 'isNull',
      value: readStrictBoolean(term.path, term.rawValue),
      existential: term.resolved.relation?.cardinality === 'many',
      literalPattern: false,
      alwaysFalse: false,
      alwaysTrue: false,
    });
  }

  const field = term.resolved.field;
  assertOperatorSupported(field, term.operator);

  const prefix = relationPath.length ? `${relationPath.join('.')}.` : '';
  const base = {
    path: term.path,
    target: 'relation' as const,
    relationPath,
    field,
    relation: null,
    operator: term.operator,
    existential,
    literalPattern: false,
    alwaysFalse: false,
    alwaysTrue: false,
  };

  if (term.operator === 'isNull') {
    return freeze({
      ...base,
      target: 'scalar',
      column: `${prefix}${field.path}`,
      value: readStrictBoolean(term.path, term.rawValue),
    });
  }

  if (term.operator === 'in' || term.operator === 'notIn') {
    const items = parseValueList(term.rawValue);
    return freeze({
      ...base,
      target: 'scalar',
      column: `${prefix}${field.path}`,
      value: items.map((item) => decodeScalar(field, item)),
      alwaysFalse: term.operator === 'in' && items.length === 0,
      alwaysTrue: term.operator === 'notIn' && items.length === 0,
    });
  }

  if (term.operator === 'between') {
    const items = parseValueList(term.rawValue);
    if (items.length !== 2) {
      throw inputError(
        'FILTER_VALUE_INVALID',
        `Operator between on ${term.path} requires exactly two values`,
        { path: term.path, operator: 'between', expected: field.kind }
      );
    }
    return freeze({
      ...base,
      target: 'scalar',
      column: `${prefix}${orderColumn(field)}`,
      value: items.map((item) => decodeScalar(field, item)),
    });
  }

  if (term.operator === 'ilike' || term.operator === 'notIlike') {
    // Consulta literal sobre a coluna dobrada: sem ILIKE, sem `mode`, sem
    // depender da collation do servidor (spec §12).
    const decoded = decodeScalar(field, term.rawValue) as string;
    return freeze({
      ...base,
      target: 'scalar',
      column: `${prefix}${field.foldedField!}`,
      value: foldText(decoded),
      literalPattern: true,
    });
  }

  if (term.operator === 'like' || term.operator === 'notLike') {
    return freeze({
      ...base,
      target: 'scalar',
      column: `${prefix}${field.path}`,
      value: decodeScalar(field, term.rawValue),
      literalPattern: true,
    });
  }

  return freeze({
    ...base,
    target: 'scalar',
    column: `${prefix}${ORDER.has(term.operator) ? orderColumn(field) : field.path}`,
    value: decodeScalar(field, term.rawValue),
  });
}

/** Ordem sobre uuid/enum passa pela coluna portável declarada no schema. */
function orderColumn(field: {
  path: string;
  kind: Parameters<typeof hasTotalPortableOrder>[0];
  portableOrderField?: string;
}): string {
  return hasTotalPortableOrder(field.kind)
    ? field.path
    : field.portableOrderField!;
}

function freeze(filter: {
  path: string;
  target: 'scalar' | 'relation';
  relationPath: readonly string[];
  column: string;
  field: PlanFilter['field'];
  relation: PlanFilter['relation'];
  operator: PlanFilter['operator'];
  value: LogicalValue | readonly LogicalValue[];
  existential: boolean;
  literalPattern: boolean;
  alwaysFalse: boolean;
  alwaysTrue: boolean;
}): PlanFilter {
  return Object.freeze(filter);
}
