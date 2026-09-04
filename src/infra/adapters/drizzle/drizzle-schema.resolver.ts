import { configurationError } from '@core/errors';
import { defineQuerySchema, type QuerySchema } from '@core/schema';
import type {
  DrizzleRelationMap,
  DrizzleTable,
} from './drizzle-statement.interface';

/** Congela a tabela declarada, para que a metadata não mude em runtime. */
export function createDrizzleTable(input: DrizzleTable): DrizzleTable {
  return Object.freeze({
    ...input,
    columns: Object.freeze({ ...input.columns }),
  });
}

/**
 * Schema lógico do root a partir da tabela declarada (spec §15.3).
 *
 * Só relações de primeiro nível entram no schema: as chaves pontuadas do mapa
 * (`company.owner`) descrevem saltos que pertencem ao schema do *alvo*, e são
 * usadas pelo compiler para juntar ou correlacionar caminhos profundos.
 */
export function buildSourceSchema(
  table: DrizzleTable,
  relations: DrizzleRelationMap
): QuerySchema {
  assertRelationPathsResolvable(table, relations);

  return defineQuerySchema({
    model: table.model,
    primaryKey: Object.entries(table.columns)
      .filter(([, column]) => column.primaryKey)
      .map(([path]) => path),
    fields: Object.entries(table.columns).map(([path, column]) => ({
      path,
      kind: column.kind,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      internal: column.internal,
      foldedField: column.foldedField,
      portableOrderField: column.portableOrderField,
    })),
    relations: Object.entries(relations)
      .filter(([path]) => !path.includes('.'))
      .map(([path, relation]) => ({
        path,
        target: relation.target.model,
        cardinality: relation.cardinality,
        nullable: relation.nullable,
      })),
  });
}

/** Um path aninhado sem o seu prefixo declarado não é resolvível. */
function assertRelationPathsResolvable(
  table: DrizzleTable,
  relations: DrizzleRelationMap
): void {
  for (const path of Object.keys(relations)) {
    const segments = path.split('.');
    for (let index = 1; index < segments.length; index++) {
      const parent = segments.slice(0, index).join('.');
      if (!relations[parent]) {
        throw configurationError(
          'SOURCE_CONFIGURATION_INVALID',
          `Drizzle relation ${path} has no declared parent ${parent}`,
          { table: table.name, path, parent }
        );
      }
    }
  }
}
