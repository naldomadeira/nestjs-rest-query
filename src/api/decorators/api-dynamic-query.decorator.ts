import { applyDecorators } from '@nestjs/common';
import type { CompiledQueryRules } from '@core/authorization';
import { ALL_OPERATORS } from '@domain/operators/operator.types';
import type { QueryOperator } from '@domain/operators/operator.types';
import { DynamicQuery } from './dynamic-query.decorator';
import { buildDQBSwaggerDecorators } from '../swagger/dqb-swagger.builder';
import { toSwaggerRulesView } from '../swagger/swagger-rules-view';

/**
 * Operadores a documentar: a união do que os campos do endpoint autorizam.
 *
 * A v3 não tem lista global de operadores — cada campo declara os seus, então
 * a documentação reflete exatamente o que o endpoint aceita. Quando nenhum
 * filtro é declarado, cai na lista completa apenas para não gerar tabela vazia.
 */
export function resolveAllowedOperators(
  rules: CompiledQueryRules
): readonly QueryOperator[] {
  const view = toSwaggerRulesView(rules);
  return view.operators.length > 0 ? view.operators : ALL_OPERATORS;
}

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

    applyDecorators(
      ...buildDQBSwaggerDecorators(
        toSwaggerRulesView(rules),
        resolveAllowedOperators(rules)
      )
    )(target, propertyKey, descriptor);

    return descriptor;
  };
}
