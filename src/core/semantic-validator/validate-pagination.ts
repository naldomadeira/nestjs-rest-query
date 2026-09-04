import { inputError } from '../errors';
import type { UntypedPagination } from '../query-parser';

export interface PaginationLimits {
  readonly defaultPerPage: number;
  readonly maxPerPage: number;
}

export interface PlanPagination {
  readonly paginate: boolean;
  readonly page: number;
  readonly perPage: number;
  readonly offset: number;
}

/** Inteiro decimal completo e positivo. Sem zero à esquerda, sem sinal. */
const POSITIVE_INTEGER_RE = /^[1-9]\d*$/;

const BOOLEAN_LITERALS: Readonly<Record<string, boolean>> = {
  true: true,
  false: false,
  '1': true,
  '0': false,
};

function reject(param: string, reason: string): never {
  throw inputError('PAGINATION_INVALID', `Invalid ${param}: ${reason}`, {
    param,
  });
}

function readPositiveInteger(
  raw: unknown,
  param: string,
  fallback: number
): number {
  // Ausência é `undefined`/`null`. Uma string vazia (`?page=`) é entrada
  // presente e inválida: aproximá-la para o default seria a degradação
  // silenciosa que o spec §5.6 proíbe.
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) reject(param, 'expected a single value');

  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 1) {
      reject(param, 'expected a positive integer');
    }
    return raw;
  }
  if (typeof raw !== 'string' || !POSITIVE_INTEGER_RE.test(raw)) {
    reject(param, 'expected a positive decimal integer');
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    reject(param, 'value is outside the safe integer range');
  }
  return value;
}

function readPaginate(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) reject('paginate', 'expected a single value');
  if (
    typeof raw !== 'string' ||
    !Object.prototype.hasOwnProperty.call(BOOLEAN_LITERALS, raw)
  ) {
    reject('paginate', 'expected true, false, 1 or 0');
  }
  return BOOLEAN_LITERALS[raw as string];
}

export function validatePagination(
  raw: UntypedPagination,
  limits: PaginationLimits
): PlanPagination {
  const paginate = readPaginate(raw.paginate);
  const page = readPositiveInteger(raw.page, 'page', 1);
  const perPage = readPositiveInteger(
    raw.perPage,
    'perPage',
    limits.defaultPerPage
  );

  if (perPage > limits.maxPerPage) {
    reject('perPage', `must not exceed ${limits.maxPerPage}`);
  }

  const offset = (page - 1) * perPage;
  if (!Number.isSafeInteger(offset)) {
    reject('page', 'resulting offset is outside the safe integer range');
  }

  return Object.freeze({ paginate, page, perPage, offset });
}
