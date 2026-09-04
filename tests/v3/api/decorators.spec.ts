import { QUERY_RULES_METADATA_KEY } from '@core/constants';
import { ApiDynamicQuery, DynamicQuery } from '@src/index';
import { resolveAllowedOperators } from '@api/decorators/api-dynamic-query.decorator';
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

describe('resolveAllowedOperators', () => {
  it('documenta a união dos operadores declarados por campo', () => {
    const operators = resolveAllowedOperators(rules);
    expect(operators).toContain('ilike');
    expect(operators).toContain('between');
    expect(new Set(operators).size).toBe(operators.length);
  });

  it('cai na lista completa quando o endpoint não declara filtros', () => {
    const noFilters = RULES_PRESETS['post.portable-order'];
    expect(resolveAllowedOperators(noFilters).length).toBeGreaterThan(0);
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

  it('nunca expõe campos internos', () => {
    const view = toSwaggerRulesView(rules);
    expect(view.fields).not.toContain('name_folded');
    expect(view.filters).not.toContain('name_folded');
  });
});
