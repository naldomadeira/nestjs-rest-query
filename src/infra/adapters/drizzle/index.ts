import { configurationError } from '@core/errors';

/**
 * Subpath do Drizzle.
 *
 * O adapter chega na fase 5 do plano da v3, sobre a linha Drizzle 1.x (a 0.45
 * permanece na linha v2 da biblioteca). O subpath já existe e é publicado para
 * que o exports map, os tipos e o isolamento de peer sejam testáveis desde
 * agora.
 */
export const DRIZZLE_ADAPTER_STATUS = 'not-implemented' as const;

export function drizzleSource(): never {
  throw configurationError(
    'ADAPTER_CONTRACT_VIOLATION',
    'The Drizzle adapter lands in v3 phase 5; it is not implemented yet'
  );
}
