import {
  assertOperatorSupported,
  ORDER_OPERATORS,
} from '@core/semantic-validator';
import type { FieldDescriptor, ScalarKind } from '@core/schema';

const field = (kind: ScalarKind, extra: object = {}): FieldDescriptor =>
  ({
    path: 'x',
    kind,
    nullable: true,
    primaryKey: false,
    ...extra,
  }) as FieldDescriptor;

describe('assertOperatorSupported', () => {
  it('permite igualdade em todo kind não opaco', () => {
    for (const kind of [
      'string',
      'uuid',
      'enum',
      'integer',
      'bigint',
      'decimal',
      'boolean',
      'date',
      'datetime',
    ] as ScalarKind[]) {
      expect(() => assertOperatorSupported(field(kind), 'eq')).not.toThrow();
      expect(() => assertOperatorSupported(field(kind), 'ne')).not.toThrow();
      expect(() => assertOperatorSupported(field(kind), 'in')).not.toThrow();
    }
  });

  it('permite ordem em tipos com ordem total portável', () => {
    for (const kind of [
      'integer',
      'bigint',
      'decimal',
      'date',
      'datetime',
      'string',
    ] as ScalarKind[]) {
      for (const operator of ORDER_OPERATORS) {
        expect(() =>
          assertOperatorSupported(field(kind), operator)
        ).not.toThrow();
      }
    }
  });

  it('bloqueia ordem em uuid e enum sem portableOrderField', () => {
    expect(() => assertOperatorSupported(field('uuid'), 'gt')).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
    );
    expect(() =>
      assertOperatorSupported(
        field('enum', { enumValues: ['a', 'b'] }),
        'between'
      )
    ).toThrow(expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }));
  });

  it('libera ordem em uuid com portableOrderField', () => {
    expect(() =>
      assertOperatorSupported(
        field('uuid', { portableOrderField: 'id_order' }),
        'gt'
      )
    ).not.toThrow();
  });

  it('bloqueia like em campo não textual', () => {
    for (const kind of ['integer', 'boolean', 'date'] as ScalarKind[]) {
      expect(() => assertOperatorSupported(field(kind), 'like')).toThrow(
        expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' })
      );
    }
  });

  it('permite like em campo textual sem folded field', () => {
    expect(() =>
      assertOperatorSupported(field('string'), 'like')
    ).not.toThrow();
    expect(() =>
      assertOperatorSupported(field('string'), 'notLike')
    ).not.toThrow();
  });

  it('exige foldedField para ilike e notIlike', () => {
    expect(() => assertOperatorSupported(field('string'), 'ilike')).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
    );
    expect(() => assertOperatorSupported(field('string'), 'notIlike')).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
    );
    expect(() =>
      assertOperatorSupported(
        field('string', { foldedField: 'x_folded' }),
        'ilike'
      )
    ).not.toThrow();
  });

  it('bloqueia qualquer operador inferido em json e binary', () => {
    for (const operator of [
      'eq',
      'ne',
      'gt',
      'like',
      'in',
      'between',
    ] as const) {
      expect(() => assertOperatorSupported(field('json'), operator)).toThrow(
        expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' })
      );
      expect(() => assertOperatorSupported(field('binary'), operator)).toThrow(
        expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' })
      );
    }
  });

  it('permite isNull em qualquer campo nulável, inclusive opaco', () => {
    expect(() =>
      assertOperatorSupported(field('json'), 'isNull')
    ).not.toThrow();
    expect(() =>
      assertOperatorSupported(field('binary'), 'isNull')
    ).not.toThrow();
  });

  it('bloqueia isNull em campo não nulável', () => {
    expect(() =>
      assertOperatorSupported(field('integer', { nullable: false }), 'isNull')
    ).toThrow(expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' }));
  });

  it('rejeita operador desconhecido', () => {
    expect(() =>
      assertOperatorSupported(field('string'), 'regex' as never)
    ).toThrow(expect.objectContaining({ code: 'OPERATOR_NOT_ALLOWED' }));
  });
});
