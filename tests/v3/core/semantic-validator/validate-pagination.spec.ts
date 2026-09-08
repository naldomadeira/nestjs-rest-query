import { validatePagination } from '@core/semantic-validator';

const cfg = { defaultPerPage: 20, maxPerPage: 100 };

describe('validatePagination', () => {
  it('aplica defaults', () => {
    expect(
      validatePagination(
        { page: undefined, perPage: undefined, paginate: undefined },
        cfg
      )
    ).toEqual({ paginate: true, page: 1, perPage: 20, offset: 0 });
  });

  it('calcula offset', () => {
    expect(
      validatePagination({ page: '3', perPage: '10', paginate: undefined }, cfg)
        .offset
    ).toBe(20);
  });

  it('aceita number nativo vindo de um pipe de transformação', () => {
    expect(
      validatePagination({ page: 2, perPage: 5, paginate: undefined }, cfg)
    ).toEqual({ paginate: true, page: 2, perPage: 5, offset: 5 });
  });

  it('aceita apenas inteiros decimais completos', () => {
    for (const bad of ['0', '-1', '1.5', '10abc', ' 2', '1e3', '', '01']) {
      expect(() =>
        validatePagination(
          { page: bad, perPage: undefined, paginate: undefined },
          cfg
        )
      ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
    }
  });

  it('rejeita perPage abaixo de 1 e acima do máximo', () => {
    for (const bad of ['0', '101']) {
      expect(() =>
        validatePagination(
          { page: '1', perPage: bad, paginate: undefined },
          cfg
        )
      ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
    }
  });

  it('rejeita offset fora da faixa segura', () => {
    expect(() =>
      validatePagination(
        { page: '99999999999999999', perPage: '100', paginate: undefined },
        cfg
      )
    ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
  });

  it('paginate=false zera a paginação mas preserva os defaults', () => {
    expect(
      validatePagination(
        { page: undefined, perPage: undefined, paginate: 'false' },
        cfg
      )
    ).toEqual({ paginate: false, page: 1, perPage: 20, offset: 0 });
  });

  it('paginate aceita apenas true/false/1/0', () => {
    expect(
      validatePagination(
        { page: undefined, perPage: undefined, paginate: '0' },
        cfg
      ).paginate
    ).toBe(false);
    expect(() =>
      validatePagination(
        { page: undefined, perPage: undefined, paginate: 'sim' },
        cfg
      )
    ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
  });

  it('rejeita array em qualquer parâmetro de paginação', () => {
    expect(() =>
      validatePagination(
        { page: ['1', '2'], perPage: undefined, paginate: undefined },
        cfg
      )
    ).toThrow(expect.objectContaining({ code: 'PAGINATION_INVALID' }));
  });
});
