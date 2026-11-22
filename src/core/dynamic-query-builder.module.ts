import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import type { QueryBuilderConfigV3 } from '@contracts/v3';
import {
  assertQueryLimitsInput,
  resolveQueryLimits,
  type QueryLimits,
} from './semantic-validator';
import { configurationError } from './errors';
import { QueryBuilderService } from './query-builder.v3.service';
import { DQB_CONFIG_TOKEN } from './constants';

type ResolvedConfig = Required<
  Pick<
    QueryBuilderConfigV3,
    | 'pagination'
    | 'textProfile'
    | 'consistency'
    | 'logging'
    | 'portability'
    | 'errors'
  >
> & { readonly limits: QueryLimits };

const DEFAULTS: ResolvedConfig = {
  // `maxUnpaginatedRows` não tem default fixo: herda o `maxPerPage` efetivo,
  // resolvido em `forRoot`. Um só número responde "quantas linhas uma
  // resposta pode ter" até alguém decidir separar os dois.
  // `maxPerPage` voltou a 100 na `3.0.0` (foi 500 nos alphas 1 e 2): é o
  // mesmo teto da 2.x, e o default tem de ser o seguro — quem precisa de
  // páginas maiores declara.
  pagination: { defaultPerPage: 10, maxPerPage: 100, allowUnpaginated: true },
  textProfile: 'portable-strict',
  consistency: 'eventual',
  logging: { enabled: false, level: 'info', redactValues: true },
  portability: { enforce: false },
  errors: { exposeInternalDetails: false },
  limits: resolveQueryLimits(),
};

/** Chaves da v2 que deixaram de existir (spec §8.2 e §22). */
const REMOVED_KEYS = ['adapter', 'operators'] as const;

let _config: Readonly<ResolvedConfig> = DEFAULTS;

@Global()
@Module({})
export class DynamicQueryBuilderModule {
  /**
   * Configuração congelada, acessível fora da DI para uso nos decorators.
   */
  static get config(): Readonly<ResolvedConfig> {
    return _config;
  }

  /**
   * Configura apenas políticas comuns. Não existe adapter default implícito:
   * quem determina o adapter é a source passada a `execute()` (spec §8.2).
   */
  static forRoot(config: QueryBuilderConfigV3 = {}): DynamicModule {
    assertNoRemovedKeys(config);
    assertImplementedTextProfile(config);
    assertOfferedConsistency(config);
    assertBooleanPortabilityEnforce(config);
    assertQueryLimitsInput(config.limits, 'limits');
    assertBooleanExposeInternalDetails(config);

    const pagination = {
      defaultPerPage:
        config.pagination?.defaultPerPage ??
        DEFAULTS.pagination.defaultPerPage!,
      maxPerPage:
        config.pagination?.maxPerPage ?? DEFAULTS.pagination.maxPerPage!,
      allowUnpaginated:
        config.pagination?.allowUnpaginated ??
        DEFAULTS.pagination.allowUnpaginated!,
      maxUnpaginatedRows:
        config.pagination?.maxUnpaginatedRows ??
        config.pagination?.maxPerPage ??
        DEFAULTS.pagination.maxPerPage!,
    };

    if (pagination.maxPerPage < pagination.defaultPerPage) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        'pagination.maxPerPage must not be smaller than pagination.defaultPerPage',
        {
          defaultPerPage: pagination.defaultPerPage,
          maxPerPage: pagination.maxPerPage,
        }
      );
    }
    if (pagination.defaultPerPage < 1) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        'pagination.defaultPerPage must be at least 1',
        { defaultPerPage: pagination.defaultPerPage }
      );
    }

    if (typeof pagination.allowUnpaginated !== 'boolean') {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        'pagination.allowUnpaginated must be a boolean',
        { allowUnpaginated: pagination.allowUnpaginated }
      );
    }
    if (
      !Number.isSafeInteger(pagination.maxUnpaginatedRows) ||
      pagination.maxUnpaginatedRows < 1
    ) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        'pagination.maxUnpaginatedRows must be a positive integer',
        { maxUnpaginatedRows: pagination.maxUnpaginatedRows }
      );
    }

    _config = Object.freeze({
      pagination: Object.freeze(pagination),
      textProfile: config.textProfile ?? DEFAULTS.textProfile,
      consistency: config.consistency ?? DEFAULTS.consistency,
      logging: Object.freeze({ ...DEFAULTS.logging, ...config.logging }),
      // Sem esta chave o `QueryBuilderService` lia `portability.enforce` de uma
      // configuração que nunca a carregava, e `enforce: true` era descartado
      // calado (consumer report #5).
      portability: Object.freeze({
        enforce: config.portability?.enforce ?? DEFAULTS.portability.enforce!,
      }),
      errors: Object.freeze({
        exposeInternalDetails:
          config.errors?.exposeInternalDetails ??
          DEFAULTS.errors.exposeInternalDetails!,
      }),
      limits: resolveQueryLimits(config.limits),
    });

    const configProvider: Provider = {
      provide: DQB_CONFIG_TOKEN,
      useValue: _config,
    };

    return {
      module: DynamicQueryBuilderModule,
      providers: [configProvider, QueryBuilderService],
      exports: [QueryBuilderService],
    };
  }
}

