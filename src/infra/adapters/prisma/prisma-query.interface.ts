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

/**
 * Delegate do Prisma como a v3 o chama.
 *
 * Os parâmetros são `unknown` **de propósito**, e é a diferença entre a v3 ser
 * usável de fora e não ser. O delegate gerado declara
 * `findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs>)`,
 * e `PrismaQueryArgs` — cujo `where` é `Record<string, unknown>` — não estende
 * `UserFindManyArgs`. Declarar aqui o tipo preciso tornaria o client gerado
 * não atribuível, e **todo** consumidor precisaria de um cast no uso
 * documentado, contra o gate §23.
 *
 * Métodos são bivariantes nos parâmetros em TypeScript, então a forma frouxa
 * aceita o delegate real sem afrouxar nada do lado de quem chama: `compile()`
 * continua produzindo `PrismaQueryArgs` tipado, e é isso que vai ao client.
 *
 * O retorno é `unknown` pela mesma razão (`PrismaPromise<GetFindResult<…>[]>`)
 * e é estreitado no adapter por checagem, nunca por afirmação.
 */
export interface PrismaDelegate {
  findMany(args: unknown): Promise<unknown>;
  count(args: unknown): Promise<number>;
}

/**
 * O client do Prisma, tipado pelo que a v3 realmente exige dele: ser um objeto
 * do qual se busca um delegate por nome.
 *
 * Não pode ser `Readonly<Record<string, PrismaDelegate>>`, que é o que era até
 * a medição do exemplo 04: o client gerado é uma **classe**, e classe não
 * recebe index signature implícita em TypeScript — só type alias recebe. Com
 * o tipo de registro, nenhum `PrismaClient` real é atribuível, e o exemplo
 * precisou de uma ponte de 20 linhas para atravessar a fronteira. É o mesmo
 * defeito do commit `5fd238c`, do outro lado dela.
 *
 * O que garante a forma não é o tipo, é `prismaSource`: o delegate é buscado
 * pelo nome que o manifesto declara e **validado em runtime**, falhando com
 * `SOURCE_CONFIGURATION_INVALID` na inicialização se não expuser `findMany` e
 * `count`. Validação em runtime é o que o tipo nunca poderia dar aqui — o
 * nome do delegate vem de dado, não de código.
 */
export type PrismaClientLike = object;

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
