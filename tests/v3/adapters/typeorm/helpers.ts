import { DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import { buildQueryPlan } from '@core/query-plan';
import { compilePlan } from '@infra/adapters/typeorm';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CompanyEntity, PostEntity, TagEntity, UserEntity } from './entities';

const ENTITY_BY_MODEL: Record<string, new () => ObjectLiteral> = {
  user: UserEntity,
  company: CompanyEntity,
  post: PostEntity,
  tag: TagEntity,
};

let dataSource: DataSource | undefined;

export async function openSqlite(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    entities: [UserEntity, CompanyEntity, PostEntity, TagEntity],
  });
  await dataSource.initialize();
  return dataSource;
}

export async function closeSqlite(): Promise<void> {
  if (dataSource?.isInitialized) await dataSource.destroy();
  dataSource = undefined;
}

export function repositoryFor(preset: string): Repository<ObjectLiteral> {
  const model = preset.split('.')[0];
  return dataSource!.getRepository(ENTITY_BY_MODEL[model]);
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
  const compiled = compilePlan(plan, repositoryFor(preset), '\\');

  return {
    sql: compiled.data.getQuery(),
    countSql: compiled.count.getQuery(),
    parameters: compiled.data.getParameters(),
  };
}
