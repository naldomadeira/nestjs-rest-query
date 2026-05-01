import type { Metadata } from 'next';
import { HomeContent } from '../../../components/home-content';
import { defaultLocale, getDictionary } from '../../../lib/i18n';
import { homePath } from '../../../lib/seo';

const dict = getDictionary(defaultLocale);

export const metadata: Metadata = {
  title: dict.meta.title,
  description: dict.meta.description,
  alternates: {
    canonical: homePath(defaultLocale),
    languages: {
      en: homePath('en'),
      'pt-BR': homePath('pt-BR'),
      'x-default': homePath('en'),
    },
  },
  openGraph: {
    title: dict.meta.title,
    description: dict.meta.description,
    url: homePath(defaultLocale),
  },
};

const HomePage = () => <HomeContent locale={defaultLocale} />;

export default HomePage;
