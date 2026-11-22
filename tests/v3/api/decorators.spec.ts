import { QUERY_RULES_METADATA_KEY } from '@core/constants';
import { ApiDynamicQuery, DynamicQuery } from '@src/index';
import { toSwaggerRulesView } from '@api/swagger/swagger-rules-view';
import { RULES_PRESETS } from '../fixtures/rules';

const rules = RULES_PRESETS['user.default'];

class Controller {
  findAll(): void {}
  search(): void {}
}

describe('@DynamicQuery', () => {
  it('grava as regras compiladas na metadata do handler', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Controller.prototype,
      'findAll'
    )!;
    DynamicQuery(rules)(Controller.prototype, 'findAll', descriptor);

    expect(
      Reflect.getMetadata(QUERY_RULES_METADATA_KEY, descriptor.value)
    ).toBe(rules);
  });
});

describe('@ApiDynamicQuery', () => {
  it('também grava a metadata lida por @QueryRules', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Controller.prototype,
      'search'
    )!;
    ApiDynamicQuery(rules)(Controller.prototype, 'search', descriptor);

    expect(
      Reflect.getMetadata(QUERY_RULES_METADATA_KEY, descriptor.value)
    ).toBe(rules);
  });
});

describe('toSwaggerRulesView', () => {
  it('achata as regras compiladas em listas de paths', () => {
    const view = toSwaggerRulesView(rules);
    expect(view.filters).toContain('company.name');
    expect(view.sorts).toContain('code');
    expect(view.includes).toEqual(['company']);
    expect(view.search).toEqual(['name', 'email']);
  });

  it('qualifica os campos de relação com o path da relação', () => {
    expect(toSwaggerRulesView(rules).fields).toContain('company.name');
  });

  it('guarda os operadores de cada campo, na ordem declarada', () => {
    const view = toSwaggerRulesView(rules);
    expect(view.filterOperators).toContainEqual({
      path: 'active',
      operators: ['eq'],
    });
    expect(view.filterOperators).toContainEqual({
      path: 'score',
      operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
    });
  });

  it('nunca expõe campos internos', () => {
    const view = toSwaggerRulesView(rules);
    expect(view.fields).not.toContain('name_folded');
    expect(view.filters).not.toContain('name_folded');
  });
});

describe('regression: unpaginated global cap (consumer report #6) — Swagger', () => {
  const parametersOf = (preset: string) => {
    class Endpoint {
      list(): void {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Endpoint.prototype,
      'list'
    )!;
    ApiDynamicQuery(RULES_PRESETS[preset])(
      Endpoint.prototype,
      'list',
      descriptor
    );
    return (Reflect.getMetadata('swagger/apiParameters', descriptor.value) ??
      []) as { name: string; description?: string }[];
  };

  it('a visão carrega a política de paginação do endpoint', () => {
    expect(toSwaggerRulesView(rules)).toEqual(
      expect.objectContaining({ allowUnpaginated: true })
    );
    expect(toSwaggerRulesView(rules).maxUnpaginatedRows).toBeUndefined();
    expect(
      toSwaggerRulesView(RULES_PRESETS['user.unpaginated-capped'])
        .maxUnpaginatedRows
    ).toBe(5);
    expect(
      toSwaggerRulesView(RULES_PRESETS['user.unpaginated-forbidden'])
        .allowUnpaginated
    ).toBe(false);
  });

  it('documenta o teto de paginate=false', () => {
    const global = parametersOf('user.default').find(
      (parameter) => parameter.name === 'paginate'
    );
    expect(global?.description).toContain('maxUnpaginatedRows');
    expect(global?.description).toContain('PAGINATION_INVALID');

    const own = parametersOf('user.unpaginated-capped').find(
      (parameter) => parameter.name === 'paginate'
    );
    expect(own?.description).toContain('5 linhas');
  });

  it('não documenta paginate quando o endpoint o proíbe', () => {
    const names = parametersOf('user.unpaginated-forbidden').map(
      (parameter) => parameter.name
    );
    expect(names).toContain('page');
    expect(names).not.toContain('paginate');
  });
});

/**
 * Consumer report #7: a documentação listava a **união** dos operadores do
 * endpoint, então `filter[active][between]` aparecia como possível e dava 400.
 * Cada campo passa a mostrar só os operadores que ele autoriza.
 */
describe('regression: Swagger documenta os operadores por campo (consumer report #7)', () => {
  const filterParameter = () => {
    class Endpoint {
      list(): void {}
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      Endpoint.prototype,
      'list'
    )!;
    ApiDynamicQuery(rules)(Endpoint.prototype, 'list', descriptor);
    const parameters = (Reflect.getMetadata(
      'swagger/apiParameters',
      descriptor.value
    ) ?? []) as { name: string; description?: string }[];
    return parameters.find((parameter) => parameter.name === 'filter');
  };

  it('uma linha por campo, com só os operadores dele', () => {
    const description = filterParameter()?.description ?? '';
    expect(description).toContain('| Campo | Operadores |');
    expect(description).toContain('| `active` | `eq` |');
    expect(description).toContain(
      '| `score` | `eq`, `gt`, `gte`, `lt`, `lte`, `between` |'
    );
  });

  it('não sugere um operador que o campo do exemplo não autoriza', () => {
    const description = filterParameter()?.description ?? '';
    // `active` só aceita `eq`: nenhuma linha pode associá-lo a `between`.
    expect(description).not.toMatch(/`active`[^\n]*between/);
  });
});
