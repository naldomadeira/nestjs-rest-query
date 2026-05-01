import '../global.css';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/providers/theme';
import { mono, sans } from '../../lib/fonts';
import { defaultLocale, isLocale, nonDefaultLocales } from '../../lib/i18n';
import { i18nUI } from '../../lib/i18n-ui';

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
          <RootProvider i18n={i18nUI.provider(lang)}>{children}</RootProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default Layout;
