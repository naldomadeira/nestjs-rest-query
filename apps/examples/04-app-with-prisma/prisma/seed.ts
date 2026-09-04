import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { resetSchema, seed } from './database';

/**
 * `pnpm seed` — recria o schema e popula.
 *
 * Usa as mesmas funções que o smoke E2E, para que não exista uma segunda
 * versão da DDL nem do seed.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida (veja .env.example)');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    await resetSchema(prisma);
    await seed(prisma);
    console.log('banco do exemplo recriado e populado');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
