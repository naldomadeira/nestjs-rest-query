import { configurationError } from '@core/errors';

/**
 * Subpath do Prisma.
 *
 * O adapter chega na fase 4 do plano da v3. O subpath já existe e é
 * publicado para que o exports map, os tipos e o isolamento de peer sejam
 * testáveis desde agora — mas usá-lo falha em voz alta em vez de prometer
 * comportamento que não existe.
 */
export const PRISMA_ADAPTER_STATUS = 'not-implemented' as const;

export function prismaSource(): never {
  throw configurationError(
    'ADAPTER_CONTRACT_VIOLATION',
    'The Prisma adapter lands in v3 phase 4; it is not implemented yet'
  );
}
