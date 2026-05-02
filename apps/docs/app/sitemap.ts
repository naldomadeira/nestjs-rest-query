import type { MetadataRoute } from 'next';
import { absoluteUrl, docsPath, homePath, skillsPath } from '../lib/seo';
import { source } from '../lib/source';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const enDocs = source.getPages('en').map((page) => ({
    url: absoluteUrl(docsPath(page.slugs as readonly string[], 'en')),
    lastModified: now,
  }));

  const ptDocs = source.getPages('pt-BR').map((page) => ({
    url: absoluteUrl(docsPath(page.slugs as readonly string[], 'pt-BR')),
    lastModified: now,
  }));

  return [
    { url: absoluteUrl(homePath('en')), lastModified: now, priority: 1 },
    { url: absoluteUrl(homePath('pt-BR')), lastModified: now, priority: 0.8 },
    { url: absoluteUrl(skillsPath('en')), lastModified: now, priority: 0.6 },
    {
      url: absoluteUrl(skillsPath('pt-BR')),
      lastModified: now,
      priority: 0.6,
    },
    ...enDocs,
    ...ptDocs,
  ];
}
