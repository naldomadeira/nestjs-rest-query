import Image from 'next/image';
import Link from 'next/link';
import { resolveDocsAssetPath } from '../../lib/asset-path';
import { defaultLocale, getDictionary } from '../../lib/i18n';

const t = getDictionary(defaultLocale);

const HomePage = () => (
  <div className="mx-auto mt-[var(--fd-nav-height)] max-w-5xl px-4 py-12">
    {/* Hero */}
    <div className="flex flex-col items-center text-center gap-6 mb-14">
      <div className="flex items-center gap-2.5">
        <Image
          src={resolveDocsAssetPath('/logomark.svg')}
          alt={t.meta.title}
          width={40}
          height={40}
          className="dark:invert"
        />
        <code className="text-sm text-muted-foreground">{t.meta.title}</code>
      </div>

      <h1 className="text-5xl font-bold tracking-tight leading-tight">
        {t.meta.title}
      </h1>

      <p className="text-lg text-muted-foreground max-w-xl">
        {t.home.hero.subtitle}
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/docs/getting-started/prerequisites"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          {t.home.hero.ctaPrimary} →
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          {t.home.hero.ctaSecondary}
        </Link>
      </div>
    </div>

    {/* Preview — light/dark variants */}
    <div className="rounded-xl overflow-hidden border border-border shadow-md mb-16">
      <Image
        src={resolveDocsAssetPath('/patterns.png')}
        alt={t.home.hero.previewAlt}
        width={1200}
        height={630}
        className="w-full h-auto dark:hidden"
        priority
      />
      <Image
        src={resolveDocsAssetPath('/patters-dark.png')}
        alt={t.home.hero.previewAlt}
        width={1200}
        height={630}
        className="w-full h-auto hidden dark:block"
        priority
      />
    </div>

    {/* Features grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {t.home.features.map((f) => (
        <div
          key={f.title}
          className="rounded-lg border border-border p-5 bg-card hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold mb-1 text-sm">{f.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {f.description}
          </p>
        </div>
      ))}
    </div>
  </div>
);

export default HomePage;
