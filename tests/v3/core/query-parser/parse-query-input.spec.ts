import { parseQueryInput } from '@core/query-parser';
import { RestQueryError } from '@core/errors';

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

/**
 * Recusa exata de param fora da gramática (spec §5.6 e §17.1).
 *
 * O código existia desde o primeiro dia do contrato e nada o lançava: param
 * desconhecido era ignorado em silêncio, contra a mesma regra que faz o path,
 * o operador e a whitelist serem exatos. É mudança de comportamento observável
 * para quem vinha da v2 — `?utm_source=x` num endpoint de lista passa a ser
 * 400 —, e é por isso que ela tem teste próprio.
 */
describe('parseQueryInput e params fora da gramática', () => {
  it('recusa param desconhecido com QUERY_SYNTAX_UNKNOWN_PARAM', () => {
    expect(() => parseQueryInput({ utm_source: 'newsletter' })).toThrow(
      expect.objectContaining({
        code: 'QUERY_SYNTAX_UNKNOWN_PARAM',
        statusCode: 400,
      })
    );
  });

  it('nomeia o param ofensor nos detalhes, sem ecoar o valor', () => {
    try {
      parseQueryInput({ perPageX: 'segredo-do-cliente' });
      throw new Error('deveria ter recusado');
    } catch (error) {
      expect(error).toBeInstanceOf(RestQueryError);
      const envelope = JSON.stringify((error as RestQueryError).toJSON());
      expect(envelope).toContain('perPageX');
      expect(envelope).not.toContain('segredo-do-cliente');
    }
  });

  it('recusa antes de qualquer coisa que a query também peça de errado', () => {
    // A ordem importa para o consumidor: um 400 que fala do param inexistente
    // é acionável; um que fala do path o manda consertar a linha errada.
    expect(() => parseQueryInput({ utm_source: 'x', sort: 'a..b' })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_UNKNOWN_PARAM' })
    );
  });

  it('aceita todos os params que a gramática declara', () => {
    expect(() =>
      parseQueryInput({
        page: '1',
        perPage: '10',
        paginate: 'true',
        sort: 'name',
        fields: 'id',
        includes: '',
        filter: { name: 'Ada' },
        search: 'ada',
      })
    ).not.toThrow();
  });

  it('chave desconhecida valendo undefined é ausência, não param', () => {
    // É a forma que uma classe DTO transpilada assume, e é como a própria
    // gramática lê `page`: presença é medida pelo valor, não pela chave.
    expect(() => parseQueryInput({ utm_source: undefined })).not.toThrow();
  });

  it('não confunde chave herdada do Object.prototype com param válido', () => {
    // A whitelist é um Set justamente por isto: com `in` sobre um objeto,
    // `constructor` e `toString` passariam por params da gramática.
    expect(() => parseQueryInput({ constructor: 'x' })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_UNKNOWN_PARAM' })
    );
    expect(() => parseQueryInput({ toString: 'x' })).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_UNKNOWN_PARAM' })
    );
  });
});
