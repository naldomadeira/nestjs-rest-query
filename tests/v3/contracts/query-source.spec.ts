import type {
  AdapterCapabilities,
  QuerySource,
  RestQueryAdapterV3,
} from '@contracts/v3';
import { defineQuerySchema } from '@core/schema';

interface FakeSource {
  table: string;
}
interface FakeCompiled {
  sql: string;
  scope: string[];
}
interface FakeRow {
  id: number;
}

const capabilities: AdapterCapabilities = {
  dialect: 'postgres',
  transactionalConsistency: true,
  escapeCharacter: '\\',
  patternEscape: 'clause',
};

const adapter: RestQueryAdapterV3<FakeSource, FakeCompiled, FakeRow> = {
  id: 'typeorm',
  describe: async () =>
    defineQuerySchema({
      model: 'x',
      primaryKey: ['id'],
      fields: [
        { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
      ],
      relations: [],
    }),
  capabilities: () => capabilities,
  compile: () => ({ sql: 'select 1', scope: [] }),
  customize: (compiled, callback, scope = 'both') => {
    compiled.scope.push(scope);
    callback(compiled);
  },
  execute: async () => ({ rows: [{ id: 1 }], total: 1, queryCount: 2 }),
};

describe('QuerySource', () => {
  it('carrega adapter, entrada e discriminante juntos', () => {
    const source: QuerySource<FakeSource, FakeCompiled, FakeRow> = {
      kind: 'typeorm',
      adapter,
      input: { table: 'users' },
    };
    expect(source.kind).toBe('typeorm');
    expect(source.adapter.id).toBe('typeorm');
    expect(source.input.table).toBe('users');
  });

  it('customize recebe o contexto nativo tipado', () => {
    const compiled = { sql: 'select 1', scope: [] as string[] };
    const seen: string[] = [];
    adapter.customize(compiled, (value) => seen.push(value.sql));
    expect(seen).toEqual(['select 1']);
  });

  it('customize registra o escopo, com both como default seguro', () => {
    const compiled = { sql: 'x', scope: [] as string[] };
    adapter.customize(compiled, () => undefined);
    adapter.customize(compiled, () => undefined, 'count');
    expect(compiled.scope).toEqual(['both', 'count']);
  });

  it('o resultado do adapter carrega linhas, total e contagem de queries', async () => {
    const result = await adapter.execute({ sql: 'x', scope: [] });
    expect(result).toEqual({ rows: [{ id: 1 }], total: 1, queryCount: 2 });
  });

  it('describe devolve um schema lógico do núcleo', async () => {
    const schema = await adapter.describe({ table: 'users' });
    expect(schema.primaryKey).toEqual(['id']);
  });

  it('capabilities descreve dialeto, consistência e escape', () => {
    expect(adapter.capabilities({ table: 'users' })).toEqual({
      dialect: 'postgres',
      transactionalConsistency: true,
      escapeCharacter: '\\',
      patternEscape: 'clause',
    });
  });
});
