import '../global.css';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/providers/theme';
import { mono, sans } from '../../lib/fonts';
import { getDictionary } from '../../lib/i18n';
import { i18nUI } from '../../lib/i18n-ui';
import { metadataBase } from '../../lib/seo';

const LOCALE = 'pt-BR' as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = {
  metadataBase,
  title: dict.meta.title,
  description: dict.meta.description,
  openGraph: {
    type: 'website',
    siteName: dict.meta.title,
    title: dict.meta.title,
    description: dict.meta.description,
    locale: LOCALE,
    images: ['/opengraph-image.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: dict.meta.title,
    description: dict.meta.description,
    images: ['/opengraph-image.jpg'],
  },
};

type LayoutProps = {
  readonly children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => (
  <html
    className={`${sans.variable} ${mono.variable} touch-manipulation font-sans antialiased`}
    lang={LOCALE}
    suppressHydrationWarning
  >
    <head />
    <body className="flex flex-col min-h-screen" suppressHydrationWarning>
      <ThemeProvider>
        <RootProvider
          i18n={i18nUI.provider(LOCALE)}
          search={{ options: { type: 'static' } }}
        >
          {children}
        </RootProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default Layout;
