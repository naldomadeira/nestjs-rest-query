import './global.css';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/providers/theme';
import { mono, sans } from '../lib/fonts';
import { defaultLocale } from '../lib/i18n';

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
        <RootProvider>{children}</RootProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default Layout;
