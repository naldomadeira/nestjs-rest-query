import type { Metadata } from 'next';
import { SkillsPageContent } from '@/components/skills-page';
import { getDictionary } from '@/lib/i18n';
import { skillsPath } from '@/lib/seo';

const LOCALE = 'pt-BR' as const;
const dict = getDictionary(LOCALE);

export const metadata: Metadata = {
  title: dict.skills.title,
  description: dict.skills.description,
  alternates: {
    canonical: skillsPath(LOCALE),
    languages: {
      en: skillsPath('en'),
      'pt-BR': skillsPath(LOCALE),
      'x-default': skillsPath('en'),
    },
  },
  openGraph: {
    title: dict.skills.title,
    description: dict.skills.description,
    url: skillsPath(LOCALE),
    locale: LOCALE,
  },
  twitter: {
    title: dict.skills.title,
    description: dict.skills.description,
  },
};

export default function SkillsPage() {
  return <SkillsPageContent locale={LOCALE} />;
}
