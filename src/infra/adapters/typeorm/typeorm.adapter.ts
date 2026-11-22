import type {
  EntityMetadata,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import type {
  AdapterCapabilities,
  AdapterResult,
  CustomizeScope,
  QuerySource,
  RestQueryAdapterV3,
  SqlDialect,
} from '@contracts/v3';
import type { ProfileFacts } from '@core/portability';
import { configurationError } from '@core/errors';
import type { QuerySchema } from '@core/schema';
import type { TypedQueryPlan } from '@core/query-plan';
import {
  buildSchemaRegistry,
  modelName,
  type SchemaResolverOptions,
} from './typeorm-schema.resolver';
import { compilePlan, type CompiledTypeOrmQuery } from './compile-plan';
import { executeCompiled } from './typeorm-pagination';

export interface TypeOrmSourceInput<T extends ObjectLiteral> {
  readonly repository: Repository<T>;
  readonly schema?: SchemaResolverOptions;
}

export interface TypeOrmSourceOptions extends SchemaResolverOptions {
  readonly portabilityProfile?: ProfileFacts;
}

/**
 * Caractere de escape dos padrões literais, por dialeto.
 *
 * Não é a barra invertida: o MySQL processa `\` dentro de literais de string,
 * então `ESCAPE '\'` deixa a aspas sem fechar e o SQL não compila. `!` não tem
 * significado em literal nem em LIKE em nenhuma das famílias, o que dá o mesmo
 * comportamento nas quatro pontas com uma única escolha.
 *
 * Mantê-lo no adapter, e não no núcleo, é o que permite trocar a escolha por
 * dialeto sem tocar na semântica.
 */
const ESCAPE_CHARACTER: Readonly<Record<SqlDialect, string>> = {
  postgres: '!',
  mysql: '!',
  mssql: '!',
  sqlite: '!',
};

const DIALECT_BY_DRIVER: Readonly<Record<string, SqlDialect>> = {
  postgres: 'postgres',
  aurora_postgres: 'postgres',
  cockroachdb: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  aurora_mysql: 'mysql',
  mssql: 'mssql',
  sqlite: 'sqlite',
  'better-sqlite3': 'sqlite',
};

/** Chave para "sem `fieldKinds`", que não pode ser chave de `WeakMap`. */
const NO_FIELD_KINDS = Object.freeze({});

const SCHEMA_CACHE = new WeakMap<
  EntityMetadata,
  WeakMap<object, QuerySchema>
>();

/**
 * Schema lógico memoizado por (metadata da entidade, `fieldKinds`) — consumer
 * report #7.
 *
 * `typeormSource(this.repo)` a cada requisição é o uso documentado, e sem isto
 * cada chamada percorria a metadata da entidade e das relações de novo. A
 * metadata é estável durante a vida do `DataSource` e é o que o resolver lê;
 * `fieldKinds` muda o schema, então entra na chave por identidade — declarado
 * uma vez no módulo, ele acerta; criado inline a cada chamada, só não acerta.
 */
function describeMemoized<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: SchemaResolverOptions | undefined
): QuerySchema {
  const metadata = repository.metadata;
  const kindsKey = options?.fieldKinds ?? NO_FIELD_KINDS;

  let byKinds = SCHEMA_CACHE.get(metadata);
  if (!byKinds) {
    byKinds = new WeakMap();
    SCHEMA_CACHE.set(metadata, byKinds);
  }
  let schema = byKinds.get(kindsKey);
  if (!schema) {
    schema = buildSchemaRegistry(repository, options).get(modelName(metadata))!;
    byKinds.set(kindsKey, schema);
  }
  return schema;
}

export class TypeOrmAdapter<
  T extends ObjectLiteral,
> implements RestQueryAdapterV3<
  TypeOrmSourceInput<T>,
  CompiledTypeOrmQuery<T>,
  T,
  SelectQueryBuilder<T>
> {
  readonly id = 'typeorm' as const;

  async describe(source: TypeOrmSourceInput<T>): Promise<QuerySchema> {
    return describeMemoized(source.repository, source.schema);
  }

  capabilities(source: TypeOrmSourceInput<T>): AdapterCapabilities {
    const driver = source.repository.manager.connection.options.type;
    const dialect = DIALECT_BY_DRIVER[driver];

    if (!dialect) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `TypeORM driver "${driver}" is not part of the supported matrix`,
        { driver }
      );
    }

    return {
      dialect,
      transactionalConsistency: false,
      escapeCharacter: ESCAPE_CHARACTER[dialect],
      // Emite `ESCAPE '<char>'` em todo LIKE, então não depende de default.
      patternEscape: 'clause',
    };
  }

  compile(
    plan: TypedQueryPlan,
    source: TypeOrmSourceInput<T>
  ): CompiledTypeOrmQuery<T> {
    return compilePlan(
      plan,
      source.repository,
      this.capabilities(source).escapeCharacter
    );
  }

  customize(
    compiled: CompiledTypeOrmQuery<T>,
    callback: (native: SelectQueryBuilder<T>) => void,
    scope: CustomizeScope = 'both'
  ): void {
    // Uma invocação por query do escopo: é o que faz `both`, o default seguro,
    // atingir data e count com um único `qb.andWhere(...)` (spec §16).
    const targets =
      scope === 'data'
        ? [compiled.data]
        : scope === 'count'
          ? [compiled.count]
          : [compiled.data, compiled.count];

    for (const query of targets) callback(query);
    if (scope === 'data' || scope === 'both') {
      compiled.keyCustomizers.push(callback);
    }
  }

  execute(compiled: CompiledTypeOrmQuery<T>): Promise<AdapterResult<T>> {
    return executeCompiled(compiled);
  }
}

const sharedAdapter = new TypeOrmAdapter<ObjectLiteral>();

/**
 * Cria a source discriminada do TypeORM (spec §8.1).
 *
 * @example
 * ```ts
 * await queryService.execute(typeormSource(repository), query, rules);
 * ```
 */
export function typeormSource<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: TypeOrmSourceOptions = {}
): QuerySource<
  TypeOrmSourceInput<T>,
  CompiledTypeOrmQuery<T>,
  T,
  SelectQueryBuilder<T>
> {
  return {
    kind: 'typeorm',
    adapter: sharedAdapter as unknown as RestQueryAdapterV3<
      TypeOrmSourceInput<T>,
      CompiledTypeOrmQuery<T>,
      T,
      SelectQueryBuilder<T>
    >,
    input: { repository, schema: { fieldKinds: options.fieldKinds } },
    portabilityProfile: options.portabilityProfile,
  };
}
