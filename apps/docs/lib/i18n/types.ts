/**
 * Locale identifiers used across the docs site.
 *
 * Step 1 of the i18n migration adds the type system and dictionaries but
 * keeps `pt-BR` as the default — no UX flip yet. Step 2 introduces the
 * `/pt/...` routes, the language switcher, and flips `defaultLocale` to
 * `'en'`.
 */
export const locales = ['en', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
