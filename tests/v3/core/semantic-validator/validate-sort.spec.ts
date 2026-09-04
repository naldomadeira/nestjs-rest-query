import { buildQueryPlan } from '@core/query-plan';
import { defineQueryRules } from '@core/authorization';
import { RULES_PRESETS } from '../../fixtures/rules';
import { CORPUS_SCHEMAS_NO_PORTABLE_ORDER } from '../../fixtures/schemas';

const plan = (query: Record<string, unknown>, preset = 'user.default') =>
  buildQueryPlan(query, RULES_PRESETS[preset]);

describe('validateSort', () => {
  it('dedupe de sort repetido com a mesma direção', () => {
    expect(plan({ sort: 'name,name' }).sorts.map((s) => s.path)).toEqual([
      'name',
    ]);
  });

  it('SORT_CONFLICT em direções opostas', () => {
    expect(() => plan({ sort: 'name,-name' })).toThrow(
      expect.objectContaining({ code: 'SORT_CONFLICT' })
    );
  });

  it('anexa a PK completa como desempate', () => {
    expect(
      plan({ sort: 'name' }).tieBreak.map((s) => `${s.path}:${s.direction}`)
    ).toEqual(['id:asc']);
  });

  it('não duplica a PK quando ela já está no sort', () => {
    expect(plan({ sort: '-id' }).tieBreak).toEqual([]);
  });

  it('usa a PK ascendente quando não há sort', () => {
    const built = plan({});
    expect(built.sorts).toEqual([]);
    expect(built.tieBreak.map((s) => `${s.path}:${s.direction}`)).toEqual([
      'id:asc',
    ]);
  });

  it('preserva a ordem declarada de múltiplos sorts', () => {
    expect(plan({ sort: '-name,code' }).sorts.map((s) => s.path)).toEqual([
      'name',
      'code',
    ]);
  });

  it('usa portableOrderField na coluna de ordenação de uuid', () => {
    const built = buildQueryPlan(
      { sort: 'id' },
      RULES_PRESETS['post.portable-order']
    );
    expect(built.sorts[0].column).toBe('id_order');
  });

  it('usa portableOrderField também no desempate de PK uuid', () => {
    const built = buildQueryPlan({}, RULES_PRESETS['post.portable-order']);
    expect(built.tieBreak[0].column).toBe('id_order');
  });

  it('usa a PK composta inteira no desempate', () => {
    const built = buildQueryPlan({}, RULES_PRESETS['tag.default']);
    expect(built.tieBreak.map((s) => s.path)).toEqual(['post_id', 'label']);
    expect(built.tieBreak[0].column).toBe('post_id_order');
  });

  it('falha fechado quando a PK não tem ordem portável', () => {
    const rules = defineQueryRules(CORPUS_SCHEMAS_NO_PORTABLE_ORDER, 'post', {
      filters: [{ path: 'title', operators: ['eq'] }],
      fields: { root: { allowed: ['id', 'title'], default: ['id', 'title'] } },
    });
    expect(() => buildQueryPlan({}, rules)).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
    );
  });
});
