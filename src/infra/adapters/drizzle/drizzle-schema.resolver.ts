import { configurationError } from '@core/errors';
import { defineQuerySchema, type QuerySchema } from '@core/schema';
import type {
  DrizzleRelation,
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
 * Campo lógico -> coluna física.
 *
 * É o único ponto por onde uma chave de `columns` vira identificador SQL, e
 * existe porque `DrizzleColumn.name` significa o que promete: a chave é o nome
 * da API, `name` é o nome do banco. Campo não declarado falha aqui, com o
 * campo e a tabela na mensagem, em vez de virar `column "x" does not exist`
 * numa consulta em produção.
 */
export function physicalColumn(table: DrizzleTable, field: string): string {
  const column = table.columns[field];

  if (!column) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Drizzle table ${table.name} has no column declared for field ${field}`,
      { table: table.name, field }
    );
  }

  return column.name;
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
  assertRelationColumnsDeclared(table, relations);

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

/**
 * Colunas de junção também são campos lógicos, e valem o mesmo rigor.
 *
 * A verificação é feita na construção da source — não na primeira consulta —
 * porque uma FK escrita com o nome físico (`company_id` onde a chave é
 * `companyId`) compilaria SQL sintaticamente válido contra uma coluna que não
 * existe, e a aplicação subiria mesmo assim.
 */
function assertRelationColumnsDeclared(
  table: DrizzleTable,
  relations: DrizzleRelationMap
): void {
  for (const [path, relation] of Object.entries(relations)) {
    physicalColumn(
      sourceTableOf(table, relations, path),
      relation.sourceColumn
    );
    physicalColumn(relation.target, relation.targetColumn);
  }
}

/**
 * Tabela do lado de origem de um salto.
 *
 * Num path pontuado a origem é o alvo do prefixo — `company.owner` sai de
 * `companies`, não do root —, e `assertRelationPathsResolvable` já garantiu
 * que o prefixo existe.
 */
function sourceTableOf(
  table: DrizzleTable,
  relations: DrizzleRelationMap,
  path: string
): DrizzleTable {
  const segments = path.split('.');
  const parent: DrizzleRelation | undefined =
    relations[segments.slice(0, -1).join('.')];
  return parent ? parent.target : table;
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
