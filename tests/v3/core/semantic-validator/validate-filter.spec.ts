import { buildQueryPlan } from '@core/query-plan';
import { DecimalValue, CivilDate } from '@core/coercion';
import { RULES_PRESETS } from '../../fixtures/rules';

const plan = (query: Record<string, unknown>, preset = 'user.default') =>
  buildQueryPlan(query, RULES_PRESETS[preset]);

describe('validação de filtros', () => {
  it('coage cada item de in pelo codec do campo', () => {
    expect(plan({ filter: { id: { in: '1,2,3' } } }).filters[0].value).toEqual([
      1, 2, 3,
    ]);
  });

  it('in vazio vira condição sempre falsa', () => {
    const filter = plan({ filter: { id: { in: [] } } }).filters[0];
    expect(filter.operator).toBe('in');
    expect(filter.alwaysFalse).toBe(true);
    expect(filter.alwaysTrue).toBe(false);
  });

  it('notIn vazio vira condição sempre verdadeira', () => {
    const filter = plan({ filter: { id: { notIn: [] } } }).filters[0];
    expect(filter.alwaysTrue).toBe(true);
    expect(filter.alwaysFalse).toBe(false);
  });

  it('between exige exatamente dois valores', () => {
    expect(() => plan({ filter: { id: { between: '1' } } })).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
    expect(() => plan({ filter: { id: { between: '1,2,3' } } })).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
  });

  it('between coage os dois extremos', () => {
    expect(
      plan({ filter: { id: { between: '2,4' } } }).filters[0].value
    ).toEqual([2, 4]);
  });

  it('ilike dobra o termo e mira o folded field', () => {
    const filter = plan({ filter: { name: { ilike: 'AÇÃO' } } }).filters[0];
    expect(filter.column).toBe('name_folded');
    expect(filter.value).toBe('ação');
    expect(filter.literalPattern).toBe(true);
  });

  it('ilike dobra input em NFD para a mesma forma que o NFC armazenado', () => {
    const nfd = plan({ filter: { name: { ilike: 'AÇÃO'.normalize('NFD') } } });
    const nfc = plan({ filter: { name: { ilike: 'AÇÃO'.normalize('NFC') } } });
    expect(nfd.filters[0].value).toBe(nfc.filters[0].value);
  });

  it('like mira a coluna original e mantém o valor literal', () => {
    const filter = plan({ filter: { name: { like: '100%' } } }).filters[0];
    expect(filter.column).toBe('name');
    expect(filter.value).toBe('100%');
    expect(filter.literalPattern).toBe(true);
  });

  it('preserva o tipo lógico de decimal e date', () => {
    expect(
      plan({ filter: { balance: { eq: '1.50' } } }).filters[0].value
    ).toBeInstanceOf(DecimalValue);
    expect(
      plan({ filter: { born_on: { eq: '1990-01-01' } } }).filters[0].value
    ).toBeInstanceOf(CivilDate);
  });

  it('bigint chega ao plano como bigint', () => {
    expect(
      plan({ filter: { score: { eq: '9007199254740993' } } }).filters[0].value
    ).toBe(9007199254740993n);
  });

  it('isNull coage estritamente', () => {
    expect(
      plan({ filter: { nickname: { isNull: 'true' } } }).filters[0].value
    ).toBe(true);
    expect(() => plan({ filter: { nickname: { isNull: 'sim' } } })).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
  });

  it('marca cardinalidade existencial em relação many', () => {
    const filter = plan({ filter: { 'posts.title': { eq: 'a' } } }, 'user.deep')
      .filters[0];
    expect(filter.existential).toBe(true);
    expect(filter.relationPath).toEqual(['posts']);
  });

  it('não marca existencial em caminho só de relações one', () => {
    const filter = plan({ filter: { 'company.name': { eq: 'Acme' } } })
      .filters[0];
    expect(filter.existential).toBe(false);
    expect(filter.column).toBe('company.name');
  });

  it('isNull em relação one vira presença/ausência', () => {
    const filter = plan(
      { filter: { company: { isNull: 'true' } } },
      'user.deep'
    ).filters[0];
    expect(filter.target).toBe('relation');
    expect(filter.relationPath).toEqual(['company']);
    expect(filter.existential).toBe(false);
  });

  it('isNull em relação many é existencial', () => {
    const filter = plan({ filter: { posts: { isNull: 'true' } } }, 'user.deep')
      .filters[0];
    expect(filter.target).toBe('relation');
    expect(filter.existential).toBe(true);
  });

  it('rejeita null como valor de filtro fora de isNull', () => {
    expect(() => plan({ filter: { nickname: { eq: null } } })).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
  });

  it('ordem sobre uuid usa a coluna de ordem portável', () => {
    const filter = buildQueryPlan(
      { filter: { id: { eq: '11111111-1111-4111-8111-111111111111' } } },
      RULES_PRESETS['post.portable-order']
    ).filters[0];
    expect(filter.column).toBe('id');
  });
});
