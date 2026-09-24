import type { RestQueryErrorCode } from './error-codes';

export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface RestQueryErrorEnvelope {
  statusCode: number;
  code: RestQueryErrorCode;
  message: string;
  details?: ErrorDetails;
}

/**
 * Marca de identidade no registro global de símbolos.
 *
 * Cada subpath publicado é um bundle com a sua cópia desta classe, e o erro
 * lançado pelo adapter (`nestjs-rest-query/typeorm`) é capturado pelo serviço
 * do root. Com `instanceof` nominal, esse `catch` não reconhecia o erro: um
 * 400 do adapter — `CAPABILITY_UNAVAILABLE`, por exemplo — virava 500 cru. A
 * mesma causa do bug do `DecimalValue` (ver `logical-values.ts`).
 */
const REST_QUERY_ERROR_BRAND = Symbol.for('nestjs-rest-query/RestQueryError');

/**
 * Erro serializável do contrato v3.
 *
 * `details` nunca carrega o valor cru enviado pelo cliente: apenas o path, o
 * operador e o tipo esperado. Isso mantém o envelope seguro para logar e para
 * devolver ao consumidor (spec §17.1).
 */
export class RestQueryError extends Error {
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<symbol, unknown>)[REST_QUERY_ERROR_BRAND] === true
    );
  }

  readonly details?: ErrorDetails;

  constructor(
    readonly code: RestQueryErrorCode,
    message: string,
    readonly statusCode: number,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = 'RestQueryError';
    Object.defineProperty(this, REST_QUERY_ERROR_BRAND, { value: true });
    if (details) this.details = Object.freeze({ ...details });
    Object.setPrototypeOf(this, RestQueryError.prototype);
  }

  toJSON(): RestQueryErrorEnvelope {
    const envelope: RestQueryErrorEnvelope = {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
    };
    if (this.details) envelope.details = this.details;
    return envelope;
  }
}

/** Erro causado por input do cliente. Sempre 400 (spec §17.1). */
export function inputError(
  code: RestQueryErrorCode,
  message: string,
  details?: ErrorDetails
): RestQueryError {
  return new RestQueryError(code, message, 400, details);
}

/**
 * Erro de configuração do consumidor. Deve estourar na construção das regras
 * ou na inicialização da source, nunca no meio de uma requisição.
 */
export function configurationError(
  code: RestQueryErrorCode,
  message: string,
  details?: ErrorDetails
): RestQueryError {
  return new RestQueryError(code, message, 500, details);
}
