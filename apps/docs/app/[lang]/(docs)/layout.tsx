import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { DocsShell } from '../../../components/docs-shell';
import { isLocale } from '../../../lib/i18n';

type LayoutProps = {
  readonly params: Promise<{ lang: string }>;
  readonly children: ReactNode;
};

const Layout = async ({ params, children }: LayoutProps) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <DocsShell locale={lang}>{children}</DocsShell>;
};

export default Layout;
