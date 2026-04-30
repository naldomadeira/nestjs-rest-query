import { BadRequestException } from '@nestjs/common';
import {
  parseCSV,
  parseIntParam,
  isSafeFieldPath,
  coerceValue,
  toBool,
  coerceForIn,
  coerceForBetween,
} from '@src/domain/normalizers/normalizers';

describe('parseCSV', () => {
  it('splits a comma-separated string into trimmed items', () => {
    expect(parseCSV('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from each item', () => {
    expect(parseCSV(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('filters out empty segments', () => {
    expect(parseCSV('a,,b')).toEqual(['a', 'b']);
  });

  it('returns a single-item array for a string without commas', () => {
    expect(parseCSV('singleValue')).toEqual(['singleValue']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('returns an empty array when the string contains only separators', () => {
    expect(parseCSV(',')).toEqual([]);
  });
});

describe('parseIntParam', () => {
  it('returns defaultValue when value is undefined', () => {
    expect(parseIntParam(undefined, 'page', 1)).toBe(1);
  });

  it('returns defaultValue when value is null', () => {
    expect(parseIntParam(null, 'page', 1)).toBe(1);
  });

  it('returns defaultValue when value is an empty string', () => {
    expect(parseIntParam('', 'page', 1)).toBe(1);
  });

  it('parses a numeric string', () => {
    expect(parseIntParam('5', 'page', 1)).toBe(5);
  });

  it('accepts a number value directly', () => {
    expect(parseIntParam(5, 'page', 1)).toBe(5);
  });

  it('returns 0 for "0" (zero is valid)', () => {
    expect(parseIntParam('0', 'page', 1)).toBe(0);
  });

  it('accepts negative numbers', () => {
    expect(parseIntParam('-3', 'page', 1)).toBe(-3);
  });

  it('throws BadRequestException for a non-numeric string', () => {
    expect(() => parseIntParam('abc', 'page', 1)).toThrow(BadRequestException);
  });

  it('includes the param name in the error message', () => {
    expect(() => parseIntParam('abc', 'perPage', 10)).toThrow(/perPage/);
  });

  it('throws BadRequestException when value is an array', () => {
    expect(() => parseIntParam(['1', '2'], 'page', 1)).toThrow(
      BadRequestException
    );
  });
});

describe('isSafeFieldPath', () => {
  it('accepts a simple field name', () => {
    expect(isSafeFieldPath('name')).toBe(true);
  });

  it('accepts a field name with underscores', () => {
    expect(isSafeFieldPath('created_at')).toBe(true);
  });

  it('accepts dot notation for relations', () => {
    expect(isSafeFieldPath('user.name')).toBe(true);
  });

  it('accepts deeply nested dot notation', () => {
    expect(isSafeFieldPath('user.address.city')).toBe(true);
  });

  it('accepts a field starting with underscore', () => {
    expect(isSafeFieldPath('_valid')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isSafeFieldPath('')).toBe(false);
  });

  it('rejects a field with SQL injection attempt', () => {
    expect(isSafeFieldPath('name; DROP TABLE')).toBe(false);
  });

  it('rejects a field with SQL comment', () => {
    expect(isSafeFieldPath('name--comment')).toBe(false);
  });

  it('rejects a field starting with a number', () => {
    expect(isSafeFieldPath('1invalid')).toBe(false);
  });

  it('rejects a field with a space', () => {
    expect(isSafeFieldPath('field name')).toBe(false);
  });

  it('rejects a field with brackets', () => {
    expect(isSafeFieldPath('field[0]')).toBe(false);
  });

  it('rejects a field with a dollar sign', () => {
    expect(isSafeFieldPath('field$name')).toBe(false);
  });

  it('rejects a lone dot', () => {
    expect(isSafeFieldPath('.')).toBe(false);
  });

  it('rejects a path ending with a dot', () => {
    expect(isSafeFieldPath('a.')).toBe(false);
  });

  it('rejects a path starting with a dot', () => {
    expect(isSafeFieldPath('.a')).toBe(false);
  });
});

describe('coerceValue', () => {
  it('parses an integer string to number', () => {
    expect(coerceValue('42')).toBe(42);
  });

  it('parses a float string to number', () => {
    expect(coerceValue('3.14')).toBe(3.14);
  });

  it('parses a negative integer string', () => {
    expect(coerceValue('-10')).toBe(-10);
  });

  it('parses "true" string to boolean true', () => {
    expect(coerceValue('true')).toBe(true);
  });

  it('parses "false" string to boolean false', () => {
    expect(coerceValue('false')).toBe(false);
  });

  it('parses "TRUE" (uppercase) to boolean true', () => {
    expect(coerceValue('TRUE')).toBe(true);
  });

  it('returns a plain string unchanged', () => {
    expect(coerceValue('hello')).toBe('hello');
  });

  it('trims whitespace from strings', () => {
    expect(coerceValue(' hello ')).toBe('hello');
  });

  it('returns a number value as-is', () => {
    expect(coerceValue(42)).toBe(42);
  });

  it('returns null as-is', () => {
    expect(coerceValue(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(coerceValue(undefined)).toBeUndefined();
  });

  it('parses "0" to number 0, not boolean false', () => {
    expect(coerceValue('0')).toBe(0);
  });

  it('parses "1" to number 1, not boolean true', () => {
    expect(coerceValue('1')).toBe(1);
  });

  it('preserves leading zeros as string (e.g. document/CPF)', () => {
    expect(coerceValue('00080941722')).toBe('00080941722');
  });

  it('preserves "007" as string', () => {
    expect(coerceValue('007')).toBe('007');
  });

  it('preserves large integers beyond MAX_SAFE_INTEGER as string', () => {
    expect(coerceValue('12345678901234567890')).toBe('12345678901234567890');
  });

  it('preserves float with leading zero as string', () => {
    expect(coerceValue('007.5')).toBe('007.5');
  });

  it('still parses a normal float', () => {
    expect(coerceValue('3.14')).toBe(3.14);
  });
});

describe('toBool', () => {
  it('returns true for boolean true', () => {
    expect(toBool(true, false)).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(toBool(false, true)).toBe(false);
  });

  it('returns true for number 1', () => {
    expect(toBool(1, false)).toBe(true);
  });

  it('returns false for number 0', () => {
    expect(toBool(0, true)).toBe(false);
  });

  it.each([['true'], ['1'], ['yes'], ['on'], ['y'], ['TRUE']])(
    'returns true for truthy string "%s"',
    (value) => {
      expect(toBool(value, false)).toBe(true);
    }
  );

  it.each([['false'], ['0'], ['no'], ['off'], ['n'], ['FALSE']])(
    'returns false for falsy string "%s"',
    (value) => {
      expect(toBool(value, true)).toBe(false);
    }
  );

  it('returns defaultValue for null', () => {
    expect(toBool(null, true)).toBe(true);
    expect(toBool(null, false)).toBe(false);
  });

  it('returns defaultValue for undefined', () => {
    expect(toBool(undefined, true)).toBe(true);
    expect(toBool(undefined, false)).toBe(false);
  });

  it('returns defaultValue for an unrecognised string', () => {
    expect(toBool('garbage', true)).toBe(true);
    expect(toBool('garbage', false)).toBe(false);
  });

  it('uses the first array element when value is an array', () => {
    expect(toBool(['true'], false)).toBe(true);
    expect(toBool(['false'], true)).toBe(false);
  });
});

describe('coerceForIn', () => {
  it('coerces each item in an array', () => {
    expect(coerceForIn(['1', '2', '3'])).toEqual([1, 2, 3]);
  });

  it('splits a CSV string and coerces each item', () => {
    expect(coerceForIn('1,2,3')).toEqual([1, 2, 3]);
  });

  it('handles a CSV string with string values', () => {
    expect(coerceForIn('foo,bar')).toEqual(['foo', 'bar']);
  });

  it('wraps a scalar number in an array', () => {
    expect(coerceForIn(42)).toEqual([42]);
  });

  it('wraps a scalar string in an array', () => {
    expect(coerceForIn('single')).toEqual(['single']);
  });

  it('returns an empty array for an empty array input', () => {
    expect(coerceForIn([])).toEqual([]);
  });
});

describe('coerceForBetween', () => {
  it('returns a tuple from a two-element array of strings', () => {
    expect(coerceForBetween(['2024-01-01', '2024-12-31'])).toEqual([
      '2024-01-01',
      '2024-12-31',
    ]);
  });

  it('parses a CSV string with two numeric values', () => {
    expect(coerceForBetween('10,20')).toEqual([10, 20]);
  });

  it('throws BadRequestException for an array with more than 2 items', () => {
    expect(() => coerceForBetween([1, 2, 3])).toThrow(BadRequestException);
  });

  it('throws BadRequestException for an array with only 1 item', () => {
    expect(() => coerceForBetween(['solo'])).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a scalar non-string value', () => {
    expect(() => coerceForBetween(42)).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a CSV string with more than 2 values', () => {
    expect(() => coerceForBetween('a,b,c')).toThrow(BadRequestException);
  });
});
