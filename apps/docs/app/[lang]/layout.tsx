import '../global.css';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/providers/theme';
import { mono, sans } from '../../lib/fonts';
import {
  defaultLocale,
  getDictionary,
  isLocale,
  nonDefaultLocales,
} from '../../lib/i18n';
import { i18nUI } from '../../lib/i18n-ui';
import { metadataBase } from '../../lib/seo';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return { metadataBase };
  }
  const dict = getDictionary(lang);
  return {
    metadataBase,
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

type LayoutProps = {
  readonly params: Promise<{ lang: string }>;
  readonly children: ReactNode;
};

export async function generateStaticParams() {
  // hideLocale: 'default-locale' means default locale routes have no /<lang>
  // prefix — they're served by the (default) route group. The [lang] tree
  // only generates routes for non-default locales.
  return nonDefaultLocales.map((lang) => ({ lang }));
}

const Layout = async ({ params, children }: LayoutProps) => {
  const { lang } = await params;

  if (!isLocale(lang) || lang === defaultLocale) {
    notFound();
  }

  return (
    <html
      className={`${sans.variable} ${mono.variable} touch-manipulation font-sans antialiased`}
      lang={lang}
      suppressHydrationWarning
    >
      <head />
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <ThemeProvider>
          <RootProvider
            i18n={i18nUI.provider(lang)}
            search={{ options: { type: 'static' } }}
          >
            {children}
          </RootProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default Layout;
