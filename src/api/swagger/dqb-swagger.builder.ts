import type { QueryOperator } from '@domain/operators/operator.types';
import type { SwaggerFilterView, SwaggerRulesView } from './swagger-rules-view';
import { DQB_SWAGGER_EXTENSION_KEY } from './swagger.interceptor';

type ApiQueryFn = (typeof import('@nestjs/swagger'))['ApiQuery'];
type ApiExtensionFn = (typeof import('@nestjs/swagger'))['ApiExtension'];

let ApiQuery: ApiQueryFn | undefined;
let ApiExtension: ApiExtensionFn | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ApiQuery = require('@nestjs/swagger').ApiQuery;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ApiExtension = require('@nestjs/swagger').ApiExtension;
} catch {
  // @nestjs/swagger nao instalado — Swagger docs desabilitado
}

/**
 * Uma linha por campo, com só os operadores que **aquele** campo autoriza
 * (consumer report #7): a tabela antiga era a união do endpoint e sugeria
 * combinações que davam 400.
 */
function buildOperatorsTable(filters: readonly SwaggerFilterView[]): string {
  return [
    '| Campo | Operadores |',
    '|-------|------------|',
    ...filters.map(
      (filter) =>
        `| \`${filter.path}\` | ${filter.operators.map((op) => `\`${op}\``).join(', ')} |`
    ),
  ].join('\n');
}

/** Primeiro campo que autoriza o operador, para o exemplo nunca mentir. */
function firstWith(
  filters: readonly SwaggerFilterView[],
  operator: QueryOperator
): string | undefined {
  return filters.find((filter) => filter.operators.includes(operator))?.path;
}

export function buildDQBSwaggerDecorators(
  rules: SwaggerRulesView
): MethodDecorator[] {
  if (!ApiQuery || !ApiExtension) return [];

  const decorators: MethodDecorator[] = [
    ApiExtension(DQB_SWAGGER_EXTENSION_KEY, true),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Numero da pagina.',
      example: 1,
    }),
    ApiQuery({
      name: 'perPage',
      required: false,
      type: Number,
      description: 'Quantidade de itens por pagina.',
      example: 10,
    }),
  ];

  // Um endpoint que recusa `paginate=false` não documenta o parâmetro: a
  // única coisa que o Swagger UI poderia fazer com ele é produzir um 400.
  if (rules.allowUnpaginated) {
    const cap =
      rules.maxUnpaginatedRows !== undefined
        ? `${rules.maxUnpaginatedRows} linhas`
        : '`maxUnpaginatedRows` linhas (default: `maxPerPage`)';
    decorators.push(
      ApiQuery({
        name: 'paginate',
        required: false,
        type: Boolean,
        description: [
          'Desabilita paginacao quando `false`.',
          '',
          `Sem paginacao a resposta tem teto de ${cap}; acima dele a resposta e 400 \`PAGINATION_INVALID\`, nunca uma lista truncada.`,
        ].join('\n'),
        example: true,
      })
    );
  }

  if (rules.sorts?.length) {
    decorators.push(
      ApiQuery({
        name: 'sort',
        required: false,
        type: String,
        description: [
          'Ordenacao dos resultados. Use `-` para ordem decrescente.',
          '',
          `**Disponiveis:** ${rules.sorts.map((s) => `\`${s}\``).join(', ')}`,
        ].join('\n'),
        examples: {
          crescente: {
            summary: `Crescente por ${rules?.sorts[0] ?? 'id'}`,
            value: rules.sorts[0],
          },
          decrescente: {
            summary: `Decrescente por -${rules?.sorts[0] ?? '-id'}`,
            value: `-${rules.sorts[0]}`,
          },
        },
      })
    );
  }

  if (rules.fields?.length) {
    decorators.push(
      ApiQuery({
        name: 'fields',
        required: false,
        type: String,
        description: [
          'Campos a retornar (separados por virgula).',
          '',
          `**Disponiveis:** ${rules.fields.map((f) => `\`${f}\``).join(', ')}`,
        ].join('\n'),
        example: rules.fields.slice(0, 3).join(','),
      })
    );
  }

  if (rules.includes?.length) {
    decorators.push(
      ApiQuery({
        name: 'includes',
        required: false,
        type: String,
        description: [
          'Relacionamentos a incluir (separados por virgula).',
          '',
          `**Disponiveis:** ${rules.includes.map((i) => `\`${i}\``).join(', ')}`,
        ].join('\n'),
        example: rules.includes[0],
      })
    );
  }

  if (rules.search?.length) {
    decorators.push(
      ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: [
          'Busca textual (case-insensitive). Pesquisa em multiplos campos com OR.',
          '',
          `**Campos pesquisados:** ${rules.search.map((s) => `\`${s}\``).join(', ')}`,
        ].join('\n'),
        example: '',
      })
    );
  }

  if (rules.filterOperators.length) {
    const first = rules.filterOperators[0];
    const examples: Record<
      string,
      { summary: string; description: string; value: string }
    > = {
      simples: {
        summary: 'Filtro',
        description: `filter[${first.path}][${first.operators[0]}]=valor`,
        value: `filter[${first.path}][${first.operators[0]}]=valor`,
      },
    };
    const between = firstWith(rules.filterOperators, 'between');
    if (between) {
      examples.intervalo = {
        summary: 'Entre dois valores',
        description: `filter[${between}][between]=1,100`,
        value: `filter[${between}][between]=1,100`,
      };
    }
    const isNull = firstWith(rules.filterOperators, 'isNull');
    if (isNull) {
      examples.nulo = {
        summary: 'Campo nulo',
        description: `filter[${isNull}][isNull]=true`,
        value: `filter[${isNull}][isNull]=true`,
      };
    }

    decorators.push(
      ApiQuery({
        name: 'filter',
        required: false,
        type: String,
        description: [
          'Filtros dinamicos. Formato: `filter[campo][operador]=valor`; `filter[campo]=valor` equivale a `eq`.',
          '',
          '**Operadores por campo:**',
          '',
          buildOperatorsTable(rules.filterOperators),
        ].join('\n'),
        examples,
      })
    );
  }

  return decorators;
}
