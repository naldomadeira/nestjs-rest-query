/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';

export function parseCSV(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseIntParam(
  value: unknown,
  paramName: string,
  defaultValue: number
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    throw new BadRequestException(`"${paramName}" cannot have multiple values`);
  }

  const num = parseInt(String(value), 10);

  if (isNaN(num)) {
    throw new BadRequestException(
      `"${paramName}" must be a valid integer, got "${value}"`
    );
  }

  return num;
}

export function isSafeFieldPath(path: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(path);
}

export function coerceValue(value: any): string | number | boolean {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^-?\d+$/.test(trimmed) && !/^0\d/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (Number.isSafeInteger(n)) return n;
      return trimmed;
    }
    if (/^-?\d+\.\d+$/.test(trimmed) && !/^0\d/.test(trimmed)) return parseFloat(trimmed);
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    return trimmed;
  }

  return value;
}

export function toBool(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return toBool(value[0], defaultValue);
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'n'].includes(s)) return false;
    if (['true', '1', 'yes', 'on', 'y'].includes(s)) return true;
    return defaultValue;
  }
  if (value == null) return defaultValue;
  return Boolean(value);
}

export function coerceForIn(value: any): any[] {
  if (Array.isArray(value)) return value.map(coerceValue);
  if (typeof value === 'string') return parseCSV(value).map(coerceValue);
  return [coerceValue(value)];
}

export function coerceForBetween(value: any): [any, any] {
  let arr: any[];

  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    arr = parseCSV(value).map(coerceValue);
  } else {
    throw new BadRequestException(
      `Operator "between" expects array or comma-separated string with 2 values`
    );
  }

  if (arr.length !== 2) {
    throw new BadRequestException(
      `Operator "between" expects exactly 2 values, got ${arr.length}`
    );
  }

  return [coerceValue(arr[0]), coerceValue(arr[1])];
}
