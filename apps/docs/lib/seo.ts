import { defaultLocale, type Locale } from './i18n';

const siteUrl = 'https://naldomadeira.github.io';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/nestjs-rest-query';

export const metadataBase = new URL(`${siteUrl}${basePath}/`);

export function localePrefix(locale: Locale) {
  return locale === defaultLocale ? '' : `/${locale}`;
}

export function docsPath(slugs: readonly string[] = [], locale: Locale) {
  const suffix = slugs.length > 0 ? `/${slugs.join('/')}` : '';
  return `${localePrefix(locale)}/docs${suffix}`;
}

export function homePath(locale: Locale) {
  return `${localePrefix(locale)}/`;
}

export function skillsPath(locale: Locale) {
  return `${localePrefix(locale)}/skills`;
}

export function absoluteUrl(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalized, metadataBase).toString();
}
