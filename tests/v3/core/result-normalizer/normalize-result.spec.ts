import { normalizeResult } from '@core/result-normalizer';
import { buildQueryPlan } from '@core/query-plan';
import { RULES_PRESETS } from '../../fixtures/rules';

const plan = (query: Record<string, unknown>, preset = 'user.default') =>
  buildQueryPlan(query, RULES_PRESETS[preset]);

describe('normalizeResult', () => {
  it('remove a PK quando ela não está na projeção visível', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada' }],
      1,
      plan({ fields: 'name' })
    );
    expect(result.data).toEqual([{ name: 'Ada' }]);
  });

  it('mantém a PK quando ela está na projeção', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada' }],
      1,
      plan({ fields: 'id,name' })
    );
    expect(result.data).toEqual([{ id: 1, name: 'Ada' }]);
  });

  it('codifica bigint como string decimal', () => {
    const result = normalizeResult(
      [{ id: 1, score: 9007199254740993n }],
      1,
      plan({ fields: 'id,score' })
    );
    expect(result.data[0]).toEqual({ id: 1, score: '9007199254740993' });
  });

  it('codifica decimal como string sem passar por number', () => {
    const result = normalizeResult(
      [{ id: 1, balance: '12345678901234567890.123456' }],
      1,
      plan({ fields: 'id,balance' })
    );
    expect(result.data[0].balance).toBe('12345678901234567890.123456');
  });

  it('codifica date como YYYY-MM-DD e datetime como ISO UTC', () => {
    const result = normalizeResult(
      [
        {
          id: 1,
          born_on: new Date('1815-12-10T00:00:00.000Z'),
          created_at: new Date('2026-01-02T03:04:05.000Z'),
        },
      ],
      1,
      plan({ fields: 'id,born_on,created_at' })
    );
    expect(result.data[0]).toEqual({
      id: 1,
      born_on: '1815-12-10',
      created_at: '2026-01-02T03:04:05.000Z',
    });
  });

  it('normaliza boolean vindo como 0/1 do driver', () => {
    const result = normalizeResult(
      [{ id: 1, active: 1 }],
      1,
      plan({ fields: 'id,active' })
    );
    expect(result.data[0].active).toBe(true);
  });

  it('relação one ausente vira null', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada', company: undefined }],
      1,
      plan({ includes: 'company' })
    );
    expect(result.data[0].company).toBeNull();
  });

  it('relação many vazia vira array vazio', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada', posts: undefined }],
      1,
      plan({ includes: 'posts' }, 'user.deep')
    );
    expect(result.data[0].posts).toEqual([]);
  });

  it('relação many preserva os itens projetados', () => {
    const result = normalizeResult(
      [
        {
          id: 1,
          name: 'Ada',
          posts: [
            { id: 'a', title: 'One', title_folded: 'one' },
            { id: 'b', title: 'Two', title_folded: 'two' },
          ],
        },
      ],
      1,
      plan({ includes: 'posts' }, 'user.deep')
    );
    expect(result.data[0].posts).toEqual([
      { id: 'a', title: 'One' },
      { id: 'b', title: 'Two' },
    ]);
  });

  it('relação profunda permanece aninhada', () => {
    const result = normalizeResult(
      [
        {
          id: 1,
          name: 'Ada',
          company: { id: 1, name: 'Acme', owner: { id: 2, name: 'Grace' } },
        },
      ],
      1,
      plan({ includes: 'company,company.owner' }, 'user.deep')
    );
    expect(result.data[0]).toEqual({
      id: 1,
      name: 'Ada',
      company: { id: 1, name: 'Acme', owner: { id: 2, name: 'Grace' } },
    });
  });

  it('descarta chaves não projetadas vindas do driver', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada', name_folded: 'ada', secret: 'x' }],
      1,
      plan({ fields: 'id,name' })
    );
    expect(Object.keys(result.data[0])).toEqual(['id', 'name']);
  });

  it('a ordem das chaves segue a ordem da projeção', () => {
    const result = normalizeResult(
      [{ id: 1, name: 'Ada', email: 'a@b.c' }],
      1,
      plan({ fields: 'email,id' })
    );
    expect(Object.keys(result.data[0])).toEqual(['email', 'id']);
  });

  it('calcula lastPage com mínimo 1', () => {
    expect(normalizeResult([], 0, plan({})).lastPage).toBe(1);
    expect(normalizeResult([], 41, plan({ perPage: '20' })).lastPage).toBe(3);
  });

  it('devolve o envelope paginado completo', () => {
    expect(
      normalizeResult(
        [{ id: 1, name: 'a' }],
        11,
        plan({ page: '2', perPage: '3' })
      )
    ).toEqual({
      data: [{ id: 1, name: 'a' }],
      page: 2,
      perPage: 3,
      total: 11,
      lastPage: 4,
    });
  });

  it('paginate=false devolve apenas data', () => {
    expect(
      Object.keys(
        normalizeResult(
          [{ id: 1, name: 'a' }],
          undefined,
          plan({ paginate: 'false' })
        )
      )
    ).toEqual(['data']);
  });

  it('null permanece null em qualquer campo', () => {
    const result = normalizeResult(
      [{ id: 1, nickname: null }],
      1,
      plan({ fields: 'id,nickname' })
    );
    expect(result.data[0].nickname).toBeNull();
  });
});
