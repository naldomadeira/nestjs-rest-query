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
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
      previewAlt: string;
    };
    features: ReadonlyArray<{
      title: string;
      description: string;
    }>;
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
};
