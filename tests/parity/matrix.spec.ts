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

interface RunOutcome {
  result: unknown;
  customizeCalls: number;
}

async function runCase(
  adapter: AdapterId,
  testCase: ParityCase
): Promise<RunOutcome> {
  const queryInput = parseQueryString(testCase.query) as QueryInput;

  // Honor `paginate: false` declared on the case. The lib reads
  // `query.paginate` via toBool(), so passing the string is enough.
  if (testCase.paginate === false) {
    (queryInput as Record<string, unknown>).paginate = 'false';
  }

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

  let customizeCalls = 0;
  const customize =
    testCase.customize === 'extra-where'
      ? (qb: any) => {
          customizeCalls += 1;
          // Adapter-specific accumulator mutation. The matrix only
          // verifies that the hook is invoked exactly once per execute;
          // semantic validation (does the WHERE reach the count query?)
          // belongs to Phase C/D (HTTP integration with a real database).
          if (qb && typeof qb.andWhere === 'function') {
            qb.andWhere('1 = 1');
          } else if (qb && Array.isArray(qb.whereClauses)) {
            // DrizzleQB accumulator
            qb.whereClauses.push({ __parityMarker: true } as any);
          } else if (qb && qb.where && Array.isArray(qb.where.AND)) {
            // PrismaQB accumulator
            qb.where.AND.push({ __parityMarker: true });
          }
        }
      : undefined;

  const result = await service.execute(
    source,
    queryInput,
    testCase.rules,
    customize
  );

  return { result, customizeCalls };
}

// ----------------------------------------------------------------------
// Assertion: outcome under expected vs error (byte-for-byte)
// ----------------------------------------------------------------------

async function assertOutcome(
  adapter: AdapterId,
  testCase: ParityCase
): Promise<void> {
  // Conscious deviations declared per-adapter override the canonical contract.
  const expected = testCase.accept?.[adapter] ?? testCase.expected;
  let thrown: unknown = undefined;
  let outcome: RunOutcome | undefined = undefined;

  try {
    outcome = await runCase(adapter, testCase);
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
    assertSuccessShape(adapter, expected, outcome!);
    if (testCase.customize === 'extra-where' && outcome!.customizeCalls !== 1) {
      throw new Error(
        `[${adapter}] customize hook should be invoked exactly once, was invoked ${outcome!.customizeCalls} time(s)`
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

function assertSuccessShape(
  adapter: AdapterId,
  expected: { kind: 'success' } & {
    dataLength?: number;
    hasFields?: ReadonlyArray<string>;
    lacksFields?: ReadonlyArray<string>;
  },
  outcome: RunOutcome
): void {
  const result = outcome.result as Record<string, unknown> | undefined;
  if (!result || typeof result !== 'object') {
    throw new Error(
      `[${adapter}] expected object result, got: ${typeof result}`
    );
  }
  if (expected.dataLength !== undefined) {
    const data = result.data as unknown[] | undefined;
    if (!Array.isArray(data) || data.length !== expected.dataLength) {
      throw new Error(
        `[${adapter}] expected data.length === ${expected.dataLength}, got ${
          Array.isArray(data) ? data.length : 'not-an-array'
        }`
      );
    }
  }
  if (expected.hasFields) {
    for (const key of expected.hasFields) {
      if (!(key in result)) {
        throw new Error(`[${adapter}] expected key "${key}" present in result`);
      }
    }
  }
  if (expected.lacksFields) {
    for (const key of expected.lacksFields) {
      if (key in result) {
        throw new Error(`[${adapter}] expected key "${key}" ABSENT in result`);
      }
    }
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

  it('every skip entry references a gap catalogued in the parity docs', () => {
    // Known-gap allowlist mirrors the open-gaps section of
    // `plans/completed/adapters-parity/05-summary-and-open-gaps.md`. When a gap
    // closes, remove its label here and from the doc in the same PR.
    const KNOWN_GAPS = new Set<string>([
      'G4', // Prisma mode:'insensitive' provider awareness — backlog
      'G5', // Prisma temporal coercion — backlog
      'G6', // matrix infrastructure — partially landed (C/D pending)
    ]);
    for (const testCase of PARITY_CORPUS) {
      if (!testCase.skip) continue;
      for (const [adapter, skip] of Object.entries(testCase.skip)) {
        if (!skip) continue;
        expect(['typeorm', 'drizzle', 'prisma']).toContain(adapter);
        expect(skip.note).toBeTruthy();
        if (!KNOWN_GAPS.has(skip.gap)) {
          throw new Error(
            `[${testCase.id}/${adapter}] skip.gap "${skip.gap}" is not in the KNOWN_GAPS allowlist. Add it to plans/completed/adapters-parity/05-summary-and-open-gaps.md and to KNOWN_GAPS in matrix.spec.ts.`
          );
        }
      }
    }
  });
});
