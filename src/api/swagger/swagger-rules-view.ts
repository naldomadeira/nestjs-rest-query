import type { CompiledQueryRules } from '@core/authorization';
import type { QueryOperator } from '@domain/operators/operator.types';

/**
 * Visão achatada das regras compiladas, no formato que a documentação precisa.
 *
 * `CompiledQueryRules` é otimizada para consulta (Map/Set) e carrega o
 * registry inteiro; o gerador de Swagger só quer listas de paths. Manter a
 * conversão aqui evita que o builder conheça a estrutura interna das regras.
 */
export interface SwaggerFilterView {
  readonly path: string;
  /** Na ordem em que o endpoint os declarou. */
  readonly operators: readonly QueryOperator[];
}

export interface SwaggerRulesView {
  readonly filters: readonly string[];
  /**
   * Operadores **por campo**. A documentação não pode mostrar a união: um
   * operador de um campo não vale para os outros, e a união sugeria
   * `filter[active][between]` num campo que só aceita `eq` (consumer report
   * #7).
   */
  readonly filterOperators: readonly SwaggerFilterView[];
  readonly sorts: readonly string[];
  readonly fields: readonly string[];
  readonly includes: readonly string[];
  readonly search: readonly string[];
  /** `false` quando o endpoint recusa `?paginate=false`. */
  readonly allowUnpaginated: boolean;
  /** Teto declarado pelo endpoint; ausente, vale o global. */
  readonly maxUnpaginatedRows?: number;
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

  return {
    filters: [...rules.filters.keys()],
    filterOperators: [...rules.filters].map(([path, operators]) => ({
      path,
      operators: [...operators],
    })),
    sorts: [...rules.sorts],
    fields,
    includes: [...rules.includes],
    search: rules.search.map((target) => target.path),
    allowUnpaginated: rules.pagination?.allowUnpaginated !== false,
    ...(rules.pagination?.maxUnpaginatedRows !== undefined
      ? { maxUnpaginatedRows: rules.pagination.maxUnpaginatedRows }
      : {}),
  };
}
