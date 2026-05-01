import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { HomeShell } from '../../../components/home-shell';
import { isLocale } from '../../../lib/i18n';

type LayoutProps = {
  readonly params: Promise<{ lang: string }>;
  readonly children: ReactNode;
};

const Layout = async ({ params, children }: LayoutProps) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <HomeShell locale={lang}>{children}</HomeShell>;
};

export default Layout;
