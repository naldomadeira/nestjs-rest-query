/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@nestjs/common';
import {
  LoggingConfig,
  LoggerLike,
} from '@contracts/query-builder-config.interface';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];

export class DQBLogger {
  private readonly enabled: boolean;
  private readonly level: LogLevel;
  private readonly inner: LoggerLike;

  private static readonly _noop = new DQBLogger({ enabled: false });

  static noop(): DQBLogger {
    return DQBLogger._noop;
  }

  constructor(config: LoggingConfig = {}) {
    this.enabled = config.enabled ?? false;
    this.level = config.level ?? 'info';
    this.inner = config.logger ?? new Logger('DQB');
  }

  withContext(fn: string) {
    return {
      error: (msg: string, meta?: any) => this.error(`[${fn}] ${msg}`, meta),
      warn: (msg: string, meta?: any) => this.warn(`[${fn}] ${msg}`, meta),
      info: (msg: string, meta?: any) => this.info(`[${fn}] ${msg}`, meta),
      debug: (msg: string, meta?: any) => this.debug(`[${fn}] ${msg}`, meta),
    };
  }

  error(message: string, meta?: any): void {
    if (!this.enabled) return;
    this.inner.error(meta ? `${message} ${JSON.stringify(meta)}` : message);
  }

  warn(message: string, meta?: any): void {
    if (!this.enabled || !this.shouldLog('warn')) return;
    this.inner.warn(meta ? `${message} ${JSON.stringify(meta)}` : message);
  }

  info(message: string, meta?: any): void {
    if (!this.enabled || !this.shouldLog('info')) return;
    const msg = meta ? `${message} ${JSON.stringify(meta)}` : message;
    if (this.inner.info) {
      this.inner.info(msg);
    } else {
      this.inner.log(msg);
    }
  }

  debug(message: string, meta?: any): void {
    if (!this.enabled || !this.shouldLog('debug')) return;
    this.inner.debug(meta ? `${message} ${JSON.stringify(meta)}` : message);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) <= LEVELS.indexOf(this.level);
  }
}
