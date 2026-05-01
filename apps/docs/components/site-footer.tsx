import Link from 'next/link';
import { defaultLocale, getDictionary, type Locale } from '../lib/i18n';

const GITHUB_URL = 'https://github.com/naldomadeira/nestjs-rest-query';
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

type SiteFooterProps = {
  readonly locale: Locale;
};

export const SiteFooter = ({ locale }: SiteFooterProps) => {
  const t = getDictionary(locale);
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t.meta.title}</span>
          <span className="text-xs text-muted-foreground">
            {t.footer.tagline}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Link
            href={`${prefix}/docs`}
            className="-mx-2 inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground"
          >
            {t.footer.docs}
          </Link>
          <Link
            href="/skills"
            className="-mx-2 inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground"
          >
            {t.footer.skills}
          </Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="-mx-2 inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground"
          >
            {t.footer.github}
          </Link>
          <Link
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer"
            className="-mx-2 inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 hover:text-foreground"
          >
            {t.footer.license}
          </Link>
          <span className="px-2 text-xs">© {year}</span>
        </nav>
      </div>
    </footer>
  );
};
