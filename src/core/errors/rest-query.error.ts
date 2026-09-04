import type { RestQueryErrorCode } from './error-codes';

export type ErrorDetails = Readonly<Record<string, unknown>>;

export interface RestQueryErrorEnvelope {
  statusCode: number;
  code: RestQueryErrorCode;
  message: string;
  details?: ErrorDetails;
}

/**
 * Erro serializável do contrato v3.
 *
 * `details` nunca carrega o valor cru enviado pelo cliente: apenas o path, o
 * operador e o tipo esperado. Isso mantém o envelope seguro para logar e para
 * devolver ao consumidor (spec §17.1).
 */
export class RestQueryError extends Error {
  readonly details?: ErrorDetails;

  constructor(
    readonly code: RestQueryErrorCode,
    message: string,
    readonly statusCode: number,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = 'RestQueryError';
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
