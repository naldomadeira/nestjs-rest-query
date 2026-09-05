import { DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import { buildQueryPlan } from '@core/query-plan';
import { compilePlan } from '@infra/adapters/typeorm';
import { RULES_PRESETS } from '../../fixtures/rules';
import {
  buildCorpusEntities,
  type CorpusEntities,
} from '../../fixtures/entity-schemas';

/** Mesmo caractere de escape que o adapter escolhe para todos os dialetos. */
export const ESCAPE_CHARACTER = '!';

let dataSource: DataSource | undefined;
let entities: CorpusEntities | undefined;

export async function openSqlite(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;

  entities = buildCorpusEntities('sqlite');
  dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    entities: entities.all,
  });
  await dataSource.initialize();
  return dataSource;
}

export function corpusEntities(): CorpusEntities {
  return entities!;
}

export async function closeSqlite(): Promise<void> {
  if (dataSource?.isInitialized) await dataSource.destroy();
  dataSource = undefined;
  entities = undefined;
}

export function repositoryFor(preset: string): Repository<ObjectLiteral> {
  const model = preset.split('.')[0] as keyof CorpusEntities;
  return dataSource!.getRepository(entities![model] as never);
}

export interface CompiledSnapshot {
  sql: string;
  countSql: string;
  parameters: Record<string, unknown>;
}

/**
 * Compila uma query do corpus e devolve o SQL gerado, sem tocar no banco.
 *
 * SQLite não é uma célula da matriz de paridade: aqui ele serve apenas como
 * dialeto de referência para os contract tests, que verificam a *forma* do SQL
 * (joins, EXISTS, escape, projeção). A semântica real é medida na integração.
 */
export function compileToQueryBuilder(
  query: Record<string, unknown>,
  preset = 'user.default'
): CompiledSnapshot {
  const plan = buildQueryPlan(query, RULES_PRESETS[preset]);
  const compiled = compilePlan(plan, repositoryFor(preset), ESCAPE_CHARACTER);

  return {
    sql: compiled.data.getQuery(),
    countSql: compiled.count.getQuery(),
    parameters: compiled.data.getParameters(),
  };
}
