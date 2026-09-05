import { defineConfig } from 'drizzle-kit';

/**
 * Configuração do `drizzle-kit`, para **inspeção** do schema.
 *
 * O DDL que a aplicação e o smoke E2E aplicam vive em
 * `src/database/bootstrap.ts`, não aqui: `push` não sabe pedir `COLLATE "C"`
 * nas colunas textuais portáveis, e comparação por code point é parte da
 * promessa de portabilidade da v3. Rodar `push` contra este banco criaria um
 * schema parecido e sutilmente diferente.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5433'),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'app_db_drizzle',
    ssl: false,
  },
  verbose: true,
  strict: true,
});
