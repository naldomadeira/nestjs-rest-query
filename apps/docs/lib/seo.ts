import { defaultLocale, type Locale } from './i18n';

const siteUrl = 'https://naldomadeira.github.io';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/nestjs-rest-query';

export const metadataBase = new URL(`${siteUrl}${basePath}/`);

export function localePrefix(locale: Locale) {
  return locale === defaultLocale ? '' : `/${locale}`;
}

export function docsPath(slugs: readonly string[] = [], locale: Locale) {
  // Both Fumadocs source slugs and Next.js [...slug] params can include the
  // leading "docs" segment for this content tree. Strip it so the URL is
  // built once, here, instead of accidentally producing "/docs/docs/...".
  const stripped = slugs[0] === 'docs' ? slugs.slice(1) : slugs;
  const suffix = stripped.length > 0 ? `/${stripped.join('/')}` : '';
  return `${localePrefix(locale)}/docs${suffix}`;
}

export function homePath(locale: Locale) {
  return `${localePrefix(locale)}/`;
}

export function absoluteUrl(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalized, metadataBase).toString();
}
