import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Mermaid from '../../../../components/mermaid';
import ThemedImage from '../../../../components/themed-image';
import { docsPath } from '../../../../lib/seo';
import { source } from '../../../../lib/source';

const LOCALE = 'pt-BR' as const;

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

const Page = async (props: PageProps) => {
  const params = await props.params;
  const page = source.getPage(params.slug, LOCALE);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;
  const githubUrl = `https://github.com/naldomadeira/nestjs-rest-query/blob/main/apps/docs/content/${page.path}`;

  return (
    <DocsPage
      full={page.data.full}
      toc={page.data.toc}
      breadcrumb={{ enabled: true, includePage: true }}
      tableOfContent={{ style: 'clerk' }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <EditOnGitHub href={githubUrl} />
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            Mermaid,
            ThemedImage,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
};

export const dynamicParams = false;

export const generateStaticParams = async () =>
  source
    .getPages(LOCALE)
    .map((page) => page.slugs)
    .filter(
      (slugs): slugs is string[] => Array.isArray(slugs) && slugs.length > 0
    )
    .map((slug) => ({ slug }));

export const generateMetadata = async (props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> => {
  const params = await props.params;
  const page = source.getPage(params.slug, LOCALE);

  if (!page) {
    notFound();
  }

  const slug = params.slug ?? [];
  const enPath = docsPath(slug, 'en');
  const ptPath = docsPath(slug, 'pt-BR');

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: docsPath(slug, LOCALE),
      languages: {
        en: enPath,
        'pt-BR': ptPath,
        'x-default': enPath,
      },
    },
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: docsPath(slug, LOCALE),
      locale: LOCALE,
    },
    twitter: {
      title: page.data.title,
      description: page.data.description,
    },
  };
};

export default Page;
