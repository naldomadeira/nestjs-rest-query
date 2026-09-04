import { encodeScalar, CivilDate, DecimalValue } from '@core/coercion';
import type { FieldDescriptor, ScalarKind } from '@core/schema';

const field = (kind: ScalarKind): FieldDescriptor =>
  ({ path: 'x', kind, nullable: true, primaryKey: false }) as FieldDescriptor;

describe('encodeScalar', () => {
  it('null permanece null em qualquer kind', () => {
    for (const kind of ['string', 'bigint', 'date', 'binary'] as ScalarKind[]) {
      expect(encodeScalar(field(kind), null)).toBeNull();
      expect(encodeScalar(field(kind), undefined)).toBeNull();
    }
  });

  it('bigint vira string decimal', () => {
    expect(encodeScalar(field('bigint'), 9007199254740993n)).toBe(
      '9007199254740993'
    );
  });

  it('decimal vira string decimal, venha como string ou DecimalValue', () => {
    expect(encodeScalar(field('decimal'), new DecimalValue('1.50'))).toBe(
      '1.50'
    );
    expect(encodeScalar(field('decimal'), '1.50')).toBe('1.50');
  });

  it('date vira YYYY-MM-DD', () => {
    expect(encodeScalar(field('date'), new CivilDate('1815-12-10'))).toBe(
      '1815-12-10'
    );
    expect(
      encodeScalar(field('date'), new Date('1815-12-10T00:00:00.000Z'))
    ).toBe('1815-12-10');
    expect(encodeScalar(field('date'), '1815-12-10')).toBe('1815-12-10');
  });

  it('datetime vira ISO 8601 UTC', () => {
    expect(
      encodeScalar(field('datetime'), new Date('2026-01-02T03:04:05.000Z'))
    ).toBe('2026-01-02T03:04:05.000Z');
  });

  it('binary vira base64', () => {
    expect(
      encodeScalar(field('binary'), new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    ).toBe('3q2+7w==');
  });

  it('integer permanece number', () => {
    expect(encodeScalar(field('integer'), 42)).toBe(42);
  });

  it('boolean permanece boolean mesmo vindo como 0/1 do driver', () => {
    expect(encodeScalar(field('boolean'), 1)).toBe(true);
    expect(encodeScalar(field('boolean'), 0)).toBe(false);
    expect(encodeScalar(field('boolean'), true)).toBe(true);
  });

  it('string permanece string', () => {
    expect(encodeScalar(field('string'), '00430123')).toBe('00430123');
  });

  it('json permanece JSON', () => {
    expect(encodeScalar(field('json'), { a: 1 })).toEqual({ a: 1 });
  });
});
