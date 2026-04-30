import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { SiGitlab } from '@icons-pack/react-simple-icons';
import { source } from '../../lib/source';

type DocsRootLayoutProps = {
  readonly children: ReactNode;
};

const GITHUB_URL =
  'https://github.com/nestjs-rest-query/nestjs-rest-query';

const navTitle = (
  <div className="flex items-center gap-2">
    <Image
      src="/logomark.svg"
      alt="NestJS Dynamic Query Builder"
      width={22}
      height={22}
      className="dark:invert shrink-0"
    />
    <span className="font-semibold text-sm leading-none">
      NestJS Dynamic Query Builder
    </span>
  </div>
);

const navLinks = [
  { text: 'Docs', url: '/docs' },
  {
    type: 'icon' as const,
    text: 'GitHub',
    label: 'GitHub',
    url: GITHUB_URL,
    icon: <SiGitlab className="size-4" />,
    external: true,
  },
];

const docsLayoutStyle = {
  '--fd-layout-width': 'min(1560px, 100%)',
  '--fd-sidebar-width': 'clamp(198px, 13vw, 224px)',
  '--fd-toc-width': 'clamp(192px, 11vw, 224px)',
} as CSSProperties;

const DocsRootLayout = ({ children }: DocsRootLayoutProps) => (
  <HomeLayout nav={{ title: navTitle, url: '/' }} links={navLinks}>
    <DocsLayout
      tree={source.pageTree}
      nav={{ enabled: false }}
      sidebar={{ tabs: false, collapsible: true }}
      containerProps={{ style: docsLayoutStyle }}
    >
      {children}
    </DocsLayout>
  </HomeLayout>
);

export default DocsRootLayout;
