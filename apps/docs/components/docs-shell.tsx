import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../lib/asset-path';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';
import { source } from '../lib/source';

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

const docsLayoutStyle = {
  '--fd-layout-width': 'min(1560px, 100%)',
  '--fd-sidebar-width': 'clamp(198px, 13vw, 224px)',
  '--fd-toc-width': 'clamp(192px, 11vw, 224px)',
} as CSSProperties;

type DocsShellProps = {
  readonly locale: Locale;
  readonly children: ReactNode;
};

export const DocsShell = ({ locale, children }: DocsShellProps) => {
  const t = getDictionary(locale);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;

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
    { text: t.nav.docs, url: `${prefix}/docs` },
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

  return (
    <HomeLayout
      i18n
      nav={{ title: navTitle, url: prefix || '/' }}
      links={navLinks}
    >
      <DocsLayout
        i18n
        tree={source.pageTree[locale]}
        nav={{ enabled: false }}
        sidebar={{ tabs: false, collapsible: true }}
        containerProps={{ style: docsLayoutStyle }}
      >
        {children}
      </DocsLayout>
    </HomeLayout>
  );
};
