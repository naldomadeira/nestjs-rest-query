import Link from 'next/link';
import { Download, ExternalLink, Sparkles } from 'lucide-react';

import { getDictionary, type Locale } from '@/lib/i18n';
import { skills } from '@/lib/skills';

type SkillsPageContentProps = {
  readonly locale: Locale;
};

export const SkillsPageContent = ({ locale }: SkillsPageContentProps) => {
  const t = getDictionary(locale);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <header className="mb-10 flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-fd-border bg-fd-muted/40 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          <Sparkles className="size-3.5" />
          {t.skills.badge}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t.skills.title}
        </h1>
        <p className="max-w-2xl text-fd-muted-foreground">
          {t.skills.description}
        </p>
      </header>

      {skills.length === 0 ? (
        <div className="rounded-lg border border-fd-border bg-fd-muted/40 p-6 text-center text-fd-muted-foreground">
          {t.skills.empty}
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex flex-col gap-4 rounded-xl border border-fd-border bg-fd-card p-6 transition-colors hover:border-fd-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-lg font-semibold">
                    {skill.name}
                  </h2>
                  {skill.version ? (
                    <span className="text-xs font-mono text-fd-muted-foreground">
                      v{skill.version}
                    </span>
                  ) : null}
                </div>
                {skill.category ? (
                  <span className="shrink-0 rounded-md bg-fd-primary/10 px-2 py-0.5 text-xs font-medium text-fd-primary">
                    {skill.category}
                  </span>
                ) : null}
              </div>

              <p className="line-clamp-4 text-sm text-fd-muted-foreground">
                {skill.description}
              </p>

              {skill.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {skill.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md border border-fd-border px-2 py-0.5 text-xs text-fd-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <a
                  href={skill.downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-3 py-1.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Download className="size-4" />
                  {t.skills.download}
                </a>
                <Link
                  href={skill.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-muted/40"
                >
                  <ExternalLink className="size-4" />
                  {t.skills.viewOnGitHub}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12 rounded-xl border border-fd-border bg-fd-muted/30 p-6">
        <h2 className="mb-2 text-lg font-semibold">{t.skills.howToUseTitle}</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-fd-muted-foreground">
          {t.skills.howToUseSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
};
