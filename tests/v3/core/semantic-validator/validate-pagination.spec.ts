import {
  assertWithinUnpaginatedCap,
  validatePagination,
} from '@core/semantic-validator';

const cfg = { defaultPerPage: 20, maxPerPage: 100 };

describe('validatePagination', () => {
  it('aplica defaults', () => {
    expect(
      validatePagination(
        { page: undefined, perPage: undefined, paginate: undefined },
        cfg
      )
    ).toEqual({
      paginate: true,
      page: 1,
      perPage: 20,
      offset: 0,
      maxRows: 100,
    });
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
    ).toEqual({
      paginate: true,
      page: 2,
      perPage: 5,
      offset: 5,
      maxRows: 100,
    });
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
    ).toEqual({
      paginate: false,
      page: 1,
      perPage: 20,
      offset: 0,
      maxRows: 100,
    });
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

/**
 * Bug #6 do relato de consumidor externo: `paginate=false` devolvia a tabela
 * inteira, sem teto, e nenhum endpoint conseguia recusá-lo.
 */
describe('regression: unpaginated global cap (consumer report #6)', () => {
  const unpaginated = {
    page: undefined,
    perPage: undefined,
    paginate: 'false',
  };

  it('o teto default de paginate=false é o maxPerPage efetivo', () => {
    expect(validatePagination(unpaginated, cfg).maxRows).toBe(100);
    expect(
      validatePagination(unpaginated, { defaultPerPage: 10, maxPerPage: 25 })
        .maxRows
    ).toBe(25);
  });

  it('maxUnpaginatedRows substitui o teto', () => {
    expect(
      validatePagination(unpaginated, { ...cfg, maxUnpaginatedRows: 5000 })
        .maxRows
    ).toBe(5000);
  });

  it('allowUnpaginated=false recusa paginate=false antes de qualquer query', () => {
    expect(() =>
      validatePagination(unpaginated, { ...cfg, allowUnpaginated: false })
    ).toThrow(
      expect.objectContaining({
        code: 'PAGINATION_INVALID',
        details: { param: 'paginate' },
      })
    );
    // Paginar continua permitido.
    expect(
      validatePagination(
        { page: undefined, perPage: undefined, paginate: 'true' },
        { ...cfg, allowUnpaginated: false }
      ).paginate
    ).toBe(true);
  });

  it('um resultado acima do teto é recusado, nunca truncado', () => {
    const pagination = validatePagination(unpaginated, {
      ...cfg,
      maxUnpaginatedRows: 3,
    });

    expect(() => assertWithinUnpaginatedCap(pagination, 3)).not.toThrow();
    expect(() => assertWithinUnpaginatedCap(pagination, 4)).toThrow(
      expect.objectContaining({
        code: 'PAGINATION_INVALID',
        details: { param: 'paginate', maxRows: 3 },
      })
    );
  });

  it('o teto não se aplica a respostas paginadas', () => {
    const pagination = validatePagination(
      { page: undefined, perPage: '50', paginate: undefined },
      { ...cfg, maxUnpaginatedRows: 3 }
    );
    expect(() => assertWithinUnpaginatedCap(pagination, 50)).not.toThrow();
  });
});
