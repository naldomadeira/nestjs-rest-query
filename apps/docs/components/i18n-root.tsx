'use client';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentProps, ReactNode } from 'react';
import { useCallback } from 'react';
import { defaultLocale, type Locale } from '../lib/i18n';

type RootProviderProps = ComponentProps<typeof RootProvider>;
type I18nProp = NonNullable<RootProviderProps['i18n']>;

type I18nRootProps = {
  readonly locale: Locale;
  readonly i18n: I18nProp;
  readonly search: RootProviderProps['search'];
  readonly children: ReactNode;
};

const stripLocalePrefix = (path: string, locales: readonly string[]) => {
  for (const locale of locales) {
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
};

// Fumadocs' built-in language switcher assumes a middleware that rewrites
// `/{locale}/...` URLs (createI18nMiddleware). Our static export has no
// middleware, so we resolve the next URL on the client and push it directly.
// hideLocale: 'default-locale' → default locale URLs have no prefix.
export const I18nRoot = ({ locale, i18n, search, children }: I18nRootProps) => {
  const router = useRouter();
  // usePathname returns the path WITHOUT basePath — safe for GitHub Pages where
  // window.location.pathname includes the /nestjs-rest-query prefix and would
  // produce broken URLs like /pt-BR/nestjs-rest-query when switching locales.
  const pathname = usePathname();

  const onLocaleChange = useCallback(
    (next: string) => {
      const locales = (i18n.locales ?? []).map((l) => l.locale);
      const currentPath = stripLocalePrefix(
        pathname,
        locales.length ? locales : ['pt-BR', 'en']
      );
      const target =
        next === defaultLocale
          ? currentPath
          : `/${next}${currentPath === '/' ? '' : currentPath}`;
      router.push(target);
    },
    [i18n.locales, pathname, router]
  );

  return (
    <RootProvider i18n={{ ...i18n, locale, onLocaleChange }} search={search}>
      {children}
    </RootProvider>
  );
};
