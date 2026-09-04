import type {
  AdapterCapabilities,
  QuerySource,
  RestQueryAdapterV3,
} from '@contracts/v3';
import type { ProfileFacts } from '@core/portability';
import type { TypedQueryPlan } from '@core/query-plan';
import type { QuerySchema } from '@core/schema';
import { userSchema } from './schemas';

export interface FakeSourceInput {
  readonly capabilities: AdapterCapabilities;
  readonly schema: QuerySchema;
}

export interface FakeCompiled {
  readonly plan: TypedQueryPlan;
}

export interface FakeRow {
  id: number;
  name: string;
}

export type AdapterCall =
  | { kind: 'describe' }
  | { kind: 'compile'; plan: TypedQueryPlan }
  | { kind: 'customize'; scope: string }
  | { kind: 'execute' };

/** Registro das chamadas feitas ao adapter durante o teste. */
export const calls: AdapterCall[] = [];

const fakeAdapter: RestQueryAdapterV3<FakeSourceInput, FakeCompiled, FakeRow> =
  {
    id: 'typeorm',
    describe: async (source) => {
      calls.push({ kind: 'describe' });
      return source.schema;
    },
    capabilities: (source) => source.capabilities,
    compile: (plan) => {
      calls.push({ kind: 'compile', plan });
      return { plan };
    },
    customize: (compiled, callback, scope = 'both') => {
      calls.push({ kind: 'customize', scope });
      callback(compiled);
    },
    execute: async () => {
      calls.push({ kind: 'execute' });
      return { rows: [{ id: 1, name: 'Ada' }], total: 1, queryCount: 2 };
    },
  };

export function fakeSource(
  capabilities: Partial<AdapterCapabilities> = {},
  schema: QuerySchema = userSchema,
  portabilityProfile?: ProfileFacts
): QuerySource<FakeSourceInput, FakeCompiled, FakeRow> {
  return {
    kind: 'typeorm',
    adapter: fakeAdapter,
    input: {
      capabilities: {
        dialect: 'postgres',
        transactionalConsistency: true,
        escapeCharacter: '\\',
        patternEscape: 'clause',
        ...capabilities,
      },
      schema,
    },
    portabilityProfile,
  };
}
