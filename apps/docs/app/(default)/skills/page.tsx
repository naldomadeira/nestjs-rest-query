import type { Metadata } from 'next';
import { SkillsPageContent } from '@/components/skills-page';
import { defaultLocale, getDictionary } from '@/lib/i18n';
import { skillsPath } from '@/lib/seo';

const t = getDictionary(defaultLocale);

export const metadata: Metadata = {
  title: t.skills.title,
  description: t.skills.description,
  alternates: {
    canonical: skillsPath(defaultLocale),
    languages: {
      en: skillsPath('en'),
      'pt-BR': skillsPath('pt-BR'),
      'x-default': skillsPath('en'),
    },
  },
  openGraph: {
    title: t.skills.title,
    description: t.skills.description,
    url: skillsPath(defaultLocale),
  },
  twitter: {
    title: t.skills.title,
    description: t.skills.description,
  },
};

export default function SkillsPage() {
  return <SkillsPageContent locale={defaultLocale} />;
}
