import { notFound } from 'next/navigation';
import { HomeContent } from '../../../components/home-content';
import { isLocale, nonDefaultLocales } from '../../../lib/i18n';

type PageProps = {
  readonly params: Promise<{ lang: string }>;
};

export function generateStaticParams() {
  return nonDefaultLocales.map((lang) => ({ lang }));
}

const HomePage = async ({ params }: PageProps) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <HomeContent locale={lang} />;
};

export default HomePage;
