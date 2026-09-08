import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';

type HomeContentProps = {
  readonly locale: Locale;
};

const localePrefix = (locale: Locale) =>
  locale === defaultLocale ? '' : `/${locale}`;

/**
 * v3 is implemented in this repository but the latest npm release is still on
 * the 2.x API, so the landing page has to say so where the reader lands — the
 * `/docs` tree carries the same warning at the top of its introduction.
 */
const STATUS_DOC_URL =
  'https://github.com/naldomadeira/nestjs-rest-query/blob/main/docs/v3/status.md';

const statusTone: Record<string, string> = {
  Stable: 'text-emerald-600 dark:text-emerald-400',
  Estável: 'text-emerald-600 dark:text-emerald-400',
  Roadmap: 'text-amber-600 dark:text-amber-400',
};

export const HomeContent = ({ locale }: HomeContentProps) => {
  const t = getDictionary(locale);
  const prefix = localePrefix(locale);
  const docsHref = `${prefix}/docs`;
  const prerequisitesHref = `${prefix}/docs/getting-started/prerequisites`;

  return (
    <main className="mx-auto mt-[var(--fd-nav-height)] w-full max-w-5xl overflow-x-clip px-4 pb-24 pt-16 sm:px-6 lg:pt-24">
      {/* Prerelease notice */}
      <aside className="mb-12 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {t.home.notice.title}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.home.notice.body}
        </p>
        <a
          href={STATUS_DOC_URL}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-amber-700 underline underline-offset-4 dark:text-amber-400"
        >
          {t.home.notice.linkLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </aside>

      {/* Hero */}
      <section className="flex flex-col gap-6 border-b border-border/60 pb-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {t.home.hero.eyebrow}
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {t.home.hero.title}
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t.home.hero.subtitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={prerequisitesHref}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.home.hero.ctaPrimary}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={docsHref}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t.home.hero.ctaSecondary}
          </Link>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-b border-border/60 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.home.beforeAfter.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.home.beforeAfter.description}
          </p>
        </div>

        <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-2">
          <CodePane
            label={t.home.beforeAfter.beforeLabel}
            tone="muted"
            code={t.home.beforeAfter.beforeCode}
          />
          <CodePane
            label={t.home.beforeAfter.afterLabel}
            tone="primary"
            code={t.home.beforeAfter.afterCode}
          />
        </div>
      </section>

      {/* Compatibility */}
      <section className="border-b border-border/60 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.home.compatibility.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.home.compatibility.description}
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-full text-left text-sm sm:text-base">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.home.compatibility.headers.name}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.home.compatibility.headers.status}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.home.compatibility.headers.note}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {t.home.compatibility.rows.map((row) => {
                const tone = statusTone[row.status] ?? 'text-muted-foreground';
                const Icon =
                  row.status === 'Roadmap' ? CircleDashed : CheckCircle2;
                return (
                  <tr key={row.name} className="bg-background">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className={`px-4 py-3 ${tone}`}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4" aria-hidden />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quickstart */}
      <section className="py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.home.quickstart.title}
          </h2>
        </div>

        <ol className="mt-8 grid min-w-0 gap-6 lg:grid-cols-3">
          {t.home.quickstart.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-5"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-[12px] font-semibold text-foreground">
                  {index + 1}
                </span>
                {step.title}
              </div>
              <p className="text-base leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <pre className="mt-auto overflow-x-auto rounded-md bg-muted/60 p-3 text-[13.5px] leading-relaxed text-foreground">
                <code>{step.code}</code>
              </pre>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex">
          <Link
            href={prerequisitesHref}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.home.quickstart.cta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
};

type CodePaneProps = {
  readonly label: string;
  readonly code: string;
  readonly tone: 'muted' | 'primary';
};

const CodePane = ({ label, code, tone }: CodePaneProps) => {
  const labelTone =
    tone === 'primary' ? 'text-primary' : 'text-muted-foreground';
  const ringTone =
    tone === 'primary'
      ? 'border-primary/40 bg-primary/[0.03]'
      : 'border-border bg-muted/30';

  return (
    <div className={`flex min-w-0 flex-col rounded-lg border ${ringTone}`}>
      <div
        className={`flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs font-medium uppercase tracking-wider ${labelTone}`}
      >
        <span>{label}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[13.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
