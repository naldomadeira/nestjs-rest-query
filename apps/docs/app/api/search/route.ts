import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

const search = createFromSource(source, {
  localeMap: {
    en: 'english',
    'pt-BR': 'portuguese',
  },
});

export const GET = search.staticGET;
