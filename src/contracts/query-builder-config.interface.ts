import { QueryOperator } from '@domain/operators/operator.types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LoggerLike {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info?(message: string, ...args: any[]): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface PaginationConfig {
  /** Quantidade padrao de itens por pagina. @default 10 */
  defaultPerPage?: number;

  /** Quantidade maxima de itens por pagina. @default 100 */
  maxPerPage?: number;
}

export interface OperatorsConfig {
  /**
   * Lista de operadores permitidos globalmente.
   * - `undefined` (nao configurado): todos os operadores sao permitidos.
   * - `[]` (lista vazia): nenhum operador e permitido — bloqueia qualquer filtro com operador.
   * - `['eq', 'like']`: apenas os operadores listados sao permitidos.
   */
  allowed?: QueryOperator[];
}

export interface LoggingConfig {
  /** @default false */
  enabled?: boolean;

  /** @default 'info' */
  level?: 'error' | 'warn' | 'info' | 'debug';

  /**
   * Logger customizado. Se nao fornecido, usa NestJS Logger com prefixo [DQB].
   * Qualquer objeto com metodos error/warn/log/debug funciona (ex: winston, pino).
   */
  logger?: LoggerLike;
}

export interface QueryBuilderConfig {
  logging?: LoggingConfig;
  pagination?: PaginationConfig;
  operators?: OperatorsConfig;
}
