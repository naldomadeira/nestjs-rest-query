import { parseQueryInput } from '@core/query-parser';
import { authorize } from '@core/authorization';
import { RULES_PRESETS } from '../../fixtures/rules';

const run = (preset: string, query: Record<string, unknown>) =>
  authorize(parseQueryInput(query), RULES_PRESETS[preset]);

describe('authorize', () => {
  it('aceita path exatamente autorizado', () => {
    expect(
      run('user.default', { filter: { 'company.name': { eq: 'Acme' } } })
        .filters
    ).toHaveLength(1);
  });

  it('autorizar company não autoriza company.name', () => {
    expect(() =>
      run('user.company-root-only', {
        filter: { 'company.name': { eq: 'x' } },
      })
    ).toThrow(expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' }));
  });

  it('rejeita operador não autorizado para o campo', () => {
    expect(() =>
      run('user.default', { filter: { id: { ilike: '1' } } })
    ).toThrow(expect.objectContaining({ code: 'OPERATOR_NOT_ALLOWED' }));
  });

  it('rejeita fields de relação sem include correspondente', () => {
    expect(() => run('user.default', { fields: 'id,company.name' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('aceita fields de relação com include', () => {
    const resolved = run('user.default', {
      fields: 'id,company.name',
      includes: 'company',
    });
    expect(resolved.projection.root).toEqual(['id']);
    expect(resolved.projection.relations.get('company')).toEqual(['name']);
  });

  it('usa defaults quando fields está ausente', () => {
    const resolved = run('user.default', { includes: 'company' });
    expect(resolved.projection.root).toEqual(['id', 'name']);
    expect(resolved.projection.relations.get('company')).toEqual([
      'id',
      'name',
    ]);
  });

  it('relação incluída sem field dotted usa seu default', () => {
    const resolved = run('user.default', {
      fields: 'id',
      includes: 'company',
    });
    expect(resolved.projection.relations.get('company')).toEqual([
      'id',
      'name',
    ]);
  });

  it('rejeita include não autorizado', () => {
    expect(() => run('user.default', { includes: 'posts' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('rejeita include profundo sem o pai na URL', () => {
    expect(() => run('user.deep', { includes: 'company.owner' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('rejeita search quando o endpoint não declara campos de busca', () => {
    expect(() => run('user.no-search', { search: 'x' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('rejeita sort não autorizado', () => {
    expect(() => run('user.default', { sort: 'email' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('rejeita campo interno pedido pelo cliente', () => {
    expect(() => run('user.default', { fields: 'name_folded' })).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_ALLOWED' })
    );
  });

  it('resolve o descritor de cada termo autorizado', () => {
    const resolved = run('user.default', { filter: { score: { gt: '1' } } });
    expect(resolved.filters[0].resolved.field?.kind).toBe('bigint');
  });

  it('preserva o termo de search resolvido', () => {
    const resolved = run('user.default', { search: 'ada' });
    expect(resolved.search?.term).toBe('ada');
    expect(resolved.search?.targets.map((t) => t.column)).toEqual([
      'name_folded',
      'email_folded',
    ]);
  });
});
