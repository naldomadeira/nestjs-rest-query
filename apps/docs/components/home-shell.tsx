import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../lib/asset-path';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';
import { SiteFooter } from './site-footer';

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

type HomeShellProps = {
  readonly locale: Locale;
  readonly children: ReactNode;
};

export const HomeShell = ({ locale, children }: HomeShellProps) => {
  const t = getDictionary(locale);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;

  return (
    <HomeLayout
      i18n
      nav={{
        title: (
          <div className="flex items-center gap-2">
            <Image
              src={resolveDocsAssetPath('/logomark.svg')}
              alt={t.meta.title}
              width={22}
              height={22}
              className="dark:invert shrink-0"
            />
            <span className="font-semibold text-sm leading-none">
              {t.meta.title}
            </span>
          </div>
        ),
        url: prefix || '/',
      }}
      links={[
        { text: t.nav.docs, url: `${prefix}/docs` },
        {
          type: 'icon' as const,
          text: t.nav.github,
          label: t.nav.github,
          url: GITHUB_URL,
          icon: <SiGithub className="size-4" />,
          external: true,
        },
      ]}
    >
      {children}
      <SiteFooter locale={locale} />
    </HomeLayout>
  );
};
