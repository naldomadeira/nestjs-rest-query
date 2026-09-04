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

export interface PortabilityConfigV3 {
  /**
   * Exige que a source carregue fatos do profile certificado e que eles passem
   * em `checkPortabilityProfile()` antes da compilação.
   * @default false
   */
  readonly enforce?: boolean;
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
  portability?: PortabilityConfigV3;
  logging?: LoggingConfigV3;
}
