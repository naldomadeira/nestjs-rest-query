import type { DataSource } from 'typeorm';
import { buildQueryPlan } from '@core/query-plan';
import { TypeOrmAdapter, typeormSource } from '@infra/adapters/typeorm';
import { RULES_PRESETS } from '../../fixtures/rules';
import { closeSqlite, openSqlite, repositoryFor } from './helpers';

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await openSqlite();
});
afterAll(closeSqlite);

const adapter = new TypeOrmAdapter();
const input = () => ({ repository: repositoryFor('user.default') });

describe('TypeOrmAdapter', () => {
  it('se identifica como typeorm', () => {
    expect(adapter.id).toBe('typeorm');
  });

  it('descreve o schema lógico do model root', async () => {
    const schema = await adapter.describe(input());
    expect(schema.model).toBe('user');
    expect(schema.primaryKey).toEqual(['id']);
  });

  it('deriva o dialeto do driver da conexão', () => {
    expect(adapter.capabilities(input())).toEqual({
      dialect: 'sqlite',
      transactionalConsistency: true,
      escapeCharacter: '!',
    });
  });

  it('recusa um driver fora da matriz suportada', () => {
    const options = dataSource.options as { type: string };
    const original = options.type;
    options.type = 'oracle';

    try {
      expect(() => adapter.capabilities(input())).toThrow(
        expect.objectContaining({ code: 'SOURCE_CONFIGURATION_INVALID' })
      );
    } finally {
      options.type = original;
    }
  });

  it('compila o plano nas duas queries derivadas dele', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    expect(compiled.plan).toBe(plan);
    expect(compiled.data).toBeDefined();
    expect(compiled.count).toBeDefined();
  });

  it('customize com escopo both entrega o contexto inteiro', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    let received: unknown;
    adapter.customize(compiled, (value) => (received = value));
    expect(received).toBe(compiled);
  });

  it('customize com escopo count aponta as duas pontas para o count', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    adapter.customize(
      compiled,
      (value) => {
        expect(value.data).toBe(compiled.count);
        expect(value.count).toBe(compiled.count);
      },
      'count'
    );
  });

  it('typeormSource produz a source discriminada', () => {
    const source = typeormSource(repositoryFor('user.default'));
    expect(source.kind).toBe('typeorm');
    expect(source.adapter.id).toBe('typeorm');
    expect(source.input.repository).toBeDefined();
  });
});
