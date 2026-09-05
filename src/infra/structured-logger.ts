import { Logger } from '@nestjs/common';
import type { LoggerLike } from '@contracts/query-builder-config.interface';
import type { LoggingConfigV3 } from '@contracts/v3';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'];

export type LogMeta = Readonly<Record<string, unknown>>;

/**
 * Logging estruturado do v3 (spec §17.1).
 *
 * Passa `meta` como objeto separado em vez de concatenar na mensagem, para que
 * o transporte do consumidor (pino, winston) receba campos, não texto. Valores
 * de filtro e de busca nunca chegam aqui: quem monta o `meta` só coloca paths,
 * operadores e contagens.
 */
export class StructuredLogger {
  private readonly enabled: boolean;
  private readonly level: LogLevel;
  private readonly inner: LoggerLike;

  readonly redactValues: boolean;

  constructor(config: LoggingConfigV3 = {}) {
    this.enabled = config.enabled ?? false;
    this.level = config.level ?? 'info';
    this.redactValues = config.redactValues ?? true;
    this.inner = config.logger ?? new Logger('DQB');
  }

  error(message: string, meta?: LogMeta): void {
    if (!this.enabled) return;
    this.inner.error(message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('warn')) return;
    this.inner.warn(message, meta);
  }

  info(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('info')) return;
    if (this.inner.info) this.inner.info(message, meta);
    else this.inner.log(message, meta);
  }

  debug(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('debug')) return;
    this.inner.debug(message, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabled && LEVELS.indexOf(level) <= LEVELS.indexOf(this.level);
  }
}
