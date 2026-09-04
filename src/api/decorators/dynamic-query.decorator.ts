import { SetMetadata } from '@nestjs/common';
import type { CompiledQueryRules } from '@core/authorization';
import { QUERY_RULES_METADATA_KEY } from '@core/constants';

/**
 * Registra as regras compiladas do endpoint.
 *
 * Use em endpoints sem documentação Swagger; para os documentados, use
 * {@link ApiDynamicQuery}.
 *
 * @example
 * ```ts
 * const rules = defineQueryRules(schema, 'product', {
 *   filters: [{ path: 'id', operators: ['eq', 'in'] }],
 *   sorts: ['id'],
 *   fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
 * });
 *
 * @Get('export')
 * @DynamicQuery(rules)
 * async export(@Query() query: DynamicQueryDto, @QueryRules() rules: CompiledQueryRules) {
 *   return this.service.findAll(query, rules);
 * }
 * ```
 */
export const DynamicQuery = (rules: CompiledQueryRules): MethodDecorator =>
  SetMetadata(QUERY_RULES_METADATA_KEY, rules);
