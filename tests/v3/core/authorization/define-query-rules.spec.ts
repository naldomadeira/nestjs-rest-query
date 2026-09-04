import { defineQueryRules } from '@core/authorization';
import type { QueryRulesInput } from '@core/authorization';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';

const base: QueryRulesInput = {
  filters: [{ path: 'name', operators: ['eq', 'ilike'] }],
  sorts: ['id', 'name'],
  fields: {
    root: { allowed: ['id', 'name', 'email'], default: ['id', 'name'] },
    relations: {
      company: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
  includes: ['company'],
  search: ['name'],
};

const define = (input: Partial<QueryRulesInput>) =>
  defineQueryRules(CORPUS_SCHEMAS, 'user', { ...base, ...input });

describe('defineQueryRules', () => {
  it('compila regras válidas', () => {
    const rules = define({});
    expect(rules.filters.get('name')).toEqual(new Set(['eq', 'ilike']));
    expect(rules.fields.root.default).toEqual(['id', 'name']);
    expect(rules.includes.has('company')).toBe(true);
  });

  it('rejeita path que não existe no schema', () => {
    expect(() => define({ sorts: ['nope'] })).toThrow(/nope/);
  });

  it('rejeita default fora de allowed', () => {
    expect(() =>
      define({ fields: { root: { allowed: ['id'], default: ['id', 'name'] } } })
    ).toThrow(/default/i);
  });

  it('rejeita root sem nenhum campo default', () => {
    expect(() =>
      define({ fields: { root: { allowed: ['id'], default: [] } } })
    ).toThrow(/default/i);
  });

  it('rejeita relação sem ao menos um campo default', () => {
    expect(() =>
      define({
        fields: {
          root: base.fields.root,
          relations: { company: { allowed: ['id'], default: [] } },
        },
      })
    ).toThrow(/default/i);
  });

  it('rejeita campo de search não textual', () => {
    expect(() => define({ search: ['score'] })).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
  });

  it('rejeita campo de search sem foldedField', () => {
    expect(() => define({ search: ['document'] })).toThrow(/folded/i);
  });

  it('rejeita ilike em campo sem foldedField', () => {
    expect(() =>
      define({ filters: [{ path: 'document', operators: ['ilike'] }] })
    ).toThrow(/folded/i);
  });

  it('rejeita operador incompatível com o tipo do campo', () => {
    expect(() =>
      define({ filters: [{ path: 'active', operators: ['like'] }] })
    ).toThrow(/textual/i);
  });

  it('rejeita ordem em uuid sem portableOrderField', () => {
    expect(() =>
      defineQueryRules(CORPUS_SCHEMAS, 'tag', {
        filters: [{ path: 'label', operators: ['eq'] }],
        fields: { root: { allowed: ['label'], default: ['label'] } },
      })
    ).not.toThrow();
  });

  it('rejeita projeção de relação não autorizada em includes', () => {
    expect(() => define({ includes: [] })).toThrow(/company/);
  });

  it('rejeita autorização de campo interno', () => {
    expect(() => define({ sorts: ['name_folded'] })).toThrow();
  });

  it('expande wildcard company.* apenas na construção', () => {
    const rules = define({
      fields: {
        root: base.fields.root,
        relations: {
          company: { allowed: ['company.*'], default: ['id'] },
        },
      },
    });
    expect(rules.fields.relations.get('company')?.allowed).toEqual([
      'id',
      'name',
      'owner_id',
    ]);
  });

  it('rejeita wildcard nu', () => {
    expect(() =>
      define({
        fields: {
          root: base.fields.root,
          relations: { company: { allowed: ['*'], default: ['id'] } },
        },
      })
    ).toThrow();
  });

  it('rejeita sort através de relação many', () => {
    expect(() =>
      defineQueryRules(CORPUS_SCHEMAS, 'user', {
        ...base,
        sorts: ['posts.title'],
        includes: ['company', 'posts'],
      })
    ).toThrow(/many/i);
  });

  it('aceita filtro existencial através de relação many', () => {
    const rules = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      ...base,
      filters: [{ path: 'posts.title', operators: ['eq'] }],
      includes: ['company', 'posts'],
      fields: {
        root: base.fields.root,
        relations: {
          company: { allowed: ['id', 'name'], default: ['id', 'name'] },
          posts: { allowed: ['id', 'title'], default: ['id', 'title'] },
        },
      },
    });
    expect(rules.filters.has('posts.title')).toBe(true);
  });

  it('exige projeção declarada para toda relação incluída', () => {
    expect(() =>
      defineQueryRules(CORPUS_SCHEMAS, 'user', {
        ...base,
        includes: ['company', 'posts'],
      })
    ).toThrow(/posts/);
  });

  it('aceita relação como alvo de isNull', () => {
    const rules = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      ...base,
      filters: [{ path: 'company', operators: ['isNull'] }],
    });
    expect(rules.filters.get('company')).toEqual(new Set(['isNull']));
  });

  it('rejeita operador diferente de isNull aplicado a uma relação', () => {
    expect(() =>
      defineQueryRules(CORPUS_SCHEMAS, 'user', {
        ...base,
        filters: [{ path: 'company', operators: ['eq'] }],
      })
    ).toThrow(/isNull/);
  });

  it('congela o resultado', () => {
    expect(Object.isFrozen(define({}))).toBe(true);
  });
});
