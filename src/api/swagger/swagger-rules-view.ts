import type { CompiledQueryRules } from '@core/authorization';
import type { QueryOperator } from '@domain/operators/operator.types';

/**
 * Visão achatada das regras compiladas, no formato que a documentação precisa.
 *
 * `CompiledQueryRules` é otimizada para consulta (Map/Set) e carrega o
 * registry inteiro; o gerador de Swagger só quer listas de paths. Manter a
 * conversão aqui evita que o builder conheça a estrutura interna das regras.
 */
export interface SwaggerRulesView {
  readonly filters: readonly string[];
  readonly sorts: readonly string[];
  readonly fields: readonly string[];
  readonly includes: readonly string[];
  readonly search: readonly string[];
  readonly operators: readonly QueryOperator[];
}

export function toSwaggerRulesView(
  rules: CompiledQueryRules
): SwaggerRulesView {
  const fields = [...rules.fields.root.allowed];
  for (const [relationPath, projection] of rules.fields.relations) {
    for (const column of projection.allowed) {
      fields.push(`${relationPath}.${column}`);
    }
  }

  // A união dos operadores por campo: a v3 não tem mais uma lista global.
  const operators = new Set<QueryOperator>();
  for (const allowed of rules.filters.values()) {
    for (const operator of allowed) operators.add(operator);
  }

  return {
    filters: [...rules.filters.keys()],
    sorts: [...rules.sorts],
    fields,
    includes: [...rules.includes],
    search: rules.search.map((target) => target.path),
    operators: [...operators],
  };
}
