import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { resolveDocsAssetPath } from '../../lib/asset-path';

type HomeRootLayoutProps = {
  readonly children: ReactNode;
};

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';

const HomeRootLayout = ({ children }: HomeRootLayoutProps) => (
  <HomeLayout
    nav={{
      title: (
        <div className="flex items-center gap-2">
          <Image
            src={resolveDocsAssetPath('/logomark.svg')}
            alt="nestjs-rest-query"
            width={22}
            height={22}
            className="dark:invert shrink-0"
          />
          <span className="font-semibold text-sm leading-none">
            nestjs-rest-query
          </span>
        </div>
      ),
      url: '/',
    }}
    links={[
      { text: 'Docs', url: '/docs' },
      {
        type: 'icon' as const,
        text: 'GitHub',
        label: 'GitHub',
        url: GITHUB_URL,
        icon: <SiGithub className="size-4" />,
        external: true,
      },
    ]}
  >
    {children}
  </HomeLayout>
);

export default HomeRootLayout;
