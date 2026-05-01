import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Mermaid from '../../../../components/mermaid';
import ThemedImage from '../../../../components/themed-image';
import { defaultLocale, isLocale } from '../../../../lib/i18n';
import { docsPath } from '../../../../lib/seo';
import { source } from '../../../../lib/source';

type PageProps = {
  params: Promise<{ lang: string; slug: string[] }>;
};

const Page = async (props: PageProps) => {
  const params = await props.params;
  if (!isLocale(params.lang)) notFound();
  const page = source.getPage(params.slug, params.lang);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="prose dark:prose-invert max-w-none">
        <MDX
          components={{
            ...defaultMdxComponents,
            Mermaid,
            ThemedImage,
          }}
        />
      </div>
    </DocsPage>
  );
};

export const generateStaticParams = async () => {
  // hideLocale: 'default-locale' means default locale routes are served by
  // the (default) tree (no /<lang> prefix). Only non-default locales get
  // generated under [lang]/.
  const params = source.generateParams('slug', 'lang') as Array<{
    slug: string[];
    lang: string;
  }>;
  return params.filter((p) => p.lang !== defaultLocale);
};

export const generateMetadata = async (props: {
  params: Promise<{ lang: string; slug: string[] }>;
}): Promise<Metadata> => {
  const params = await props.params;
  if (!isLocale(params.lang)) notFound();
  const page = source.getPage(params.slug, params.lang);

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
      canonical: docsPath(slug, params.lang),
      languages: {
        en: enPath,
        'pt-BR': ptPath,
        'x-default': enPath,
      },
    },
  };
};

export default Page;
