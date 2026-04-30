import { BadRequestException } from '@nestjs/common';
import { applySearch } from '@src/domain/handlers/search.handler';
import { createMockQb } from '../utils/mock-query-builder';

function createSearchQb() {
  const qb = createMockQb();
  const joins: any[] = [];

  (qb as any).expressionMap = { joinAttributes: joins };
  (qb as any).leftJoin = jest.fn((path: string, alias: string) => {
    joins.push({ alias: { name: alias }, entityOrProperty: path });
    return qb;
  });

  return qb as any;
}

const SEARCH_FIELDS = ['name', 'email', 'document'];

describe('applySearch', () => {
  it('does nothing when search is undefined', () => {
    const qb = createSearchQb();
    applySearch(qb, {}, 'root', SEARCH_FIELDS);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('does nothing when search is an empty string', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: '  ' }, 'root', SEARCH_FIELDS);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('does nothing when searchFields array is empty', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: 'test' }, 'root', []);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('applies LIKE conditions OR-ed for each search field', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: 'john' }, 'root', SEARCH_FIELDS);

    expect(qb.andWhere).toHaveBeenCalledTimes(1);

    const [condition, params] = qb.andWhere.mock.calls[0];
    expect(condition).toContain('LOWER(root.name) LIKE LOWER(:dqb_search)');
    expect(condition).toContain('LOWER(root.email) LIKE LOWER(:dqb_search)');
    expect(condition).toContain('LOWER(root.document) LIKE LOWER(:dqb_search)');
    expect(condition).toContain(' OR ');
    expect(params).toEqual({ dqb_search: '%john%' });
  });

  it('escapes % and _ in the search term', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: '100%_done' }, 'root', ['name']);

    const params = qb.andWhere.mock.calls[0][1];
    expect(params.dqb_search).toBe('%100\\%\\_done%');
  });

  it('creates a leftJoin for relation fields (dot notation)', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: 'acme' }, 'root', ['company.name']);

    expect(qb.leftJoin).toHaveBeenCalledWith('root.company', 'company');
    const [condition] = qb.andWhere.mock.calls[0];
    expect(condition).toContain('LOWER(company.name) LIKE LOWER(:dqb_search)');
  });

  it('deduplicates search fields', () => {
    const qb = createSearchQb();
    applySearch(qb, { search: 'x' }, 'root', ['name', 'name', 'email']);

    const [condition] = qb.andWhere.mock.calls[0];
    const nameMatches = condition.match(/root\.name/g);
    expect(nameMatches).toHaveLength(1);
  });

  it('throws BadRequestException for unsafe field paths', () => {
    const qb = createSearchQb();
    expect(() =>
      applySearch(qb, { search: 'x' }, 'root', ['name; DROP TABLE'])
    ).toThrow(BadRequestException);
  });
});
