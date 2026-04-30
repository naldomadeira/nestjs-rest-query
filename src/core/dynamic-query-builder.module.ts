import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { QueryBuilderConfig } from '@contracts/query-builder-config.interface';
import { QueryBuilderService } from './query-builder.service';
import { DQB_CONFIG_TOKEN } from './constants';

// Variavel de modulo — acessivel apenas neste arquivo, imutavel apos forRoot.
let _config: Readonly<QueryBuilderConfig> = {};

@Global()
@Module({})
export class DynamicQueryBuilderModule {
  static get config(): Readonly<QueryBuilderConfig> {
    return _config;
  }

  static forRoot(config: QueryBuilderConfig = {}): DynamicModule {
    _config = Object.freeze({ ...config });

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
