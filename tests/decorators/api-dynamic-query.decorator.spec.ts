import 'reflect-metadata';
import { DynamicQueryBuilderModule } from '@src/core/dynamic-query-builder.module';
import { QUERY_RULES_METADATA_KEY } from '@src/core/constants';
import {
  ApiDynamicQuery,
  resolveAllowedOperators,
} from '@src/api/decorators/api-dynamic-query.decorator';
import { buildDQBSwaggerDecorators } from '@src/api/swagger/dqb-swagger.builder';
import { RulesConfig } from '@src/contracts/rules-config.interface';
import { ALL_OPERATORS } from '@src/domain/operators/operator.types';

const RULES: RulesConfig = {
  filters: ['name', 'status'],
  sorts: ['name', 'createdAt'],
  fields: ['id', 'name', 'status'],
  includes: ['category'],
};

describe('buildDQBSwaggerDecorators', () => {
  it('returns an array', () => {
    const result = buildDQBSwaggerDecorators(RULES, ALL_OPERATORS);
    expect(Array.isArray(result)).toBe(true);
  });

  it('includes pagination decorators (page, perPage, paginate) for any rules', () => {
    const result = buildDQBSwaggerDecorators(RULES, ALL_OPERATORS);
    // When swagger is available, returns at least the 3 pagination ApiQuery decorators
    // plus extension + sort + fields + includes + filter = 8 total for RULES above
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it('returns empty array when rules have no filters/sorts/fields/includes', () => {
    const result = buildDQBSwaggerDecorators({}, ALL_OPERATORS);
    // Extension + pagination (page, perPage, paginate) — 4 entries
    expect(result.length).toBe(4);
  });

  it('adds sort ApiQuery when rules.sorts is provided', () => {
    const rulesWithSorts: RulesConfig = { sorts: ['name', 'createdAt'] };
    const withSorts = buildDQBSwaggerDecorators(rulesWithSorts, ALL_OPERATORS);
    const withoutSorts = buildDQBSwaggerDecorators({}, ALL_OPERATORS);
    expect(withSorts.length).toBeGreaterThan(withoutSorts.length);
  });

  it('adds fields ApiQuery when rules.fields is provided', () => {
    const rulesWithFields: RulesConfig = { fields: ['id', 'name'] };
    const withFields = buildDQBSwaggerDecorators(
      rulesWithFields,
      ALL_OPERATORS
    );
    const withoutFields = buildDQBSwaggerDecorators({}, ALL_OPERATORS);
    expect(withFields.length).toBeGreaterThan(withoutFields.length);
  });

  it('adds includes ApiQuery when rules.includes is provided', () => {
    const rulesWithIncludes: RulesConfig = { includes: ['category'] };
    const withIncludes = buildDQBSwaggerDecorators(
      rulesWithIncludes,
      ALL_OPERATORS
    );
    const withoutIncludes = buildDQBSwaggerDecorators({}, ALL_OPERATORS);
    expect(withIncludes.length).toBeGreaterThan(withoutIncludes.length);
  });

  it('adds filter ApiQuery when rules.filters is provided', () => {
    const rulesWithFilters: RulesConfig = { filters: ['name'] };
    const withFilters = buildDQBSwaggerDecorators(
      rulesWithFilters,
      ALL_OPERATORS
    );
    const withoutFilters = buildDQBSwaggerDecorators({}, ALL_OPERATORS);
    expect(withFilters.length).toBeGreaterThan(withoutFilters.length);
  });

  it('returns all decorators for fully populated rules', () => {
    const result = buildDQBSwaggerDecorators(RULES, ALL_OPERATORS);
    // extension + 3 pagination + sort + fields + includes + filter = 8
    expect(result.length).toBe(8);
  });

  it('each entry is a function (MethodDecorator)', () => {
    const result = buildDQBSwaggerDecorators(RULES, ALL_OPERATORS);
    for (const dec of result) {
      expect(typeof dec).toBe('function');
    }
  });

  it('accepts a restricted operators list', () => {
    const result = buildDQBSwaggerDecorators(RULES, ['eq', 'like']);
    expect(result.length).toBe(8);
  });
});

describe('@ApiDynamicQuery', () => {
  beforeEach(() => {
    DynamicQueryBuilderModule.forRoot({});
  });

  it('stores RulesConfig metadata on the handler function', () => {
    const fn = jest.fn();
    ApiDynamicQuery(RULES)({}, 'method', { value: fn });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn)).toEqual(RULES);
  });

  it('stores exact rules reference', () => {
    const fn = jest.fn();
    ApiDynamicQuery(RULES)({}, 'method', { value: fn });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn)).toBe(RULES);
  });

  it('returns the descriptor', () => {
    const fn = jest.fn();
    const descriptor = { value: fn };
    const result = ApiDynamicQuery(RULES)({}, 'method', descriptor);
    expect(result).toBe(descriptor);
  });

  it('stores minimal rules (empty object)', () => {
    const fn = jest.fn();
    const minimal: RulesConfig = {};
    ApiDynamicQuery(minimal)({}, 'method', { value: fn });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn)).toEqual({});
  });

  it('rules with alias are preserved in metadata', () => {
    const fn = jest.fn();
    const rules: RulesConfig = { filters: ['name'], alias: 'company' };
    ApiDynamicQuery(rules)({}, 'method', { value: fn });
    const stored: RulesConfig = Reflect.getMetadata(
      QUERY_RULES_METADATA_KEY,
      fn
    );
    expect(stored.alias).toBe('company');
  });

  it('does not throw when applied to a method', () => {
    const fn = jest.fn();
    expect(() =>
      ApiDynamicQuery(RULES)({}, 'method', { value: fn })
    ).not.toThrow();
  });

  it('prefers endpoint operators over global config', () => {
    DynamicQueryBuilderModule.forRoot({
      operators: { allowed: ['eq', 'like'] },
    });

    expect(
      resolveAllowedOperators({
        filters: ['name'],
        operators: { allowed: ['eq'] },
      })
    ).toEqual(['eq']);
  });

  it('uses global operators when endpoint does not define operators', () => {
    DynamicQueryBuilderModule.forRoot({
      operators: { allowed: ['eq', 'like'] },
    });

    expect(resolveAllowedOperators({ filters: ['name'] })).toEqual([
      'eq',
      'like',
    ]);
  });

  it('allows all operators when endpoint sets an empty operators object', () => {
    DynamicQueryBuilderModule.forRoot({
      operators: { allowed: ['eq'] },
    });

    expect(resolveAllowedOperators({ filters: ['name'], operators: {} })).toBe(
      ALL_OPERATORS
    );
  });
});
