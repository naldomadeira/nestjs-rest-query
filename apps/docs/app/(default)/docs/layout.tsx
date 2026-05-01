import type { ReactNode } from 'react';
import { DocsShell } from '../../../components/docs-shell';
import { defaultLocale } from '../../../lib/i18n';

const Layout = ({ children }: { readonly children: ReactNode }) => (
  <DocsShell locale={defaultLocale}>{children}</DocsShell>
);

export default Layout;
