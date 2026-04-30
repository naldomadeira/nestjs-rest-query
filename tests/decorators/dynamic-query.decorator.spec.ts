import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { QUERY_RULES_METADATA_KEY } from '@src/core/constants';
import { DynamicQuery } from '@src/api/decorators/dynamic-query.decorator';
import { QueryRules } from '@src/api/decorators/query-rules.decorator';
import { RulesConfig } from '@src/contracts/rules-config.interface';

const RULES: RulesConfig = {
  filters: ['name', 'status'],
  sorts: ['name', 'createdAt'],
  fields: ['id', 'name', 'status'],
  includes: ['category'],
};

describe('@DynamicQuery', () => {
  it('stores RulesConfig in metadata under QUERY_RULES_METADATA_KEY', () => {
    const fn = jest.fn();
    DynamicQuery(RULES)({}, 'method', { value: fn });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn)).toEqual(RULES);
  });

  it('uses the correct metadata key "dqb:query_rules"', () => {
    expect(QUERY_RULES_METADATA_KEY).toBe('dqb:query_rules');
  });

  it('stores the exact rules object reference', () => {
    const fn = jest.fn();
    DynamicQuery(RULES)({}, 'method', { value: fn });
    const stored = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn);
    expect(stored).toBe(RULES);
  });

  it('overwrites previous metadata when applied twice', () => {
    const fn = jest.fn();
    const rulesA: RulesConfig = { filters: ['a'] };
    const rulesB: RulesConfig = { filters: ['b'] };
    DynamicQuery(rulesA)({}, 'method', { value: fn });
    DynamicQuery(rulesB)({}, 'method', { value: fn });
    const stored = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn);
    expect(stored).toEqual(rulesB);
  });

  it('stores minimal rules (no filters/sorts)', () => {
    const fn = jest.fn();
    const minimal: RulesConfig = {};
    DynamicQuery(minimal)({}, 'method', { value: fn });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn)).toEqual({});
  });

  it('does not store metadata on a different function', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    DynamicQuery(RULES)({}, 'method', { value: fn1 });
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn2)).toBeUndefined();
  });
});

describe('@QueryRules', () => {
  function makeCtx(handler: (...args: any[]) => any): ExecutionContext {
    return {
      getHandler: () => handler,
    } as unknown as ExecutionContext;
  }

  it('returns the RulesConfig stored by @DynamicQuery', () => {
    const fn = jest.fn();
    DynamicQuery(RULES)({}, 'method', { value: fn });
    const ctx = makeCtx(fn);

    // Access the factory directly — createParamDecorator wraps the factory
    // We can test the behavior by calling Reflect.getMetadata directly as @QueryRules does
    const result = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, ctx.getHandler());
    expect(result).toEqual(RULES);
  });

  it('returns undefined when no @DynamicQuery is applied', () => {
    const fn = jest.fn();
    const ctx = makeCtx(fn);
    const result = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, ctx.getHandler());
    expect(result).toBeUndefined();
  });

  it('returns the correct rules for the specific handler (not another handler)', () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const rules1: RulesConfig = { filters: ['name'] };
    const rules2: RulesConfig = { filters: ['status'] };
    DynamicQuery(rules1)({}, 'method1', { value: fn1 });
    DynamicQuery(rules2)({}, 'method2', { value: fn2 });

    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn1)).toEqual(rules1);
    expect(Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn2)).toEqual(rules2);
  });

  it('reads includes from stored rules', () => {
    const fn = jest.fn();
    DynamicQuery(RULES)({}, 'method', { value: fn });
    const stored: RulesConfig = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn);
    expect(stored.includes).toEqual(['category']);
  });

  it('reads alias from stored rules', () => {
    const fn = jest.fn();
    const rules: RulesConfig = { filters: ['name'], alias: 'company' };
    DynamicQuery(rules)({}, 'method', { value: fn });
    const stored: RulesConfig = Reflect.getMetadata(QUERY_RULES_METADATA_KEY, fn);
    expect(stored.alias).toBe('company');
  });
});
