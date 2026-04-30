// Core — Module e Service
export { DynamicQueryBuilderModule } from './core/dynamic-query-builder.module';
export { QueryBuilderService } from './core/query-builder.service';
export { DQB_CONFIG_TOKEN } from './core/constants';

// API — Decorators
export { ApiDynamicQuery } from './api/decorators/api-dynamic-query.decorator';
export { DynamicQuery } from './api/decorators/dynamic-query.decorator';
export { QueryRules } from './api/decorators/query-rules.decorator';
export {
  ApiPaginatedResponse,
  type ApiPaginatedResponseOptions,
} from './api/decorators/api-paginated-response.decorator';

// API — DTOs
export { PaginationQueryDto, DynamicQueryDto } from './api/dtos';

// Contracts — Interfaces publicas
export type {
  QueryBuilderConfig,
  PaginationConfig,
  OperatorsConfig,
  LoggingConfig,
  LoggerLike,
} from './contracts/query-builder-config.interface';
export type { QueryInput } from './contracts/query-input.interface';
export type { QueryResult } from './contracts/query-result.interface';
export type { RulesConfig } from './contracts/rules-config.interface';
export type { EntityPaths } from './contracts/entity-paths.type';

// Domain — Tipos de operadores
export { Operator, ALL_OPERATORS } from './domain/operators/operator.types';
export type { QueryOperator } from './domain/operators/operator.types';

// API — Swagger
export { dqbSwaggerRequestInterceptor } from './api/swagger/swagger.interceptor';