/**
 * `database-native` é opção reservada, não perfil entregue (spec §12).
 *
 * Aceitá-la seria o pior dos dois mundos: quem a escolhesse perdia a checagem
 * de portabilidade e continuava recebendo compilação `portable-strict` — nenhum
 * adapter consulta o perfil e `validate-filter` usa a coluna dobrada sempre.
 * Degradação silenciosa é o que a §5.6 proíbe, então a configuração morre na
 * inicialização até que exista compilação de verdade por trás do nome.
 */
function assertImplementedTextProfile(config: QueryBuilderConfigV3): void {
  if (config.textProfile === undefined) return;
  if (config.textProfile === 'portable-strict') return;

  throw configurationError(
    'SOURCE_CONFIGURATION_INVALID',
    `textProfile "${config.textProfile}" is reserved and not implemented; only "portable-strict" changes compilation today (spec §12)`,
    { textProfile: config.textProfile }
  );
}

/**
 * `transactional` é garantia que nenhum adapter embarcado oferece (spec §14).
 *
 * "Falha cedo" é aqui, não uma vez por requisição: os três adapters declaram
 * `transactionalConsistency: false`, então aceitar a chave seria aceitar uma
 * configuração que reprova 100% das requisições com `CAPABILITY_UNAVAILABLE`.
 * A checagem por source em `QueryBuilderService` continua valendo — é ela que
 * decide o caso de um adapter de terceiro, e é o gate daqui que sai no dia em
 * que um adapter embarcado passar a oferecer a garantia.
 */
function assertOfferedConsistency(config: QueryBuilderConfigV3): void {
  if (config.consistency === undefined) return;
  if (config.consistency === 'eventual') return;

  throw configurationError(
    'SOURCE_CONFIGURATION_INVALID',
    `consistency "${config.consistency}" is not offered by any bundled adapter (typeorm, prisma, drizzle); every request would be refused with CAPABILITY_UNAVAILABLE (spec §14)`,
    { consistency: config.consistency }
  );
}

/**
 * `portability.enforce` liga uma checagem de segurança: um valor que não seja
 * booleano (`'false'` vindo de variável de ambiente, por exemplo) não pode ser
 * interpretado por truthiness em nenhuma das duas direções.
 */
function assertBooleanPortabilityEnforce(config: QueryBuilderConfigV3): void {
  const enforce = config.portability?.enforce;
  if (enforce === undefined || typeof enforce === 'boolean') return;

  throw configurationError(
    'SOURCE_CONFIGURATION_INVALID',
    'portability.enforce must be a boolean',
    { enforce }
  );
}

/**
 * Mesma razão de `portability.enforce`: `'false'` vindo de variável de
 * ambiente é truthy, e esta chave decide se nomes internos saem para o
 * cliente. Nenhuma das duas direções pode ser adivinhada.
 */
function assertBooleanExposeInternalDetails(
  config: QueryBuilderConfigV3
): void {
  const expose = config.errors?.exposeInternalDetails;
  if (expose === undefined || typeof expose === 'boolean') return;

  throw configurationError(
    'SOURCE_CONFIGURATION_INVALID',
    'errors.exposeInternalDetails must be a boolean',
    { exposeInternalDetails: expose }
  );
}

function assertNoRemovedKeys(config: QueryBuilderConfigV3): void {
  for (const key of REMOVED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      throw configurationError(
        'SOURCE_CONFIGURATION_INVALID',
        `forRoot no longer accepts "${key}"; see the "2.x → 3.x" section of MIGRATION.md`,
        { key }
      );
    }
  }
}
