import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  drizzleDatabase,
  type DrizzleDatabase,
} from 'nestjs-rest-query/drizzle';

/**
 * Conexão e executor, num módulo global.
 *
 * O que os serviços injetam não é o `db` do Drizzle: é o `DrizzleDatabase` que
 * `drizzleDatabase()` devolve. Essa fronteira é o ponto do desenho v3 — o
 * adapter compila o plano para um statement explícito (aliases, junções,
 * condições, ordem, paginação) e o executor materializa aquele statement no
 * dialeto declarado. Declarar o dialeto não é redundância: `sqlite` executa por
 * `all()`, Postgres por `execute()`, e a leitura das linhas difere por driver.
 * Adivinhar isso inspecionando o objeto falharia tarde e diferente em cada um.
 */

export function databaseUrl(): string {
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5433';
  const name = process.env.DB_NAME ?? 'app_db_drizzle';

  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

/**
 * Cliente `postgres-js` embrulhado pelo Drizzle 1.x.
 *
 * A forma de chamada mudou na 1.0: `drizzle(client, { schema })` saiu e só
 * resta `drizzle({ client })`. O `schema` também deixou de fazer diferença
 * aqui — ele servia à API relacional (`db.query.*`), que este exemplo não usa.
 */
export function createDatabase(url: string = databaseUrl()) {
  return drizzle({
    // `onnotice` calado: o DDL do bootstrap usa `drop table if exists`, e cada
    // tabela ausente vira um NOTICE que o driver imprimiria no console do teste.
    client: postgres(url, { max: 5, onnotice: () => {} }),
  });
}

/** Tipo do `db`, derivado da fábrica: evita reescrever o genérico do driver. */
export type AppDatabase = ReturnType<typeof createDatabase>;

export const APP_DATABASE = Symbol('APP_DATABASE');
export const DRIZZLE_EXECUTOR = Symbol('DRIZZLE_EXECUTOR');

@Global()
@Module({
  providers: [
    {
      provide: APP_DATABASE,
      useFactory: (): AppDatabase => createDatabase(),
    },
    {
      provide: DRIZZLE_EXECUTOR,
      inject: [APP_DATABASE],
      // Sem cast: o `db` do `postgres-js` satisfaz `DrizzleClientLike`
      // estruturalmente, porque expõe `execute()`. Se não satisfizesse, o
      // remédio seria corrigir a biblioteca — um `as unknown as` aqui
      // esconderia justamente o erro que o dialeto declarado existe para pegar.
      useFactory: (client: AppDatabase): DrizzleDatabase =>
        drizzleDatabase({ client, dialect: 'postgres' }),
    },
  ],
  exports: [APP_DATABASE, DRIZZLE_EXECUTOR],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(APP_DATABASE) private readonly db: AppDatabase) {}

  /**
   * Sem isto o pool do `postgres-js` mantém o processo vivo, e o smoke E2E
   * terminaria com handle aberto em vez de terminar.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.db.$client.end();
  }
}
