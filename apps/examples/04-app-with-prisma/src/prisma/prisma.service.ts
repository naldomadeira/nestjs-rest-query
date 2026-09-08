import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Client do Prisma 7 como provider do Nest.
 *
 * Duas mudanças em relação ao Prisma 6, e nenhuma delas é opcional:
 *
 * 1. **Driver adapter obrigatório.** O `PrismaClient` do Prisma 7 não abre
 *    conexão sozinho a partir de `DATABASE_URL` no `schema.prisma` — o
 *    `url` do datasource foi removido da linguagem do schema. Quem conecta é
 *    `@prisma/adapter-pg`, na mesma major do client.
 * 2. **O client não vem mais de `@prisma/client`.** O generator
 *    `prisma-client` escreve o client em `output` (aqui `src/generated/prisma`), e
 *    é de lá que se importa. `import { PrismaClient } from '@prisma/client'`
 *    passa a não compilar.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * URL de conexão, exigida explicitamente.
 *
 * Falha na subida em vez de deixar o driver tentar um default: sem `url` no
 * datasource, um `DATABASE_URL` ausente não é mais detectado pelo Prisma.
 */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL não definida (veja .env.example; o Postgres do exemplo sobe com `pnpm db:up`)'
    );
  }
  return url;
}
