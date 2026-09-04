import { parseValueList } from '@core/coercion';

describe('parseValueList', () => {
  it('mantém arrays já expandidos pelo qs', () => {
    expect(parseValueList(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('array vazio permanece vazio', () => {
    expect(parseValueList([])).toEqual([]);
  });

  it('divide CSV legado', () => {
    expect(parseValueList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('respeita aspas com vírgula interna', () => {
    expect(parseValueList('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('respeita escape por barra invertida', () => {
    expect(parseValueList('a\\,b,c')).toEqual(['a,b', 'c']);
    expect(parseValueList('"a\\"b"')).toEqual(['a"b']);
    expect(parseValueList('a\\\\b')).toEqual(['a\\b']);
  });

  it('preserva item vazio entre vírgulas', () => {
    expect(parseValueList('a,,b')).toEqual(['a', '', 'b']);
  });

  it('preserva espaços dentro e ao redor do item', () => {
    expect(parseValueList('a b, c')).toEqual(['a b', ' c']);
  });

  it('string vazia produz lista vazia', () => {
    expect(parseValueList('')).toEqual([]);
  });

  it('aspas não fechadas são erro de sintaxe', () => {
    expect(() => parseValueList('"a,b')).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
    );
  });

  it('escape pendente no fim é erro de sintaxe', () => {
    expect(() => parseValueList('a\\')).toThrow(
      expect.objectContaining({ code: 'QUERY_SYNTAX_INVALID' })
    );
  });

  it('valor escalar isolado vira lista de um item', () => {
    expect(parseValueList(7)).toEqual([7]);
  });
});
