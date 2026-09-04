import { configurationError } from '@core/errors';
import type {
  PrismaManifest,
  PrismaManifestInput,
} from './prisma-query.interface';

/**
 * Valida e congela o manifesto do Prisma (spec §15.2).
 *
 * O generator a partir de `schema.prisma` ainda não existe, então o manifesto
 * é escrito à mão. O que não muda é o gate: model sem schema lógico ou sem
 * delegate falha aqui, na inicialização — nunca vira uma string livre passada
 * ao client no meio de uma request.
 */
export function createPrismaManifest(
  input: PrismaManifestInput
): PrismaManifest {
  for (const [model, entry] of Object.entries(input.models)) {
    if (!input.registry.has(model)) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma manifest model ${model} has no schema entry`,
        { model }
      );
    }
    if (!entry.delegate) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma manifest model ${model} has no delegate`,
        { model }
      );
    }
  }

  return Object.freeze({
    provider: input.provider,
    registry: input.registry,
    models: Object.freeze({ ...input.models }),
  });
}
