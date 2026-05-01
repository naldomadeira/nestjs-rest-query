import type { ReactNode } from 'react';
import { DocsShell } from '../../../components/docs-shell';

const Layout = ({ children }: { readonly children: ReactNode }) => (
  <DocsShell locale="pt-BR">{children}</DocsShell>
);

export default Layout;
