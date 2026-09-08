// ---------------------------------------------------------------------------
// Entrypoint raiz do nestjs-rest-query v3.
//
// O root não carrega nenhum peer de ORM e não exporta classes runtime de
// adapter (spec §20). Importe o adapter pelo seu subpath:
//
//   import { typeormSource } from 'nestjs-rest-query/typeorm';
// ---------------------------------------------------------------------------

// Core — módulo e serviço
export { DynamicQueryBuilderModule } from './core/dynamic-query-builder.module';
export {
  QueryBuilderService,
  type ExecuteOptions,
} from './core/query-builder.v3.service';
export { DQB_CONFIG_TOKEN } from './core/constants';

// Núcleo semântico — schema, regras e perfil textual
export {
  defineQuerySchema,
  hasTotalPortableOrder,
  type FieldDescriptor,
  type QuerySchema,
  type QuerySchemaInput,
  type RelationDescriptor,
  type ScalarKind,
  type SchemaRegistry,
} from './core/schema';
export {
  defineQueryRules,
  type CompiledQueryRules,
  type FieldProjectionInput,
  type FilterRuleInput,
  type QueryRulesInput,
} from './core/authorization';
export { foldText } from './core/text-profile';

// Núcleo semântico — plano e resultado
export {
  buildQueryPlan,
  type BuildPlanOptions,
  type ConsistencyMode,
  type PlanProjection,
  type TextProfile,
  type TypedQueryPlan,
} from './core/query-plan';
export type {
  PlanFilter,
  PlanPagination,
  PlanSearch,
  PlanSort,
} from './core/semantic-validator';
export type { NormalizedQueryResult } from './core/result-normalizer';
export { CivilDate, DecimalValue } from './core/coercion';

// Erros
export {
  RestQueryError,
  RestQueryErrorCode,
  toHttpException,
  type ErrorDetails,
  type RestQueryErrorEnvelope,
} from './core/errors';

// Perfil certificado de banco
export {
  assertProfileFacts,
  checkPortabilityProfile,
  collectProfileFacts,
  type CollectProfileFactsOptions,
  type ProfileColumnRef,
  type ProfileDialect,
  type ProfileFacts,
  type ProfileQueryRunner,
  type ProfileViolation,
} from './core/portability';

// API — decorators e DTOs
export { ApiDynamicQuery } from './api/decorators/api-dynamic-query.decorator';
export { DynamicQuery } from './api/decorators/dynamic-query.decorator';
export { QueryRules } from './api/decorators/query-rules.decorator';
export {
  ApiPaginatedResponse,
  type ApiPaginatedResponseOptions,
} from './api/decorators/api-paginated-response.decorator';
export { DynamicQueryDto } from './api/dtos';
// `PaginationQueryDto` é um alias de tipo, não uma classe.
export type { PaginationQueryDto } from './api/dtos';
export { dqbSwaggerRequestInterceptor } from './api/swagger/swagger.interceptor';

// Contratos — apenas tipos; nenhum runtime de ORM cruza esta fronteira
export type {
  AdapterCapabilities,
  PatternEscapeMode,
  AdapterResult,
  AnyQuerySource,
  CustomizeScope,
  LoggingConfigV3,
  PaginationConfigV3,
  PortabilityConfigV3,
  QueryBuilderConfigV3,
  QuerySource,
  RestQueryAdapterV3,
  SqlDialect,
} from './contracts/v3';
export type { QueryInput } from './contracts/query-input.interface';
export type { QueryResult } from './contracts/query-result.interface';
export type { LoggerLike } from './contracts/query-builder-config.interface';

// Operadores
export { Operator, ALL_OPERATORS } from './domain/operators/operator.types';
export type { QueryOperator } from './domain/operators/operator.types';
