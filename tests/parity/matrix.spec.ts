/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cross-adapter parity matrix (G6 Fase B).
 *
 * For every case in `query-corpus.ts`, runs the same input through each
 * of the three adapters (TypeORM, Drizzle, Prisma) and asserts they
 * produce the same observable outcome:
 *
 *   - success → no exception is thrown
 *   - error   → `BadRequestException` thrown with the byte-for-byte
 *               same message
 *
 * No real database is touched. Fixtures provide stub source objects
 * whose data-layer calls resolve to empty rows / zero count, so the
 * full validation + pagination path executes without I/O.
 *
 * The matrix's value is not in finding bugs in any single adapter — it
 * is in making asymmetries visible: when one adapter agrees and the
 * other two don't, the failing case names the contract line and the
 * adapter at fault.
 */

import { BadRequestException } from '@nestjs/common';

import { QueryBuilderService } from '@core/query-builder.service';
import { TypeOrmAdapter } from '@infra/adapters/typeorm.adapter';
import { DrizzleAdapter } from '@infra/adapters/drizzle.adapter';
import { PrismaAdapter } from '@infra/adapters/prisma.adapter';
import type { QueryInput } from '@contracts/query-input.interface';

import { PARITY_CORPUS, type AdapterId, type ParityCase } from './query-corpus';
import { makeTypeOrmFixture } from './fixtures/typeorm-fixture';
import { makeDrizzleFixture } from './fixtures/drizzle-fixture';
import { makePrismaFixture } from './fixtures/prisma-fixture';

// Mock the optional Prisma client peer dep so PrismaAdapter's constructor
// require() resolves successfully in the test runner.
jest.mock('@prisma/client', () => ({}), { virtual: true });

// ----------------------------------------------------------------------
// Querystring parser
// ----------------------------------------------------------------------
// Minimal `qs`-compatible parser for the bracket notation used by REST
// clients (and our corpus). Handles:
//
//   foo=bar                 → { foo: 'bar' }
//   foo[bar]=baz            → { foo: { bar: 'baz' } }
//   foo[bar][baz]=qux       → { foo: { bar: { baz: 'qux' } } }
//   a=1&b=2                 → { a: '1', b: '2' }
//   foo[bar]= (empty)       → { foo: { bar: '' } }
//
// We intentionally don't pull in `qs` to avoid coupling the test layer
// to a specific transitive dep version.

function parseQueryString(qs: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!qs) return result;
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));

    const segments = parseKeySegments(key);
    setDeep(result, segments, value);
  }
  return result;
}

function parseKeySegments(key: string): string[] {
  // 'filter[name][eq]' → ['filter', 'name', 'eq']
  const segments: string[] = [];
  let head = key;
  const bracketStart = head.indexOf('[');
  if (bracketStart === -1) return [head];
  segments.push(head.slice(0, bracketStart));
  head = head.slice(bracketStart);
  while (head.length > 0) {
    const close = head.indexOf(']');
    if (head[0] !== '[' || close === -1) break;
    segments.push(head.slice(1, close));
    head = head.slice(close + 1);
  }
  return segments;
}

function setDeep(
  target: Record<string, any>,
  segments: string[],
  value: string
): void {
  let cursor: Record<string, any> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
      cursor[seg] = {};
    }
    cursor = cursor[seg];
  }
  cursor[segments[segments.length - 1]] = value;
}

// ----------------------------------------------------------------------
// Per-adapter runners
// ----------------------------------------------------------------------

async function runCase(
  adapter: AdapterId,
  testCase: ParityCase
): Promise<void> {
  const queryInput = parseQueryString(testCase.query) as QueryInput;

  let service: QueryBuilderService;
  let source: any;

  if (adapter === 'typeorm') {
    service = new QueryBuilderService({ adapter: new TypeOrmAdapter() });
    source = makeTypeOrmFixture().repository;
  } else if (adapter === 'drizzle') {
    service = new QueryBuilderService({ adapter: new DrizzleAdapter() });
    source = makeDrizzleFixture().source;
  } else {
    service = new QueryBuilderService({ adapter: new PrismaAdapter() });
    source = makePrismaFixture().source;
  }

  // Use execute() so the full path (validation + pagination) runs.
  await service.execute(
    source,
    queryInput,
    testCase.rules,
    testCase.customize === 'extra-where'
      ? (qb: any) => {
          // The mutation is adapter-specific; for matrix purposes we only
          // require that the customize hook is invoked without throwing.
          // Fase C/D (HTTP integration) verifies it actually changes data
          // and count. Drizzle / Prisma accumulators expose mutation
          // surfaces; TypeORM accepts a SelectQueryBuilder.
          if (qb && typeof qb.andWhere === 'function') {
            qb.andWhere('1 = 1');
          }
        }
      : undefined
  );
}

// ----------------------------------------------------------------------
// Assertion: outcome under expected vs error (byte-for-byte)
// ----------------------------------------------------------------------

async function assertOutcome(
  adapter: AdapterId,
  testCase: ParityCase
): Promise<void> {
  const expected = testCase.expected;
  let thrown: unknown = undefined;

  try {
    await runCase(adapter, testCase);
  } catch (e) {
    thrown = e;
  }

  if (expected.kind === 'success') {
    if (thrown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      throw new Error(
        `[${adapter}] expected success, got: ${thrown instanceof Error ? thrown.constructor.name : 'value'} "${msg}"`
      );
    }
    return;
  }

  // expected.kind === 'error'
  if (!thrown) {
    throw new Error(
      `[${adapter}] expected 400 "${expected.message}", got success`
    );
  }
  if (!(thrown instanceof BadRequestException)) {
    const ctor = thrown instanceof Error ? thrown.constructor.name : 'value';
    throw new Error(
      `[${adapter}] expected BadRequestException, got ${ctor}: ${
        thrown instanceof Error ? thrown.message : String(thrown)
      }`
    );
  }
  // Byte-for-byte match. Use === so any drift surfaces explicitly.
  if (thrown.message !== expected.message) {
    throw new Error(
      `[${adapter}] message mismatch\n  expected: "${expected.message}"\n  actual:   "${thrown.message}"`
    );
  }
}

// ----------------------------------------------------------------------
// Matrix
// ----------------------------------------------------------------------

const ADAPTERS: AdapterId[] = ['typeorm', 'drizzle', 'prisma'];

describe('Cross-adapter parity matrix', () => {
  describe.each(PARITY_CORPUS)('$id $description', (testCase: ParityCase) => {
    it.each(ADAPTERS)('%s', async (adapter) => {
      const skip = testCase.skip?.[adapter];
      if (skip) {
        // Pending until the gap is closed. The test passes but the
        // skip is documented; remove the entry to re-enable.
        // eslint-disable-next-line jest/no-conditional-expect
        expect(skip.gap).toBeTruthy();
        return;
      }
      await assertOutcome(adapter, testCase);
    });
  });

  it('every skip entry references a known gap', () => {
    for (const testCase of PARITY_CORPUS) {
      if (!testCase.skip) continue;
      for (const [adapter, skip] of Object.entries(testCase.skip)) {
        if (!skip) continue;
        expect(skip.gap).toMatch(/^[A-Za-z][A-Za-z0-9-]+$/);
        expect(skip.note).toBeTruthy();
        expect(['typeorm', 'drizzle', 'prisma']).toContain(adapter);
      }
    }
  });
});
