import fc from 'fast-check';
import { buildQueryPlan } from '@core/query-plan';
import { RestQueryError } from '@core/errors';
import { foldText } from '@core/text-profile';
import { parseValueList } from '@core/coercion';
import { RULES_PRESETS } from '../../fixtures/rules';

const rules = RULES_PRESETS['user.default'];
const build = (query: Record<string, unknown>) => buildQueryPlan(query, rules);

const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

describe('entradas hostis', () => {
  it('nunca lança nada que não seja RestQueryError', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        try {
          build({ filter: { name: { eq: raw } } });
        } catch (error) {
          expect(error).toBeInstanceOf(RestQueryError);
        }
      }),
      { numRuns: 2000 }
    );
  });

  it('nunca lança fora do contrato para qualquer forma de query', () => {
    fc.assert(
      fc.property(
        fc.record(
          {
            filter: fc.anything(),
            sort: fc.anything(),
            fields: fc.anything(),
            includes: fc.anything(),
            search: fc.anything(),
            page: fc.anything(),
            perPage: fc.anything(),
            paginate: fc.anything(),
          },
          { requiredKeys: [] }
        ),
        (query) => {
          try {
            build(query as Record<string, unknown>);
          } catch (error) {
            expect(error).toBeInstanceOf(RestQueryError);
          }
        }
      ),
      { numRuns: 3000 }
    );
  });

  it('nunca aceita path que o alfabeto seguro rejeita', () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        // `?sort=` é lista vazia, não path inválido — mesma regra de `fields`.
        if (path === '' || SAFE_PATH.test(path)) return;
        expect(() => build({ sort: path })).toThrow(RestQueryError);
      }),
      { numRuns: 2000 }
    );
  });

  it('inteiro só é aceito quando é decimal completo e seguro', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const valid =
          /^-?(0|[1-9]\d*)$/.test(raw) && Number.isSafeInteger(Number(raw));
        let accepted = true;
        try {
          build({ filter: { id: { eq: raw } } });
        } catch {
          accepted = false;
        }
        expect(accepted).toBe(valid);
      }),
      { numRuns: 3000 }
    );
  });

  it('foldText é idempotente', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const once = foldText(value);
        expect(foldText(once)).toBe(once);
      }),
      { numRuns: 2000 }
    );
  });

  it('parseValueList nunca perde nem inventa separadores', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 8 }), (items) => {
        const csv = items
          .map((item) => item.replace(/([\\",])/g, '\\$1'))
          .join(',');
        // `''` é ambíguo por construção: a string vazia é a lista vazia, não
        // uma lista com um item vazio.
        const expected = csv === '' ? [] : items;
        expect(parseValueList(csv)).toEqual(expected);
      }),
      { numRuns: 2000 }
    );
  });

  it('mensagens de erro nunca embutem o valor cru', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), (raw) => {
        try {
          build({ filter: { id: { eq: raw } } });
        } catch (error) {
          expect((error as RestQueryError).message).not.toContain(raw);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('o envelope de erro nunca carrega o valor cru nos detalhes', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), (raw) => {
        try {
          build({ filter: { born_on: { eq: raw } } });
        } catch (error) {
          const json = JSON.stringify((error as RestQueryError).toJSON());
          expect(json).not.toContain(raw);
        }
      }),
      { numRuns: 1000 }
    );
  });
});
