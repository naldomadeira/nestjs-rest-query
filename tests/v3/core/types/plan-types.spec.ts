import { buildQueryPlan } from '@core/query-plan';
import type { TypedQueryPlan } from '@core/query-plan';
import type { NormalizedQueryResult } from '@core/result-normalizer';
import type { PlanFilter } from '@core/semantic-validator';
import { RULES_PRESETS } from '../../fixtures/rules';

/**
 * Type tests: falham em tempo de compilação, não em runtime. O `it` existe só
 * para que o Jest reporte a suite.
 */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

// O plano é readonly em profundidade.
type _FiltersAreReadonly = Expect<
  Equal<TypedQueryPlan['filters'], readonly PlanFilter[]>
>;
type _SortsAreReadonly = Expect<
  Equal<TypedQueryPlan['sorts'], readonly TypedQueryPlan['sorts'][number][]>
>;
type _ProjectionRootIsReadonly = Expect<
  Equal<TypedQueryPlan['projection']['root'], readonly string[]>
>;

// O resultado é genérico na linha, não `any`.
interface User {
  id: number;
  name: string;
}
type _ResultDataIsTyped = Expect<
  Equal<NormalizedQueryResult<User>['data'], User[]>
>;

// `paginate=false` mantém os campos opcionais opcionais.
type _PageIsOptional = Expect<
  Equal<NormalizedQueryResult<User>['page'], number | undefined>
>;

describe('tipos do plano', () => {
  it('compila as asserções estáticas acima', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    expect(() => {
      // @ts-expect-error o plano não aceita mutação de array
      plan.filters.push({} as PlanFilter);
    }).toThrow(TypeError);
    expect(plan.filters).toHaveLength(0);
  });

  it('recusa regras não compiladas em buildQueryPlan', () => {
    // @ts-expect-error rules precisa ser CompiledQueryRules
    expect(() => buildQueryPlan({}, { filters: [] })).toThrow();
  });
});
