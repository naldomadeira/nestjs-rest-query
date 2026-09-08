import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  PatternEscapeMode,
  RestQueryAdapterV3,
  SqlDialect,
} from '@contracts/v3';
import { configurationError } from '@core/errors';
import type { TypedQueryPlan } from '@core/query-plan';
import type { QuerySchema } from '@core/schema';
import { compileWhere } from './prisma-filter.compiler';
import { compileSelect } from './prisma-projection.compiler';
import { compileOrderBy } from './prisma-sort.compiler';
import type {
  CompiledPrismaQuery,
  PrismaClientLike,
  PrismaDelegate,
  PrismaNativeQuery,
  PrismaProvider,
  PrismaQueryArgs,
  PrismaSourceInput,
  PrismaSourceOptions,
} from './prisma-query.interface';

const DIALECT_BY_PROVIDER: Readonly<Record<PrismaProvider, SqlDialect>> = {
  postgresql: 'postgres',
  mysql: 'mysql',
  sqlserver: 'mssql',
  sqlite: 'sqlite',
};

/**
 * Como cada dialeto torna `%` e `_` literais sob o Prisma (ADR-001, emenda 2).
 *
 * O Prisma nunca emite cláusula `ESCAPE` — `contains` compila para
 * `LIKE ('%' || ? || '%')` e o client tipado não permite acrescentar nada. Só
 * sobra o escape default do dialeto:
 *
 * - Postgres e MySQL têm `\` como default, então escapar o valor resolve.
 * - SQLite e SQL Server **não têm default**. Medido em SQLite:
 *   `LIKE 'a\_b'` sem cláusula casa a string literal `a\_b`, não `a_b`. Ali
 *   os cinco operadores de padrão são recusados com `CAPABILITY_UNAVAILABLE`,
 *   em vez de devolverem o conjunto errado de linhas.
 *
 * `$queryRaw` não é saída: a API tipada não aceita fragmento SQL dentro do
 * `where`, e pré-resolver para um conjunto de PKs bate no limite de 2100
 * parâmetros do SQL Server.
 */
const PATTERN_ESCAPE: Readonly<
  Record<SqlDialect, { mode: PatternEscapeMode; character: string }>
> = {
  postgres: { mode: 'native', character: '\\' },
  mysql: { mode: 'native', character: '\\' },
  sqlite: { mode: 'unsupported', character: '' },
  mssql: { mode: 'unsupported', character: '' },
};

/**
 * Adapter Prisma (spec §15.2).
 *
 * Prisma não faz join no sentido do SQL gerado pelo TypeORM: relações `many`
 * viram `some`/`none`, então o root nunca infla e a paginação em duas fases é
 * desnecessária. Data e count derivam do mesmo `where`.
 */
export class PrismaAdapter<
  TRow extends object = object,
> implements RestQueryAdapterV3<
  PrismaSourceInput,
  CompiledPrismaQuery,
  TRow,
  PrismaNativeQuery
> {
  readonly id = 'prisma' as const;

  async describe(source: PrismaSourceInput): Promise<QuerySchema> {
    const schema = source.manifest.registry.get(source.model);
    if (!schema) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `Prisma model ${source.model} is not present in the manifest`,
        { model: source.model }
      );
    }
    return schema;
  }

  capabilities(source: PrismaSourceInput): AdapterCapabilities {
    const dialect = DIALECT_BY_PROVIDER[source.manifest.provider];
    const escape = PATTERN_ESCAPE[dialect];

    return {
      dialect,
      transactionalConsistency: false,
      escapeCharacter: escape.character,
      patternEscape: escape.mode,
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: PrismaSourceInput
  ): CompiledPrismaQuery {
    const { escapeCharacter, patternEscape } = this.capabilities(source);
    const where = compileWhere(plan, { escapeCharacter, patternEscape });
    const data: PrismaQueryArgs = {
      ...(where ? { where } : {}),
      select: compileSelect(plan),
      orderBy: compileOrderBy(plan),
      ...(plan.pagination.paginate
        ? {
            skip: (plan.pagination.page - 1) * plan.pagination.perPage,
            take: plan.pagination.perPage,
          }
        : {}),
    };

    return {
      delegate: source.delegate,
      data,
      count: where ? { where } : {},
      paginate: plan.pagination.paginate,
    };
  }

  customize(
    compiled: CompiledPrismaQuery,
    callback: (native: PrismaNativeQuery) => void,
    scope: CustomizeScope = 'both'
  ): void {
    if (scope === 'data' || scope === 'both') {
      callback({ kind: 'data', args: compiled.data });
    }
    if (scope === 'count' || scope === 'both') {
      callback({ kind: 'count', args: compiled.count });
    }
  }

  async execute(compiled: CompiledPrismaQuery): Promise<AdapterResult<TRow>> {
    const rows = toRows<TRow>(await compiled.delegate.findMany(compiled.data));
    const total = compiled.paginate
      ? await compiled.delegate.count(compiled.count)
      : undefined;

    return {
      rows,
      total,
      queryCount: compiled.paginate ? 2 : 1,
    };
  }
}

