import { applyDecorators } from '@nestjs/common';
import type { CompiledQueryRules } from '@core/authorization';
import { DynamicQuery } from './dynamic-query.decorator';
import { buildDQBSwaggerDecorators } from '../swagger/dqb-swagger.builder';
import { toSwaggerRulesView } from '../swagger/swagger-rules-view';

/**
 * Registra as regras compiladas do endpoint e gera a documentação Swagger.
 *
 * @example
 * ```ts
 * const rules = defineQueryRules(schema, 'product', {
 *   filters: [{ path: 'name', operators: ['eq', 'ilike'] }],
 *   sorts: ['id', 'name'],
 *   fields: { root: { allowed: ['id', 'name'], default: ['id', 'name'] } },
 * });
 *
 * @Get()
 * @ApiDynamicQuery(rules)
 * async findAll(@Query() query: DynamicQueryDto, @QueryRules() rules: CompiledQueryRules) {
 *   return this.service.findAll(query, rules);
 * }
 * ```
 */
export function ApiDynamicQuery(rules: CompiledQueryRules): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    DynamicQuery(rules)(target, propertyKey, descriptor);

    applyDecorators(...buildDQBSwaggerDecorators(toSwaggerRulesView(rules)))(
      target,
      propertyKey,
      descriptor
    );

    return descriptor;
  };
}
