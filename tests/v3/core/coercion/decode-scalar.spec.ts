import { decodeScalar, CivilDate, DecimalValue } from '@core/coercion';
import type { FieldDescriptor, ScalarKind } from '@core/schema';

const field = (kind: ScalarKind, extra: object = {}): FieldDescriptor =>
  ({
    path: 'x',
    kind,
    nullable: false,
    primaryKey: false,
    ...extra,
  }) as FieldDescriptor;

describe('decodeScalar', () => {
  it('string mantém aparência numérica e zeros à esquerda', () => {
    expect(decodeScalar(field('string'), '00430123')).toBe('00430123');
  });

  it('string preserva espaços internos e externos', () => {
    expect(decodeScalar(field('string'), '  a b  ')).toBe('  a b  ');
  });

  it('string rejeita entrada não textual', () => {
    expect(() => decodeScalar(field('string'), 42)).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
  });

  it('integer aceita apenas inteiro decimal completo', () => {
    expect(decodeScalar(field('integer'), '42')).toBe(42);
    expect(decodeScalar(field('integer'), '-42')).toBe(-42);
    expect(decodeScalar(field('integer'), '0')).toBe(0);
  });

  it('integer rejeita parseInt permissivo', () => {
    for (const bad of [
      '10abc',
      '4.2',
      '',
      '  7 ',
      '+7',
      '0x10',
      '1e3',
      '007',
    ]) {
      expect(() => decodeScalar(field('integer'), bad)).toThrow(
        expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
      );
    }
  });

  it('integer rejeita fora da faixa segura', () => {
    expect(() => decodeScalar(field('integer'), '9007199254740993')).toThrow();
  });

  it('bigint aceita além da faixa segura', () => {
    expect(decodeScalar(field('bigint'), '9007199254740993')).toBe(
      9007199254740993n
    );
    expect(decodeScalar(field('bigint'), '-9007199254740993')).toBe(
      -9007199254740993n
    );
  });

  it('decimal nunca passa por number', () => {
    const value = decodeScalar(field('decimal'), '12345678901234567890.123456');
    expect(value).toBeInstanceOf(DecimalValue);
    expect(String(value)).toBe('12345678901234567890.123456');
  });

  it('decimal rejeita notação científica, NaN e formas ambíguas', () => {
    for (const bad of ['1e5', 'NaN', 'Infinity', '.5', '1.', '01.5', '']) {
      expect(() => decodeScalar(field('decimal'), bad)).toThrow();
    }
  });

  it('boolean aceita apenas true/false/1/0', () => {
    expect(decodeScalar(field('boolean'), 'true')).toBe(true);
    expect(decodeScalar(field('boolean'), 'false')).toBe(false);
    expect(decodeScalar(field('boolean'), '1')).toBe(true);
    expect(decodeScalar(field('boolean'), '0')).toBe(false);
  });

  it('boolean rejeita formas permissivas da v2', () => {
    for (const bad of ['yes', 'no', 'on', 'off', 'TRUE', 'True', '']) {
      expect(() => decodeScalar(field('boolean'), bad)).toThrow();
    }
  });

  it('boolean aceita o tipo nativo', () => {
    expect(decodeScalar(field('boolean'), true)).toBe(true);
  });

  it('date aceita apenas YYYY-MM-DD válida', () => {
    expect(decodeScalar(field('date'), '2026-02-28')).toBeInstanceOf(CivilDate);
    expect(String(decodeScalar(field('date'), '2024-02-29'))).toBe(
      '2024-02-29'
    );
  });

  it('date rejeita datas impossíveis e formatos frouxos', () => {
    for (const bad of ['2026-02-30', '2026-2-8', '2026-13-01', '20260208']) {
      expect(() => decodeScalar(field('date'), bad)).toThrow();
    }
  });

  it('datetime exige offset ou Z', () => {
    const value = decodeScalar(
      field('datetime'),
      '2026-01-02T03:04:05-03:00'
    ) as Date;
    expect(value.toISOString()).toBe('2026-01-02T06:04:05.000Z');
  });

  it('datetime rejeita ausência de timezone no perfil estrito', () => {
    for (const bad of [
      '2026-01-02T03:04:05',
      '2026-01-02',
      '2026-01-02 03:04:05Z',
    ]) {
      expect(() => decodeScalar(field('datetime'), bad)).toThrow();
    }
  });

  it('uuid valida formato', () => {
    const id = '3f333df6-90a4-4fda-8dd3-9485d27cee36';
    expect(decodeScalar(field('uuid'), id)).toBe(id);
    expect(() => decodeScalar(field('uuid'), 'not-a-uuid')).toThrow();
  });

  it('enum valida contra enumValues', () => {
    const status = field('enum', { enumValues: ['draft', 'live'] });
    expect(decodeScalar(status, 'live')).toBe('live');
    expect(() => decodeScalar(status, 'archived')).toThrow();
  });

  it('rejeita null fora de isNull', () => {
    expect(() => decodeScalar(field('string'), null)).toThrow(
      expect.objectContaining({ code: 'FILTER_VALUE_INVALID' })
    );
    expect(() => decodeScalar(field('integer'), undefined)).toThrow();
  });

  it('rejeita array onde se espera escalar', () => {
    expect(() => decodeScalar(field('integer'), ['1'])).toThrow();
  });

  it('json e binary não são coagidos por inferência', () => {
    expect(() => decodeScalar(field('json'), '{}')).toThrow(
      expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' })
    );
    expect(() => decodeScalar(field('binary'), 'AA==')).toThrow(
      expect.objectContaining({ code: 'OPERATOR_TYPE_MISMATCH' })
    );
  });

  it('nunca embute o valor cru na mensagem de erro', () => {
    try {
      decodeScalar(field('integer'), 'segredo-do-cliente');
    } catch (error) {
      expect((error as Error).message).not.toContain('segredo-do-cliente');
    }
  });
});
