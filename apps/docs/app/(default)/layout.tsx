import '../global.css';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { I18nRoot } from '@/components/i18n-root';
import { ThemeProvider } from '@/providers/theme';
import { mono, sans } from '../../lib/fonts';
import { defaultLocale, getDictionary } from '../../lib/i18n';
import { i18nUI } from '../../lib/i18n-ui';
import { metadataBase, openGraphImagePath } from '../../lib/seo';

const dict = getDictionary(defaultLocale);

export const metadata: Metadata = {
  metadataBase,
  title: dict.meta.title,
  description: dict.meta.description,
  openGraph: {
    type: 'website',
    siteName: dict.meta.title,
    title: dict.meta.title,
    description: dict.meta.description,
    images: [
      {
        url: openGraphImagePath,
        width: 1200,
        height: 630,
        alt: `${dict.meta.title} Open Graph image`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: dict.meta.title,
    description: dict.meta.description,
    images: [openGraphImagePath],
  },
};

type LayoutProps = {
  readonly children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => (
  <html
    className={`${sans.variable} ${mono.variable} touch-manipulation font-sans antialiased`}
    lang={defaultLocale}
    suppressHydrationWarning
  >
    <head />
    <body className="flex flex-col min-h-screen" suppressHydrationWarning>
      <ThemeProvider>
        <I18nRoot
          locale={defaultLocale}
          i18n={i18nUI.provider(defaultLocale)}
          search={{ options: { type: 'static' } }}
        >
          {children}
        </I18nRoot>
      </ThemeProvider>
    </body>
  </html>
);

export default Layout;
