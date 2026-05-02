import type { Metadata } from 'next';
import { HomeContent } from '../../../components/home-content';
import { getDictionary } from '../../../lib/i18n';
import { homePath, openGraphImages } from '../../../lib/seo';

const LOCALE = 'pt-BR' as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = {
  title: dict.meta.title,
  description: dict.meta.description,
  alternates: {
    canonical: homePath(LOCALE),
    languages: {
      en: homePath('en'),
      'pt-BR': homePath('pt-BR'),
      'x-default': homePath('en'),
    },
  },
  openGraph: {
    title: dict.meta.title,
    description: dict.meta.description,
    url: homePath(LOCALE),
    locale: LOCALE,
    images: openGraphImages(`Imagem Open Graph de ${dict.meta.title}`),
  },
};

const HomePage = () => <HomeContent locale={LOCALE} />;

export default HomePage;
