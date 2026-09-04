import { parseQueryInput } from '@core/query-parser';

describe('parseQueryInput', () => {
  it('produz uma AST vazia para input vazio', () => {
    expect(parseQueryInput({})).toEqual({
      filters: [],
      sorts: [],
      fields: null,
      includes: [],
      search: null,
      pagination: {
        page: undefined,
        perPage: undefined,
        paginate: undefined,
      },
    });
  });

  it('expande forma curta em operador eq', () => {
    expect(parseQueryInput({ filter: { name: 'Ada' } }).filters).toEqual([
      { path: 'name', operator: 'eq', rawValue: 'Ada' },
    ]);
  });

  it('preserva a ordem dos operadores declarados', () => {
    const ast = parseQueryInput({
      filter: { score: { gte: '18', lte: '65' } },
    });
    expect(ast.filters).toEqual([
      { path: 'score', operator: 'gte', rawValue: '18' },
      { path: 'score', operator: 'lte', rawValue: '65' },
    ]);
  });

  it('preserva null como rawValue para a validação semântica decidir', () => {
    expect(
      parseQueryInput({ filter: { nickname: { eq: null } } }).filters
    ).toEqual([{ path: 'nickname', operator: 'eq', rawValue: null }]);
  });

  it('lê sort com prefixo de direção', () => {
    expect(parseQueryInput({ sort: 'name,-created_at' }).sorts).toEqual([
      { path: 'name', direction: 'asc' },
      { path: 'created_at', direction: 'desc' },
    ]);
  });

  it('aceita sort já expandido como array', () => {
    expect(parseQueryInput({ sort: ['-name'] }).sorts).toEqual([
      { path: 'name', direction: 'desc' },
    ]);
  });

  it('sort vazio produz lista vazia', () => {
    expect(parseQueryInput({ sort: '' }).sorts).toEqual([]);
  });

  it('distingue fields ausente de fields vazio', () => {
    expect(parseQueryInput({}).fields).toBeNull();
    expect(parseQueryInput({ fields: '' }).fields).toEqual([]);
    expect(parseQueryInput({ fields: 'id,name' }).fields).toEqual([
      'id',
      'name',
    ]);
  });

  it('lê includes como lista', () => {
    expect(
      parseQueryInput({ includes: 'company,company.owner' }).includes
    ).toEqual(['company', 'company.owner']);
  });

  it('remove apenas espaços externos do termo de search', () => {
    expect(parseQueryInput({ search: '  a b  ' }).search).toBe('a b');
  });

  it('search vazio depois do trim é tratado como ausente', () => {
    expect(parseQueryInput({ search: '   ' }).search).toBeNull();
  });

  it('rejeita path com sintaxe insegura', () => {
    for (const query of [
      { filter: { 'a;drop': 'x' } },
      { sort: 'a..b' },
      { includes: '1company' },
      { fields: 'a-b' },
      { filter: { '': 'x' } },
    ]) {
      expect(() => parseQueryInput(query)).toThrow(
        expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
      );
    }
  });

  it('rejeita wildcard vindo do cliente', () => {
    expect(() => parseQueryInput({ fields: 'company.*' })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
    );
  });

  it('rejeita filter que não é objeto', () => {
    expect(() => parseQueryInput({ filter: 'name' })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
    );
  });

  it('rejeita operador que não é chave de objeto simples', () => {
    expect(() => parseQueryInput({ filter: { name: { 'e q': 'x' } } })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
    );
  });

  it('passa page/perPage/paginate crus para a validação semântica', () => {
    expect(
      parseQueryInput({ page: '2', perPage: '5', paginate: 'false' }).pagination
    ).toEqual({ page: '2', perPage: '5', paginate: 'false' });
  });

  it('a AST resultante é congelada', () => {
    const ast = parseQueryInput({ filter: { name: 'Ada' } });
    expect(Object.isFrozen(ast)).toBe(true);
    expect(Object.isFrozen(ast.filters)).toBe(true);
  });
});
