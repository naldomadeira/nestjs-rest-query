import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../lib/asset-path';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';
import { skillsPath } from '../lib/seo';
import { source } from '../lib/source';

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

type DocsShellProps = {
  readonly locale: Locale;
  readonly children: ReactNode;
};

export const DocsShell = ({ locale, children }: DocsShellProps) => {
  const t = getDictionary(locale);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  const docsUrl = `${prefix}/docs`;
  const skillsUrl = skillsPath(locale);

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
    <>
      <header className="sticky top-0 z-40 hidden border-b border-fd-border bg-fd-card/95 text-fd-foreground backdrop-blur-lg md:block">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4 lg:px-6">
          <Link
            href={prefix || '/'}
            className="inline-flex items-center gap-2.5 rounded-lg px-2 py-1.5 font-semibold transition-colors hover:bg-fd-accent/60"
          >
            {navTitle}
          </Link>
          <div className="h-6 w-px bg-fd-border" />
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href={docsUrl}
              className="rounded-lg bg-fd-primary/10 px-3 py-2 font-medium text-fd-primary transition-colors hover:bg-fd-primary/15"
            >
              {t.nav.docs}
            </Link>
            <Link
              href={skillsUrl}
              className="rounded-lg px-3 py-2 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent/60 hover:text-fd-accent-foreground"
            >
              {t.nav.skills}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/60 hover:text-fd-accent-foreground"
            >
              <SiGithub className="size-4" />
              <span>{t.nav.github}</span>
            </a>
          </div>
        </div>
      </header>
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
    </>
  );
};
