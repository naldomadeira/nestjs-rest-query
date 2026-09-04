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
