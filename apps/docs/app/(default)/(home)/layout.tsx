import type { ReactNode } from 'react';
import { HomeShell } from '../../../components/home-shell';
import { defaultLocale } from '../../../lib/i18n';

const Layout = ({ children }: { readonly children: ReactNode }) => (
  <HomeShell locale={defaultLocale}>{children}</HomeShell>
);

export default Layout;
