import type { SchemaRegistry } from '@core/schema';

/** Providers do Prisma cobertos pela matriz da v3 mais SQLite de referência. */
export type PrismaProvider = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

export interface PrismaModelManifest {
  /** Propriedade do client gerado (`prisma.<delegate>`). */
  readonly delegate: string;
}

/**
 * Manifesto do Prisma (spec §15.2).
 *
 * Enquanto o generator a partir de `schema.prisma` não existe, o manifesto é
 * escrito à mão — mas continua sendo *validado*: model sem schema ou sem
 * delegate falha na inicialização, não na primeira request.
 */
export interface PrismaManifest {
  readonly provider: PrismaProvider;
  readonly registry: SchemaRegistry;
  readonly models: Readonly<Record<string, PrismaModelManifest>>;
}

export type PrismaManifestInput = PrismaManifest;

export interface PrismaDelegate {
  findMany(args: PrismaQueryArgs): Promise<readonly object[]>;
  count(args: PrismaCountArgs): Promise<number>;
}

export type PrismaClientLike = Readonly<Record<string, PrismaDelegate>>;

export interface PrismaSourceInput {
  readonly client: PrismaClientLike;
  readonly delegate: PrismaDelegate;
  readonly model: string;
  readonly manifest: PrismaManifest;
}

export interface PrismaSourceOptions {
  readonly client: PrismaClientLike;
  readonly model: string;
  readonly manifest: PrismaManifest;
}

export type PrismaWhere = Record<string, unknown>;
export type PrismaSelect = Record<string, true | { select: PrismaSelect }>;
export type PrismaOrderBy = Record<string, unknown>;

export interface PrismaQueryArgs {
  where?: PrismaWhere;
  select?: PrismaSelect;
  orderBy?: readonly PrismaOrderBy[];
  skip?: number;
  take?: number;
}

export interface PrismaCountArgs {
  where?: PrismaWhere;
}

/** Contexto entregue a `customize`, uma vez por query do escopo. */
export interface PrismaNativeQuery {
  readonly kind: 'data' | 'count';
  readonly args: PrismaQueryArgs | PrismaCountArgs;
}

export interface CompiledPrismaQuery {
  readonly delegate: PrismaDelegate;
  readonly data: PrismaQueryArgs;
  readonly count: PrismaCountArgs;
  readonly paginate: boolean;
}
