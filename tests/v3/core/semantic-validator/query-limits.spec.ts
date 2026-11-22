import { defineQueryRules } from '@core/authorization';
import { RestQueryError } from '@core/errors';
import { parseQueryInput } from '@core/query-parser';
import { buildQueryPlan } from '@core/query-plan';
import {
  assertQueryLimitsInput,
  assertWithinQueryLimits,
  DEFAULT_QUERY_LIMITS,
  resolveQueryLimits,
  type QueryLimits,
} from '@core/semantic-validator';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';
import { RULES_PRESETS } from '../../fixtures/rules';

/**
 * Limites anti-abuso do núcleo.
 *
 * A whitelist diz *o que* o cliente pode pedir; estes limites dizem *quanto*.
 * Sem eles, `filter[id][in]` com dez mil valores ou um `search` de um
 * megabyte passam pela autorização e viram uma consulta cara — o 400 tem de
 * sair antes, barato, e sempre com o mesmo código.
 */

const check = (
  query: Parameters<typeof parseQueryInput>[0],
  limits: Partial<QueryLimits> = {}
) =>
  assertWithinQueryLimits(
    parseQueryInput(query),
    resolveQueryLimits(DEFAULT_QUERY_LIMITS, limits)
  );

const exceeded = (details: Record<string, unknown>) =>
  expect.objectContaining({
    code: 'QUERY_LIMIT_EXCEEDED',
    statusCode: 400,
    details: expect.objectContaining(details),
  });

describe('defaults', () => {
  it('são seguros e explícitos', () => {
    expect(DEFAULT_QUERY_LIMITS).toEqual({
      maxFilters: 20,
      maxListItems: 100,
      maxSorts: 5,
      maxSearchLength: 100,
      maxFilterValueLength: 255,
    });
    expect(Object.isFrozen(DEFAULT_QUERY_LIMITS)).toBe(true);
  });
});

describe('assertWithinQueryLimits', () => {
  it('aceita uma query dentro de todos os limites', () => {
    expect(() =>
      check({
        filter: { id: { in: '1,2,3' }, name: { ilike: 'ada' } },
        sort: 'name,-id',
        search: 'ada',
      })
    ).not.toThrow();
  });

  it('conta termos de filtro, não paths', () => {
    const filter = { score: { gte: '1', lte: '9' }, id: { eq: '1' } };
    expect(() => check({ filter }, { maxFilters: 3 })).not.toThrow();
    expect(() => check({ filter }, { maxFilters: 2 })).toThrow(
      exceeded({ param: 'filter', limit: 'maxFilters', max: 2 })
    );
  });

  it('limita os itens de in e notIn, em CSV e em array', () => {
    expect(() =>
      check({ filter: { id: { in: '1,2,3' } } }, { maxListItems: 2 })
    ).toThrow(
      exceeded({
        param: 'filter',
        limit: 'maxListItems',
        max: 2,
        path: 'id',
        operator: 'in',
      })
    );
    expect(() =>
      check({ filter: { id: { notIn: ['1', '2', '3'] } } }, { maxListItems: 2 })
    ).toThrow(exceeded({ limit: 'maxListItems', operator: 'notIn' }));
    expect(() =>
      check({ filter: { id: { in: '1,2' } } }, { maxListItems: 2 })
    ).not.toThrow();
  });

  it('limita o tamanho de cada valor de filtro string', () => {
    const long = 'a'.repeat(11);
    expect(() =>
      check({ filter: { name: { eq: long } } }, { maxFilterValueLength: 10 })
    ).toThrow(
      exceeded({
        param: 'filter',
        limit: 'maxFilterValueLength',
        max: 10,
        path: 'name',
        operator: 'eq',
      })
    );
    // Forma curta é `eq`, e vale o mesmo limite.
    expect(() =>
      check({ filter: { name: long } }, { maxFilterValueLength: 10 })
    ).toThrow(exceeded({ limit: 'maxFilterValueLength', operator: 'eq' }));
  });

  it('em listas o tamanho vale por item, não pela string inteira', () => {
    // Cem UUIDs em CSV passam de 255 caracteres juntos, e cada um é curto:
    // medir a string inteira recusaria o uso legítimo de `in`.
    const uuids = Array.from(
      { length: 100 },
      (_, n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
    ).join(',');
    expect(() => check({ filter: { id: { in: uuids } } })).not.toThrow();

    expect(() =>
      check(
        { filter: { name: { in: `ok,${'x'.repeat(11)}` } } },
        { maxFilterValueLength: 10 }
      )
    ).toThrow(exceeded({ limit: 'maxFilterValueLength', operator: 'in' }));
  });

  it('valor não textual não tem tamanho a medir', () => {
    expect(() =>
      check({ filter: { active: { eq: true } } }, { maxFilterValueLength: 1 })
    ).not.toThrow();
  });

  it('limita o número de campos de sort', () => {
    expect(() => check({ sort: 'a,b,c' }, { maxSorts: 2 })).toThrow(
      exceeded({ param: 'sort', limit: 'maxSorts', max: 2 })
    );
    expect(() => check({ sort: 'a,b' }, { maxSorts: 2 })).not.toThrow();
  });

  it('limita o comprimento do search, já sem as bordas em branco', () => {
    expect(() =>
      check({ search: 'x'.repeat(6) }, { maxSearchLength: 5 })
    ).toThrow(exceeded({ param: 'search', limit: 'maxSearchLength', max: 5 }));
    expect(() =>
      check({ search: `   ${'x'.repeat(5)}   ` }, { maxSearchLength: 5 })
    ).not.toThrow();
  });

  it('nunca devolve o valor enviado no envelope', () => {
    const secret = 's3cr3t'.repeat(100);
    try {
      check({ filter: { name: { eq: secret } } });
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(RestQueryError);
      expect(JSON.stringify((error as RestQueryError).toJSON())).not.toContain(
        's3cr3t'
      );
    }
  });
});

describe('resolveQueryLimits', () => {
  it('cada camada substitui só as chaves que declarou', () => {
    expect(
      resolveQueryLimits(
        DEFAULT_QUERY_LIMITS,
        { maxFilters: 50, maxSorts: undefined },
        { maxSorts: 1 }
      )
    ).toEqual({ ...DEFAULT_QUERY_LIMITS, maxFilters: 50, maxSorts: 1 });
  });
});

describe('assertQueryLimitsInput', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '10'])(
    'recusa %p na inicialização',
    (value) => {
      expect(() =>
        assertQueryLimitsInput({ maxFilters: value as number }, 'limits')
      ).toThrow(
        expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
      );
    }
  );

  it('recusa chave desconhecida em vez de ignorar o erro de digitação', () => {
    expect(() =>
      assertQueryLimitsInput({ maxFilter: 3 } as never, 'limits')
    ).toThrow(
      expect.objectContaining({
        code: 'SOURCE_CONFIGURATION_INVALID',
        details: expect.objectContaining({ key: 'maxFilter' }),
      })
    );
  });

  it('aceita ausência e chaves undefined', () => {
    expect(() => assertQueryLimitsInput(undefined, 'limits')).not.toThrow();
    expect(() =>
      assertQueryLimitsInput({ maxSorts: undefined }, 'limits')
    ).not.toThrow();
  });
});

