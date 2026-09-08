/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Contrato mínimo de logger aceito por `logging.logger`. Qualquer objeto com
 * esses métodos serve (winston, pino, o Logger do Nest).
 */
export interface LoggerLike {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info?(message: string, ...args: any[]): void;
}
