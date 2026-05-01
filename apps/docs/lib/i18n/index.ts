import type { Dictionary } from './dictionary-shape';
import { en } from './dictionaries/en';
import { ptBR } from './dictionaries/pt-BR';
import type { Locale } from './types';

const dictionaries: Record<Locale, Dictionary> = {
  en,
  'pt-BR': ptBR,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary } from './dictionary-shape';
export { defaultLocale, isLocale, locales, nonDefaultLocales } from './types';
export type { Locale } from './types';
