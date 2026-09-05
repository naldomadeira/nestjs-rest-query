import { buildQueryPlan } from '@core/query-plan';
import { RULES_PRESETS } from '../../fixtures/rules';

describe('buildQueryPlan', () => {
  it('produz um plano completo e congelado', () => {
    const plan = buildQueryPlan(
      {
        filter: { name: { ilike: 'ada' } },
        sort: '-name',
        includes: 'company',
        perPage: '5',
      },
      RULES_PRESETS['user.default']
    );

    expect(plan.model).toBe('user');
    expect(plan.filters).toHaveLength(1);
    expect(plan.sorts.map((s) => s.direction)).toEqual(['desc']);
    expect(plan.includes).toEqual(['company']);
    expect(plan.pagination.perPage).toBe(5);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.filters)).toBe(true);
    expect(Object.isFrozen(plan.filters[0])).toBe(true);
  });

  it('combina search como um termo próprio, com os campos dobrados', () => {
    const plan = buildQueryPlan(
      { search: ' Ada ' },
      RULES_PRESETS['user.default']
    );
    expect(plan.search?.term).toBe('Ada');
    expect(plan.search?.foldedTerm).toBe('ada');
    expect(plan.search?.targets.map((t) => t.column)).toEqual([
      'name_folded',
      'email_folded',
    ]);
  });

  it('projeção interna carrega a PK mesmo quando invisível', () => {
    const plan = buildQueryPlan(
      { fields: 'name' },
      RULES_PRESETS['user.default']
    );
    expect(plan.projection.root).toEqual(['name']);
    expect(plan.internalProjection.root).toEqual(['id', 'name']);
  });

  it('projeção interna carrega a PK de cada relação incluída', () => {
    const plan = buildQueryPlan(
      { fields: 'id,company.name', includes: 'company' },
      RULES_PRESETS['user.default']
    );
    expect(plan.internalProjection.relations.get('company')).toEqual([
      'id',
      'name',
    ]);
  });

  it('projeção interna usa a PK composta inteira', () => {
    const plan = buildQueryPlan(
      { fields: 'label' },
      RULES_PRESETS['tag.default']
    );
    expect(plan.internalProjection.root).toEqual(['post_id', 'label']);
  });

  it('não deixa o consumidor mutar o plano', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    expect(() => {
      (plan.pagination as { page: number }).page = 9;
    }).toThrow();
  });

  it('respeita a paginação vinda da configuração global', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default'], {
      pagination: { defaultPerPage: 7, maxPerPage: 9 },
    });
    expect(plan.pagination.perPage).toBe(7);
    expect(() =>
      buildQueryPlan({ perPage: '10' }, RULES_PRESETS['user.default'], {
        pagination: { defaultPerPage: 7, maxPerPage: 9 },
      })
    ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
  });

  it('usa portable-strict e eventual como defaults', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    expect(plan.textProfile).toBe('portable-strict');
    expect(plan.consistency).toBe('eventual');
  });

  it('expõe o schema root resolvido', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    expect(plan.schema.primaryKey).toEqual(['id']);
  });

  it('valida sintaxe antes de autorização e coerção', () => {
    // Path inseguro num campo que também não é autorizado: o erro deve ser de
    // sintaxe, provando a ordem do pipeline.
    expect(() =>
      buildQueryPlan({ sort: 'a..b' }, RULES_PRESETS['user.default'])
    ).toThrow(expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' }));
  });

  it('valida autorização antes de coerção', () => {
    // Valor inválido num campo não autorizado: FIELD_NOT_ALLOWED vence, então
    // o codec nunca vê input de um campo proibido.
    expect(() =>
      buildQueryPlan(
        { filter: { zip: { eq: 'x' } } },
        RULES_PRESETS['user.default']
      )
    ).toThrow(expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' }));
  });
});
