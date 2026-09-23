import type { ConsistencyMode, TextProfile } from '../../core/query-plan';
import type { LoggerLike } from '../query-builder-config.interface';

export interface PaginationConfigV3 {
  /** @default 10 */
  defaultPerPage?: number;
  /**
   * Maior `perPage` que um cliente pode pedir; acima disso, 400
   * `PAGINATION_INVALID`.
   * @default 100
   */
  maxPerPage?: number;
  /**
   * Se `?paginate=false` é aceito. `false` recusa a requisição com 400
   * `PAGINATION_INVALID` antes de qualquer query. Um endpoint pode decidir
   * diferente em `defineQueryRules({ pagination })`.
   * @default true
   */
  allowUnpaginated?: boolean;
  /**
   * Teto de linhas de uma resposta sem paginação. O adapter busca no máximo
   * `maxUnpaginatedRows + 1` linhas; se o resultado passa do teto, a resposta
   * é 400 `PAGINATION_INVALID` — nunca uma lista truncada em silêncio. Um
   * endpoint pode declarar o seu em `defineQueryRules({ pagination })`.
   * @default o valor efetivo de `maxPerPage`
   */
  maxUnpaginatedRows?: number;
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
