import { DataSource, type ObjectLiteral, type Repository } from 'typeorm';
import { assertProfileFacts } from '@core/portability';
import type { ProfileDialect } from '@core/portability';
import {
  buildCorpusEntities,
  type CorpusEntities,
} from '../fixtures/entity-schemas';

export type IntegrationDialect = ProfileDialect;

export interface IntegrationContext {
  readonly dialect: IntegrationDialect;
  /** URL da célula, para os adapters que abrem conexão própria. */
  readonly url: string;
  readonly dataSource: DataSource;
  readonly entities: CorpusEntities;
  repositoryFor(preset: string): Repository<ObjectLiteral>;
}

/** Variável de ambiente que carrega a URL de cada célula da matriz. */
const URL_ENV: Record<IntegrationDialect, string> = {
  postgres: 'DQB_PG_URL',
  mysql: 'DQB_MYSQL_URL',
  mssql: 'DQB_MSSQL_URL',
};

export function selectedDialect(): IntegrationDialect | null {
  const dialect = process.env.DQB_DIALECT as IntegrationDialect | undefined;
  if (!dialect) return null;
  if (!URL_ENV[dialect]) {
    throw new Error(`Unknown DQB_DIALECT: ${dialect}`);
  }
  return process.env[URL_ENV[dialect]] ? dialect : null;
}

export async function openDialect(
  dialect: IntegrationDialect
): Promise<IntegrationContext> {
  const entities = buildCorpusEntities(dialect);
  const url = process.env[URL_ENV[dialect]]!;

  const dataSource = new DataSource({
    type: dialect === 'mssql' ? 'mssql' : dialect,
    url,
    entities: entities.all,
    // O schema vem da DDL do perfil certificado, não do synchronize: é a
    // collation e a precisão declaradas lá que sustentam a paridade.
    synchronize: false,
    logging: false,
    ...(dialect === 'mssql'
      ? {
          options: {
            encrypt: false,
            trustServerCertificate: true,
            // `useUTC` é o análogo do `timezone: 'Z'` do MySQL, e precisa ser
            // explícito: o driver do TypeORM força `useUTC: false` quando a
            // opção não vem marcada, e aí o `tedious` grava e lê `datetime2`
            // pelos componentes locais do processo. Num runner fora do UTC o
            // seed entra deslocado — e a célula do TypeORM ainda passa, porque
            // escreve e lê com o mesmo deslocamento, enquanto Prisma e Drizzle
            // (que ficam em UTC) leem o instante errado. O perfil certificado
            // é UTC; a sessão do cliente tem de ser também.
            useUTC: true,
          },
        }
      : {}),
    ...(dialect === 'mysql' ? { timezone: 'Z' } : {}),
  } as never);

  await dataSource.initialize();

  return {
    dialect,
    url,
    dataSource,
    entities,
    repositoryFor: (preset) =>
      dataSource.getRepository(
        entities[preset.split('.')[0] as keyof CorpusEntities] as never
      ),
  };
}

/**
 * Confere o perfil certificado antes de rodar qualquer caso (spec §6.3).
 *
 * Rodar o corpus sobre uma collation ou timezone diferente produziria
 * divergências que não são da biblioteca. Melhor falhar aqui, dizendo o quê
 * está fora do perfil.
 *
 * A coleta e a checagem vivem em `@core/portability`: o mesmo código que um
 * consumidor da biblioteca chama na inicialização. Uma cópia própria aqui
 * seria livre de ser mais permissiva que a que vai para produção — que é
 * exatamente o que o corpus existe para impedir.
 */
export async function assertProfile(
  context: IntegrationContext
): Promise<void> {
  await assertProfileFacts({
    dialect: context.dialect,
    query: <R>(sql: string) => context.dataSource.query(sql) as Promise<R[]>,
    textColumns: CERTIFIED_TEXT_COLUMNS,
    requiredIndexes: REQUIRED_INDEXES,
  });
}

const REQUIRED_INDEXES = [
  'users_company_id_idx',
  'users_name_folded_idx',
  'users_email_folded_idx',
  'users_code_idx',
  'posts_user_id_idx',
  'posts_id_order_idx',
  'companies_name_folded_idx',
  'tags_post_id_order_idx',
];

/** Colunas textuais cuja collation sustenta `eq`, `like` e o valor dobrado. */
const CERTIFIED_TEXT_COLUMNS = [
  ['users', 'name'],
  ['users', 'name_folded'],
  ['users', 'email_folded'],
  ['users', 'code'],
  ['companies', 'name'],
] as const;
