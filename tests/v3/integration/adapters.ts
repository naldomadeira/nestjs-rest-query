import type { AnyQuerySource } from '@contracts/v3';
import {
  drizzleDatabase,
  drizzleSource,
  type DrizzleClientLike,
} from '@infra/adapters/drizzle';
import { createPrismaManifest, prismaSource } from '@infra/adapters/prisma';
import { typeormSource } from '@infra/adapters/typeorm';
import { DRIZZLE_CORPUS } from '../fixtures/drizzle-tables';
import { CORPUS_SCHEMAS } from '../fixtures/schemas';
import type { IntegrationContext } from './setup';

/**
 * Uma célula da matriz é (adapter × dialeto), e este módulo constrói o lado
 * do adapter (spec §19).
 *
 * O `setup.ts` cuida de conexão, perfil e seed; aqui só nasce a `QuerySource`.
 * A separação importa porque o seed **não** é por adapter: quem grava é sempre
 * o TypeORM, para que os bytes no banco sejam idênticos nas três células do
 * mesmo dialeto. Paridade compara leitura sobre os mesmos dados — se cada
 * adapter semeasse com sua própria representação de `DateTime` e `Decimal`, a
 * comparação mediria os seeders, não os compiladores.
 */
export type IntegrationAdapter = 'typeorm' | 'prisma' | 'drizzle';

const ADAPTERS: readonly IntegrationAdapter[] = [
  'typeorm',
  'prisma',
  'drizzle',
];

export function selectedAdapter(): IntegrationAdapter {
  const requested = process.env.DQB_ADAPTER;
  if (!requested) return 'typeorm';

  if (!ADAPTERS.includes(requested as IntegrationAdapter)) {
    throw new Error(
      `Unknown DQB_ADAPTER: ${requested}. Expected one of ${ADAPTERS.join(', ')}`
    );
  }
  return requested as IntegrationAdapter;
}

export interface Cell {
  /** Source do model referenciado pelo preset (`user.deep` -> `user`). */
  sourceFor(preset: string): AnyQuerySource;
  close(): Promise<void>;
}

export async function openCell(
  adapter: IntegrationAdapter,
  context: IntegrationContext
): Promise<Cell> {
  switch (adapter) {
    case 'typeorm':
      return openTypeOrmCell(context);
    case 'prisma':
      return openPrismaCell(context);
    case 'drizzle':
      return openDrizzleCell(context);
  }
}

const modelOf = (preset: string) => preset.split('.')[0];

/**
 * Kinds que o schema físico do TypeORM não revela sozinho.
 *
 * `post.id` e `tag.post_id` são UUID em coluna textual nos três bancos; sem
 * declarar, o adapter os trataria como string comum e a ordenação sairia da
 * collation em vez do valor.
 */
const FIELD_KINDS = {
  post: { id: 'uuid' },
  tag: { post_id: 'uuid' },
} as const;

function openTypeOrmCell(context: IntegrationContext): Cell {
  return {
    sourceFor: (preset) =>
      typeormSource(context.repositoryFor(preset), {
        fieldKinds: FIELD_KINDS,
      }) as AnyQuerySource,
    close: async () => {
      /* a conexão é do `setup.ts`, que já a fecha */
    },
  };
}

/** Provider do Prisma correspondente ao dialeto da célula. */
const PRISMA_PROVIDER = {
  postgres: 'postgresql',
  mysql: 'mysql',
  mssql: 'sqlserver',
} as const;

/** Diretório do client gerado, por dialeto (`pnpm prisma:generate:cell`). */
const PRISMA_GENERATED = {
  postgres: 'postgres',
  mysql: 'mysql',
  mssql: 'sqlserver',
} as const;

async function openPrismaCell(context: IntegrationContext): Promise<Cell> {
  const { dialect, url } = context;

  // `require` dinâmico de propósito: só o client do dialeto selecionado foi
  // gerado. Um import estático dos quatro caminhos quebraria o typecheck de
  // testes nas três células que não geraram nada.
  const generated = requireGenerated(
    `../adapters/prisma/generated/${PRISMA_GENERATED[dialect]}/client`
  );

  const adapter = await createPrismaDriverAdapter(dialect, url);
  const client = new generated.PrismaClient({ adapter }) as {
    $disconnect(): Promise<void>;
  };

  const manifest = createPrismaManifest({
    provider: PRISMA_PROVIDER[dialect],
    registry: CORPUS_SCHEMAS,
    models: {
      user: { delegate: 'user' },
      company: { delegate: 'company' },
      post: { delegate: 'post' },
      tag: { delegate: 'tag' },
    },
  });

  return {
    sourceFor: (preset) =>
      prismaSource({
        client: client as never,
        model: modelOf(preset),
        manifest,
      }) as AnyQuerySource,
    close: () => client.$disconnect(),
  };
}

