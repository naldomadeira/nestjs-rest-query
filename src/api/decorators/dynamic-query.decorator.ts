import { SetMetadata } from '@nestjs/common';
import { RulesConfig } from '@contracts/rules-config.interface';
import { QUERY_RULES_METADATA_KEY } from '@core/constants';

/**
 * Registra as regras de query dinamica para o endpoint.
 *
 * Use este decorator em endpoints que nao precisam de documentacao Swagger.
 * Para endpoints documentados com Swagger, use {@link ApiDynamicQuery}.
 *
 * @example
 * ```ts
 * @Get('export')
 * @DynamicQuery({ filters: ['id', 'status'], sorts: ['id'] })
 * async export(@Query() query: DynamicQueryDto, @QueryRules() rules: RulesConfig) {
 *   return this.service.findAll(query, rules);
 * }
 * ```
 */
export const DynamicQuery = <T = any>(rules: RulesConfig<T>): MethodDecorator =>
  SetMetadata(QUERY_RULES_METADATA_KEY, rules);
