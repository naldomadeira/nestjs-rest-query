import defaultMdxComponents from 'fumadocs-ui/mdx';
import {
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Mermaid from '../../../components/mermaid';
import ThemedImage from '../../../components/themed-image';
import { source } from '../../../lib/source';

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

const Page = async (props: PageProps) => {
  const params = await props.params;
  const page = source.getPage(params.slug);

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

export const generateStaticParams = async () =>
  source
    .getPages()
    .map((page) => page.slugs)
    .filter(
      (slugs): slugs is string[] => Array.isArray(slugs) && slugs.length > 0
    )
    .map((slug) => ({ slug }));

export const generateMetadata = async (props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> => {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
};

export default Page;