/**
 * Driver adapter do Prisma para o dialeto, na mesma major do client (§6.2).
 *
 * MySQL usa o adapter do MariaDB: é o que o Prisma publica para o protocolo
 * MySQL, e não há um `@prisma/adapter-mysql2`.
 */
async function createPrismaDriverAdapter(
  dialect: 'postgres' | 'mysql' | 'mssql',
  url: string
): Promise<unknown> {
  if (dialect === 'postgres') {
    const { PrismaPg } = requireGenerated('@prisma/adapter-pg');
    return new PrismaPg({ connectionString: url });
  }

  if (dialect === 'mysql') {
    const { PrismaMariaDb } = requireGenerated('@prisma/adapter-mariadb');
    return new PrismaMariaDb(url);
  }

  const { PrismaMssql } = requireGenerated('@prisma/adapter-mssql');
  return new PrismaMssql(mssqlConfigFrom(url));
}

async function openDrizzleCell(context: IntegrationContext): Promise<Cell> {
  const { dialect, url } = context;
  const { client, close } = await openDrizzleClient(dialect, url);

  return {
    sourceFor: (preset) => {
      const entry = DRIZZLE_CORPUS[modelOf(preset)];
      return drizzleSource({
        db: drizzleDatabase({ client, dialect }),
        dialect,
        table: entry.table,
        relations: entry.relations,
      }) as AnyQuerySource;
    },
    close,
  };
}

async function openDrizzleClient(
  dialect: 'postgres' | 'mysql' | 'mssql',
  url: string
): Promise<{ client: DrizzleClientLike; close(): Promise<void> }> {
  if (dialect === 'postgres') {
    const loaded = requireGenerated('postgres');
    // `postgres-js` exporta a função no `module.exports`; sob `esModuleInterop`
    // ela pode chegar em `.default`.
    const postgres = (loaded.default ?? loaded) as (
      url: string,
      options: Record<string, unknown>
    ) => { end(): Promise<void> };
    const { drizzle } = requireGenerated('drizzle-orm/postgres-js');
    const sql = postgres(url, { max: 1 });
    return { client: drizzle({ client: sql }), close: () => sql.end() };
  }

  if (dialect === 'mysql') {
    const mysql = requireGenerated('mysql2/promise');
    const { drizzle } = requireGenerated('drizzle-orm/mysql2');
    // `Z` alinha a sessão ao UTC do perfil certificado; sem isso o driver
    // reinterpreta `DateTime` no fuso local e a paridade quebra por timezone.
    const connection = await mysql.createConnection({
      uri: url,
      timezone: 'Z',
    });
    return {
      client: drizzle({ client: connection }),
      close: () => connection.end(),
    };
  }

  const mssql = requireGenerated('mssql');
  const { drizzle } = requireGenerated('drizzle-orm/node-mssql');
  const pool = await new mssql.ConnectionPool(mssqlConfigFrom(url)).connect();
  return { client: drizzle({ client: pool }), close: () => pool.close() };
}

/**
 * `mssql://user:pass@host:port/db` -> config do driver `mssql`.
 *
 * O driver aceita a URL, mas não as opções de TLS do perfil local, que roda
 * sem certificado — então a config explícita é o único caminho.
 */
function mssqlConfigFrom(url: string): Record<string, unknown> {
  const parsed = new URL(url);

  return {
    server: parsed.hostname,
    port: Number(parsed.port || 1433),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    // `useUTC` explícito pelo mesmo motivo que o `timezone: 'Z'` do MySQL: o
    // perfil certificado é UTC, e uma sessão no fuso local do processo leria
    // `datetime2` como outro instante. É o default do `tedious`, mas fica
    // declarado para não depender dele — e porque é o que o `setup.ts` precisa
    // reafirmar contra o `useUTC: false` que o driver do TypeORM impõe.
    options: { encrypt: false, trustServerCertificate: true, useUTC: true },
  };
}

/**
 * `require` de módulo cujo formato não é conhecido em tempo de compilação.
 *
 * Os clients do Prisma são gerados por célula, então três dos quatro caminhos
 * não existem durante o typecheck. Isolar o `require` num lugar só, com o tipo
 * frouxo declarado e não escondido, mantém o resto do arquivo tipado — e deixa
 * óbvio onde a segurança de tipo termina.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
type LoadedModule = Record<string, any>;

function requireGenerated(id: string): LoadedModule {
  return require(id) as LoadedModule;
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
