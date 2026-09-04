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

  it('customize com escopo both atinge data e count', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    const received: unknown[] = [];
    adapter.customize(compiled, (native) => received.push(native));
    expect(received).toEqual([compiled.data, compiled.count]);
  });

  it('um único andWhere no escopo both entra nas duas queries', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    adapter.customize(compiled, (qb) =>
      qb.andWhere('root.active = :tenant', { tenant: true })
    );

    expect(compiled.data.getQuery()).toMatch(/"?root"?\."?active"? = :tenant/);
    expect(compiled.count.getQuery()).toMatch(/"?root"?\."?active"? = :tenant/);
  });

  it('customize com escopo count só toca a query de contagem', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    const received: unknown[] = [];
    adapter.customize(compiled, (native) => received.push(native), 'count');
    expect(received).toEqual([compiled.count]);
  });

  it('customize com escopo data só toca a query de dados', () => {
    const plan = buildQueryPlan({}, RULES_PRESETS['user.default']);
    const compiled = adapter.compile(plan, input());

    const received: unknown[] = [];
    adapter.customize(compiled, (native) => received.push(native), 'data');
    expect(received).toEqual([compiled.data]);
  });

  it('typeormSource produz a source discriminada', () => {
    const source = typeormSource(repositoryFor('user.default'));
    expect(source.kind).toBe('typeorm');
    expect(source.adapter.id).toBe('typeorm');
    expect(source.input.repository).toBeDefined();
  });
});
