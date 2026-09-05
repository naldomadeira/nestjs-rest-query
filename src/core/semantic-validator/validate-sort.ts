import { configurationError, inputError } from '../errors';
import {
  crossesMany,
  hasTotalPortableOrder,
  requireSchema,
  type SchemaRegistry,
} from '../schema';
import type { ResolvedSortTerm } from '../authorization';
import type { PlanSort } from './plan-terms';

export interface ValidatedSort {
  readonly sorts: readonly PlanSort[];
  /** Chave de desempate: a PK completa do root, sempre ascendente. */
  readonly tieBreak: readonly PlanSort[];
}

/**
 * Ordenação determinística (spec §14).
 *
 * Sem uma chave total, única e não nula anexada ao final, duas páginas podem
 * repetir ou perder linhas — por isso o desempate por PK é obrigatório e não
 * opcional, inclusive quando não há sort na URL.
 */
export function validateSort(
  terms: readonly ResolvedSortTerm[],
  registry: SchemaRegistry,
  rootModel: string
): ValidatedSort {
  const byPath = new Map<string, PlanSort>();

  for (const term of terms) {
    if (crossesMany(term.resolved.relationChain)) {
      throw inputError(
        'OPERATOR_TYPE_MISMATCH',
        `Sort ${term.path} crosses a many relation, which has no deterministic order`,
        { path: term.path }
      );
    }

    const existing = byPath.get(term.path);
    if (existing) {
      if (existing.direction !== term.direction) {
        throw inputError(
          'SORT_CONFLICT',
          `Sort ${term.path} was requested in both directions`,
          { path: term.path }
        );
      }
      continue; // duplicado com a mesma direção: deduplicado
    }

    const field = term.resolved.field!;
    const relationPath = term.resolved.relationChain.map((r) => r.path);
    const prefix = relationPath.length ? `${relationPath.join('.')}.` : '';

    if (!hasTotalPortableOrder(field.kind) && !field.portableOrderField) {
      throw inputError(
        'CAPABILITY_UNAVAILABLE',
        `Field ${term.path} has no portable total order`,
        { path: term.path, expected: field.kind }
      );
    }

    byPath.set(term.path, {
      path: term.path,
      column: `${prefix}${field.portableOrderField ?? field.path}`,
      relationPath,
      direction: term.direction,
    });
  }

  return Object.freeze({
    sorts: Object.freeze([...byPath.values()]),
    tieBreak: buildTieBreak(registry, rootModel, byPath),
  });
}

function buildTieBreak(
  registry: SchemaRegistry,
  rootModel: string,
  explicit: ReadonlyMap<string, PlanSort>
): readonly PlanSort[] {
  const schema = requireSchema(registry, rootModel);
  const tieBreak: PlanSort[] = [];

  for (const part of schema.primaryKey) {
    const field = schema.fields.get(part)!;

    if (!hasTotalPortableOrder(field.kind) && !field.portableOrderField) {
      // Sem chave total portável não existe paginação estável: falha fechado
      // na construção do plano, não no meio da segunda página (spec §14).
      throw configurationError(
        'CAPABILITY_UNAVAILABLE',
        `Primary key part ${part} of ${rootModel} has no portable total order`,
        { path: part, expected: field.kind }
      );
    }

    if (explicit.has(part)) continue;

    tieBreak.push({
      path: part,
      column: field.portableOrderField ?? field.path,
      relationPath: [],
      direction: 'asc',
    });
  }

  return Object.freeze(tieBreak);
}
