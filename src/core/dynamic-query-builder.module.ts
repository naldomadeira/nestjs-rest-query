import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import type { QueryBuilderConfigV3 } from '@contracts/v3';
import { configurationError } from './errors';
import { QueryBuilderService } from './query-builder.v3.service';
import { DQB_CONFIG_TOKEN } from './constants';

type ResolvedConfig = Required<
  Pick<
    QueryBuilderConfigV3,
    'pagination' | 'textProfile' | 'consistency' | 'logging'
  >
>;

const DEFAULTS: ResolvedConfig = {
  pagination: { defaultPerPage: 20, maxPerPage: 100 },
  textProfile: 'portable-strict',
  consistency: 'eventual',
  logging: { enabled: false, level: 'info', redactValues: true },
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

    const pagination = {
      defaultPerPage:
        config.pagination?.defaultPerPage ??
        DEFAULTS.pagination.defaultPerPage!,
      maxPerPage:
        config.pagination?.maxPerPage ?? DEFAULTS.pagination.maxPerPage!,
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

    _config = Object.freeze({
      pagination: Object.freeze(pagination),
      textProfile: config.textProfile ?? DEFAULTS.textProfile,
      consistency: config.consistency ?? DEFAULTS.consistency,
      logging: Object.freeze({ ...DEFAULTS.logging, ...config.logging }),
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