describe('integração com o plano', () => {
  it('buildQueryPlan aplica os defaults mesmo sem opção', () => {
    const many = Array.from({ length: 101 }, (_, n) => String(n));
    expect(() =>
      buildQueryPlan(
        { filter: { id: { in: many } } },
        RULES_PRESETS['user.default']
      )
    ).toThrow(exceeded({ limit: 'maxListItems' }));
  });

  it('o limite é checado antes da autorização', () => {
    // Campo fora da whitelist com lista enorme: a recusa barata ganha.
    const many = Array.from({ length: 101 }, (_, n) => String(n));
    expect(() =>
      buildQueryPlan(
        { filter: { secret: { in: many } } },
        RULES_PRESETS['user.default']
      )
    ).toThrow(exceeded({ limit: 'maxListItems' }));
  });

  it('a ordem é default, depois forRoot, depois o endpoint', () => {
    const rules = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      sorts: ['id', 'name'],
      fields: { root: { allowed: ['id', 'name'], default: ['id'] } },
      limits: { maxSorts: 1 },
    });

    // forRoot permite 2, o endpoint aperta para 1.
    expect(() =>
      buildQueryPlan({ sort: 'id,name' }, rules, { limits: { maxSorts: 2 } })
    ).toThrow(exceeded({ limit: 'maxSorts', max: 1 }));

    // Sem limite no endpoint, vale o global.
    const open = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      sorts: ['id', 'name'],
      fields: { root: { allowed: ['id', 'name'], default: ['id'] } },
    });
    expect(() =>
      buildQueryPlan({ sort: 'id,name' }, open, { limits: { maxSorts: 1 } })
    ).toThrow(exceeded({ limit: 'maxSorts', max: 1 }));
    expect(() =>
      buildQueryPlan({ sort: 'id,name' }, open, { limits: { maxSorts: 2 } })
    ).not.toThrow();
  });

  it('defineQueryRules valida e congela os limites do endpoint', () => {
    const rules = defineQueryRules(CORPUS_SCHEMAS, 'user', {
      fields: { root: { allowed: ['id'], default: ['id'] } },
      limits: { maxFilters: 3 },
    });
    expect(rules.limits).toEqual({ maxFilters: 3 });
    expect(Object.isFrozen(rules.limits)).toBe(true);

    expect(() =>
      defineQueryRules(CORPUS_SCHEMAS, 'user', {
        fields: { root: { allowed: ['id'], default: ['id'] } },
        limits: { maxFilters: 0 },
      })
    ).toThrow(
      expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
    );
  });
});
