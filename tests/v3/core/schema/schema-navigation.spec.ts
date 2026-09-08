import { resolvePath, crossesMany } from '@core/schema';
import { RestQueryError } from '@core/errors';
import { CORPUS_SCHEMAS } from '../../fixtures/schemas';

describe('resolvePath', () => {
  it('resolve um campo root', () => {
    const resolved = resolvePath(CORPUS_SCHEMAS, 'user', 'name');
    expect(resolved.relationChain).toEqual([]);
    expect(resolved.field?.kind).toBe('string');
    expect(resolved.ownerModel).toBe('user');
  });

  it('resolve através de uma relação one', () => {
    const resolved = resolvePath(CORPUS_SCHEMAS, 'user', 'company.name');
    expect(resolved.relationChain.map((r) => r.path)).toEqual(['company']);
    expect(resolved.field?.path).toBe('name');
    expect(resolved.ownerModel).toBe('company');
  });

  it('resolve caminho profundo', () => {
    const resolved = resolvePath(CORPUS_SCHEMAS, 'user', 'company.owner.name');
    expect(resolved.relationChain.map((r) => r.path)).toEqual([
      'company',
      'owner',
    ]);
  });

  it('detecta travessia por relação many', () => {
    const resolved = resolvePath(CORPUS_SCHEMAS, 'user', 'posts.title');
    expect(crossesMany(resolved.relationChain)).toBe(true);
  });

  it('não acusa many em caminho só de relações one', () => {
    const resolved = resolvePath(CORPUS_SCHEMAS, 'user', 'company.owner.name');
    expect(crossesMany(resolved.relationChain)).toBe(false);
  });

  it('lança FIELD_NOT_FOUND para folha inexistente', () => {
    expect(() => resolvePath(CORPUS_SCHEMAS, 'user', 'company.nope')).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_FOUND' })
    );
  });

  it('lança RELATION_NOT_FOUND para relação inexistente', () => {
    expect(() => resolvePath(CORPUS_SCHEMAS, 'user', 'nope.name')).toThrow(
      expect.objectContaining({ code: 'RELATION_NOT_FOUND' })
    );
  });

  it('recusa resolver um campo interno', () => {
    expect(() => resolvePath(CORPUS_SCHEMAS, 'user', 'name_folded')).toThrow(
      RestQueryError
    );
  });

  it('resolve uma relação como alvo terminal', () => {
    const relation = resolvePath(CORPUS_SCHEMAS, 'user', 'company', {
      allowRelationLeaf: true,
    });
    expect(relation.field).toBeNull();
    expect(relation.relation?.cardinality).toBe('one');
  });

  it('sem allowRelationLeaf, uma relação terminal é FIELD_NOT_FOUND', () => {
    expect(() => resolvePath(CORPUS_SCHEMAS, 'user', 'company')).toThrow(
      expect.objectContaining({ code: 'FIELD_NOT_FOUND' })
    );
  });
});
