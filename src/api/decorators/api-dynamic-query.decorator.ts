import { applyDecorators } from '@nestjs/common';
import { RulesConfig } from '@contracts/rules-config.interface';
import { ALL_OPERATORS } from '@domain/operators/operator.types';
import { DynamicQueryBuilderModule } from '@core/dynamic-query-builder.module';
import { DynamicQuery } from './dynamic-query.decorator';
import { buildDQBSwaggerDecorators } from '../swagger/dqb-swagger.builder';

export function resolveAllowedOperators<T = any>(
  rules: RulesConfig<T>
): typeof ALL_OPERATORS {
  const hasEndpointOperators = Object.prototype.hasOwnProperty.call(
    rules,
    'operators'
  );

  if (hasEndpointOperators) {
    return rules.operators?.allowed ?? ALL_OPERATORS;
  }

  return DynamicQueryBuilderModule.config?.operators?.allowed ?? ALL_OPERATORS;
}

/**
 * Registra as regras de query dinamica para o endpoint e gera documentacao Swagger.
 *
 * @example
 * ```ts
 * @Get()
 * @ApiDynamicQuery({
 *   filters: ['id', 'name', 'price'],
 *   sorts:   ['id', 'name', 'createdAt'],
 *   fields:  ['id', 'name', 'price', 'category'],
 *   includes: ['category'],
 *   search:  ['name', 'document', 'category.name'],
 * })
 * async findAll(@Query() query: DynamicQueryDto, @QueryRules() rules: RulesConfig) {
 *   return this.service.findAll(query, rules);
 * }
 * ```
 */
export function ApiDynamicQuery<T = any>(
  rules: RulesConfig<T>
): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    DynamicQuery(rules)(target, propertyKey, descriptor);

    const operators = resolveAllowedOperators(rules);

    applyDecorators(...buildDQBSwaggerDecorators(rules, operators))(
      target,
      propertyKey,
      descriptor
    );

    return descriptor;
  };
}
