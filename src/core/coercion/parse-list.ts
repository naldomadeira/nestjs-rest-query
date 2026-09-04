import { inputError } from '../errors';

/**
 * Parser de listas da gramática (spec §10.2).
 *
 * Arrays já expandidos pelo `qs` são a forma preferencial. O CSV legado
 * continua aceito, mas com aspas e escape por barra invertida — um
 * `split(',')` ingênuo quebraria `filter[name][in]="A, B"`.
 */
export function parseValueList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw !== 'string') return [raw];
  if (raw === '') return [];

  const items: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      items.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (escaped) {
    throw inputError(
      'QUERY_SYNTAX_INVALID',
      'List value ends with a dangling escape character'
    );
  }
  if (quoted) {
    throw inputError(
      'QUERY_SYNTAX_INVALID',
      'List value has an unclosed quote'
    );
  }

  items.push(current);
  return items;
}
