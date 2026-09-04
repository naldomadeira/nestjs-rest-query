import type { ConsistencyMode, TextProfile } from '../../core/query-plan';
import type { LoggerLike } from '../query-builder-config.interface';

export interface PaginationConfigV3 {
  /** @default 20 */
  defaultPerPage?: number;
  /** @default 100 */
  maxPerPage?: number;
}

export interface LoggingConfigV3 {
  /** @default false */
  enabled?: boolean;
  /** @default 'info' */
  level?: 'error' | 'warn' | 'info' | 'debug';
  /**
   * Redige valores de filtro e de busca antes de logar.
   * @default true
   */
  redactValues?: boolean;
  logger?: LoggerLike;
}

/**
 * Configuração global v3 (spec §8.2). Só políticas comuns: não existe adapter
 * default implícito — quem determina o adapter é a source.
 */
export interface QueryBuilderConfigV3 {
  pagination?: PaginationConfigV3;
  /** @default 'portable-strict' */
  textProfile?: TextProfile;
  /** @default 'eventual' */
  consistency?: ConsistencyMode;
  logging?: LoggingConfigV3;
}
