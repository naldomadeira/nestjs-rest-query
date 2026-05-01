import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../lib/asset-path';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';
import { source } from '../lib/source';

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

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

  return (
    <DocsLayout
      i18n
      tree={source.pageTree[locale]}
      nav={{ title: navTitle, url: prefix || '/' }}
      links={[
        {
          type: 'icon' as const,
          text: t.nav.github,
          label: t.nav.github,
          url: GITHUB_URL,
          icon: <SiGithub className="size-4" />,
          external: true,
        },
      ]}
      sidebar={{ tabs: false, collapsible: true, defaultOpenLevel: 99 }}
    >
      {children}
    </DocsLayout>
  );
};
