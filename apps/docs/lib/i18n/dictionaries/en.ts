import type { Dictionary } from '../dictionary-shape';

export const en: Dictionary = {
  meta: {
    title: 'nestjs-rest-query',
    description:
      'Declarative, whitelist-first REST query params for NestJS, TypeORM and Drizzle.',
  },
  nav: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
  },
  home: {
    hero: {
      subtitle:
        'Dynamic filters, sorting, and pagination from HTTP query parameters. For TypeORM and Drizzle, in NestJS — with a per-endpoint security whitelist.',
      ctaPrimary: 'Get started',
      ctaSecondary: 'Documentation',
      previewAlt: 'nestjs-rest-query — overview',
    },
    features: [
      {
        title: 'Dynamic filters',
        description:
          'Filter on any allowed field with operators like eq, like, in, between, and isNull.',
      },
      {
        title: 'Multi-column sorting',
        description:
          'Sort by multiple fields with ASC/DESC, controlled per endpoint.',
      },
      {
        title: 'Automatic pagination',
        description:
          'Page-based or limit/offset pagination with full metadata in the response.',
      },
      {
        title: 'Field selection',
        description:
          'Return only the columns the client needs, reducing payload size.',
      },
      {
        title: 'Relation loading',
        description:
          'Load whitelisted relations on demand, in TypeORM or Drizzle.',
      },
      {
        title: 'Security whitelist',
        description:
          'Each endpoint declares exactly which fields and operators are allowed.',
      },
    ],
  },
  skills: {
    badge: 'For AI coding agents',
    title: 'Skills',
    description:
      "Drop-in capability bundles that teach AI coding agents (Claude Code, Cursor, Copilot) how to install, configure, and troubleshoot nestjs-rest-query. Download the zip and follow your agent's instructions for adding skills, or browse the source on GitHub.",
    empty: 'No skills available yet.',
    download: 'Download .zip',
    viewOnGitHub: 'View on GitHub',
    howToUseTitle: 'How to use a skill',
    howToUseSteps: [
      'Download the .zip for the skill you want.',
      'Unzip it into the location your agent reads from (Claude Code: ~/.claude/skills/ or .claude/skills/ in your project).',
      "The skill's SKILL.md describes when the agent should activate it — no further configuration needed.",
    ],
  },
};
