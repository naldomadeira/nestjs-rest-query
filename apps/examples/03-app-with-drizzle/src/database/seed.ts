/**
 * Seed do banco de trabalho.
 *
 * Uso:
 *   pnpm seed            # cria o schema do zero e popula
 *   pnpm seed --keep     # só popula, sem derrubar as tabelas
 *
 * O trabalho de verdade vive em `bootstrap.ts`, e é o mesmo que o smoke E2E
 * executa. Ter dois caminhos — um para o teste, outro para o desenvolvedor —
 * é como se acaba com um exemplo que passa no CI e não sobe na máquina.
 */
import { createDatabase } from '../db/database.module';
import {
  COMPANY_SEED,
  POST_SEED,
  USER_SEED,
  resetDatabase,
  seedDatabase,
} from './bootstrap';

async function main(): Promise<void> {
  const keep = process.argv.includes('--keep');
  const db = createDatabase();

  try {
    if (keep) await seedDatabase(db);
    else await resetDatabase(db);

    console.log(
      `seed ok: ${COMPANY_SEED.length} empresas, ${USER_SEED.length} usuários, ${POST_SEED.length} posts`
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error('seed falhou:', error);
  process.exit(1);
});
