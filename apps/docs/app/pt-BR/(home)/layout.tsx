import type { ReactNode } from 'react';
import { HomeShell } from '../../../components/home-shell';

const Layout = ({ children }: { readonly children: ReactNode }) => (
  <HomeShell locale="pt-BR">{children}</HomeShell>
);

export default Layout;
