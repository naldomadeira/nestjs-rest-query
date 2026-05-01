/**
 * Shape contract that every locale dictionary must implement.
 *
 * Adding a new key here forces a TypeScript error in any locale file that
 * forgets to translate it — the type system is the migration safety net.
 */
export type Dictionary = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    docs: string;
    skills: string;
    github: string;
  };
  home: {
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
      previewAlt: string;
    };
    beforeAfter: {
      title: string;
      description: string;
      beforeLabel: string;
      afterLabel: string;
      beforeCode: string;
      afterCode: string;
    };
    compatibility: {
      title: string;
      description: string;
      headers: { name: string; status: string; note: string };
      rows: ReadonlyArray<{
        name: string;
        status: string;
        note: string;
      }>;
    };
    quickstart: {
      title: string;
      steps: ReadonlyArray<{
        title: string;
        body: string;
        code: string;
      }>;
      cta: string;
    };
  };
  skills: {
    badge: string;
    title: string;
    description: string;
    empty: string;
    download: string;
    viewOnGitHub: string;
    howToUseTitle: string;
    howToUseSteps: readonly [string, string, string];
  };
  footer: {
    docs: string;
    skills: string;
    github: string;
    license: string;
    tagline: string;
  };
};
