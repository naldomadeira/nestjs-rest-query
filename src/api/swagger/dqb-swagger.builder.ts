import { RulesConfig } from '@contracts/rules-config.interface';
import { QueryOperator } from '@domain/operators/operator.types';
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

function buildOperatorsTable(operators: QueryOperator[]): string {
  const COLS = 4;
  const header =
    Array(COLS)
      .fill('Operador')
      .map((h) => `| ${h} `)
      .join('') + '|';
  const separator = Array(COLS).fill('|----------').join('') + '|';
  const rows: string[] = [];
  for (let i = 0; i < operators.length; i += COLS) {
    const chunk = operators.slice(i, i + COLS);
    const cells = chunk.map((op) => `| \`${op}\` `).join('');
    const padding = Array(COLS - chunk.length)
      .fill('| ')
      .join('');
    rows.push(cells + padding + '|');
  }
  return [header, separator, ...rows].join('\n');
}

export function buildDQBSwaggerDecorators(
  rules: RulesConfig,
  operators: QueryOperator[]
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
    ApiQuery({
      name: 'paginate',
      required: false,
      type: Boolean,
      description: 'Desabilita paginacao quando `false`.',
      example: true,
    }),
  ];

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

  if (rules.filters?.length) {
    const first = rules.filters[0];
    decorators.push(
      ApiQuery({
        name: 'filter',
        required: false,
        type: String,
        description: [
          'Filtros dinamicos. Formato: `filter[campo][operador]=valor`',
          '',
          `**Campos disponiveis:** ${rules.filters.map((f) => `\`${f}\``).join(', ')}`,
          '',
          '**Operadores disponiveis:**',
          '',
          buildOperatorsTable(operators),
        ].join('\n'),
        examples: {
          simples: {
            summary: 'Filtros',
            description: `filter[${first}][eq]=valor - eq é opcional`,
            value: `filter[${first}][eq]=valor`,
          },
          intervalo: {
            summary: 'Entre dois valores',
            description: `filter[id][between]=1,100`,
            value: `filter[id][between]=1,100`,
          },
          nulo: {
            summary: 'Campo nulo',
            description: `filter[${first}][isNull]=true`,
            value: `filter[${first}][isNull]=true`,
          },
        },
      })
    );
  }

  return decorators;
}
