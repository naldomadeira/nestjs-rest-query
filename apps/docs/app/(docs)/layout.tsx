import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../../lib/asset-path';
import { defaultLocale, getDictionary } from '../../lib/i18n';
import { source } from '../../lib/source';

type DocsRootLayoutProps = {
  readonly children: ReactNode;
};

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

const t = getDictionary(defaultLocale);

const navTitle = (
  <div className="flex items-center gap-2">
    <Image
      src={resolveDocsAssetPath('/logomark.svg')}
      alt={t.meta.title}
      width={22}
      height={22}
      className="dark:invert shrink-0"
    />
    <span className="font-semibold text-sm leading-none">{t.meta.title}</span>
  </div>
);

const navLinks = [
  { text: t.nav.docs, url: '/docs' },
  { text: t.nav.skills, url: '/skills' },
  {
    type: 'icon' as const,
    text: t.nav.github,
    label: t.nav.github,
    url: GITHUB_URL,
    icon: <SiGithub className="size-4" />,
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