/**
 * Busca o delegate no client e prova que ele é um delegate.
 *
 * `Reflect.get` em vez de índice porque `PrismaClientLike` é `object`: o nome
 * do delegate vem do manifesto, que é dado, e nenhum tipo poderia garantir sua
 * presença. O que substitui a garantia estática é esta checagem, que roda uma
 * vez na construção da source — não por query — e falha fechado antes de
 * qualquer acesso ao banco.
 */
function isDelegate(value: unknown): value is PrismaDelegate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'findMany') === 'function' &&
    typeof Reflect.get(value, 'count') === 'function'
  );
}

function resolveDelegate(
  client: PrismaClientLike,
  delegateName: string,
  model: string
): PrismaDelegate {
  const candidate: unknown = Reflect.get(client, delegateName);

  if (!isDelegate(candidate)) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Prisma delegate ${delegateName} for model ${model} is missing from the client`,
      { model, delegate: delegateName }
    );
  }

  return candidate;
}

/**
 * Estreita o retorno do `findMany` (ver `PrismaDelegate`) por checagem.
 *
 * Linha que não é objeto não existe no protocolo do Prisma: se aparecer, é
 * violação de contrato do client, e o adapter diz isso em vez de repassar o
 * dado adiante para estourar no normalizador, longe da causa.
 *
 * `TRow` é o que o consumidor declarou em `prismaSource<TRow>()`, e a checagem
 * prova o quanto dá para provar aqui: que veio um array de objetos. O client
 * gerado devolve `PrismaPromise<unknown>` para os argumentos dinâmicos que o
 * plano monta (ver `PrismaDelegate`), então nenhum tipo do Prisma poderia
 * refinar isso — a forma da linha é a promessa de quem escreveu a rota, do
 * mesmo jeito que `Repository<T>` é a do TypeORM. O que **não** existe aqui é
 * afirmação escondida: a promessa está na assinatura pública.
 */
function toRows<TRow extends object>(result: unknown): readonly TRow[] {
  const isRow = (row: unknown): row is TRow =>
    typeof row === 'object' && row !== null;

  if (!Array.isArray(result) || !result.every(isRow)) {
    throw configurationError(
      'ADAPTER_CONTRACT_VIOLATION',
      'Prisma findMany did not return an array of rows',
      {}
    );
  }

  return result;
}

/**
 * Source discriminada do Prisma (spec §8.1).
 *
 * O delegate é resolvido pelo manifesto, nunca por uma string livre vinda do
 * chamador: model fora do manifesto e delegate ausente do client falham antes
 * de qualquer query.
 *
 * `TRow` é o tipo da linha e atravessa daqui até o retorno de `execute()`:
 * um consumidor que declarava `Promise<QueryResult<UserDto>>` na v2 escreve
 * `prismaSource<UserDto>({ ... })` e não precisa de cast em lugar nenhum, que
 * é o que o gate §23 exige do uso público documentado.
 */
export function prismaSource<TRow extends object = object>(
  options: PrismaSourceOptions
): QuerySource<
  PrismaSourceInput,
  CompiledPrismaQuery,
  TRow,
  PrismaNativeQuery
> {
  const model = options.manifest.models[options.model];
  if (!model) {
    throw configurationError(
      'SOURCE_CONFIGURATION_INVALID',
      `Prisma model ${options.model} is not present in the manifest`,
      { model: options.model }
    );
  }

  const delegate = resolveDelegate(
    options.client,
    model.delegate,
    options.model
  );

  return {
    kind: 'prisma',
    // Uma instância por source, e não um singleton: o adapter é genérico no
    // tipo da linha e não guarda estado entre chamadas, então isto custa um
    // objeto vazio e evita a única alternativa — afirmar que um
    // `PrismaAdapter<object>` serve como `PrismaAdapter<TRow>`.
    adapter: new PrismaAdapter<TRow>(),
    input: {
      client: options.client,
      delegate,
      model: options.model,
      manifest: options.manifest,
    },
  };
}
