import { buildQueryPlan } from '@core/query-plan';
import { RULES_PRESETS } from '../../fixtures/rules';

/**
 * Orçamento de performance do spec §18.4. Mede apenas o núcleo, sem I/O.
 */
const p95 = (samples: number[]): number =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length * 0.95)];

const measure = (runs: number, run: () => void): number => {
  for (let i = 0; i < 50; i++) run(); // aquecimento do JIT
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  return p95(samples);
};

describe('orçamento de performance', () => {
  it('p95 abaixo de 1 ms para 50 filtros', () => {
    const filter: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) {
      filter[`id`] = { in: Array.from({ length: 50 }, (_, n) => String(n)) };
      filter[`name`] = { ilike: `n${i}` };
      filter[`code`] = { in: `a,b,c` };
      filter[`score`] = { between: '1,2' };
    }

    expect(
      measure(500, () =>
        buildQueryPlan({ filter }, RULES_PRESETS['user.default'])
      )
    ).toBeLessThan(1);
  });

  it('p95 abaixo de 2 ms para uma query completa do corpus', () => {
    const query = {
      filter: {
        name: { ilike: 'ada' },
        score: { between: '1,9007199254740993' },
        active: { eq: 'true' },
        'company.name': { eq: 'Acme' },
      },
      sort: '-name,code',
      fields: 'id,name,email,company.name',
      includes: 'company',
      search: 'ada',
      page: '2',
      perPage: '20',
    };

    expect(
      measure(500, () => buildQueryPlan(query, RULES_PRESETS['user.default']))
    ).toBeLessThan(2);
  });
});
