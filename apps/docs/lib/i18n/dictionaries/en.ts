import type { Dictionary } from '../dictionary-shape';

const beforeCode = `@Get()
async listCompanies(@Query() query: ListCompaniesQuery) {
  const qb = this.companies.createQueryBuilder('company');

  if (query.name) qb.andWhere('company.name ILIKE :n', { n: \`%\${query.name}%\` });
  if (query.cnpj) qb.andWhere('company.cnpj = :c', { c: query.cnpj });
  if (query.createdFrom) qb.andWhere('company.createdAt >= :f', { f: query.createdFrom });

  if (query.sort === 'name') qb.orderBy('company.name', query.dir ?? 'ASC');
  if (query.sort === 'createdAt') qb.orderBy('company.createdAt', query.dir ?? 'DESC');

  const page = Number(query.page ?? 1);
  const perPage = Math.min(Number(query.perPage ?? 20), 100);
  qb.skip((page - 1) * perPage).take(perPage);

  const [data, total] = await qb.getManyAndCount();
  return { data, page, perPage, total, lastPage: Math.ceil(total / perPage) };
}`;

const afterCode = `@Get()
@ApiDynamicQuery<Company>({
  filters: ['name', 'cnpj', 'createdAt'],
  sorts: ['name', 'createdAt'],
  fields: ['id', 'name', 'cnpj', 'createdAt'],
})
findAll(@Query() query: QueryInput, @QueryRules() rules: RulesConfig) {
  return this.qb.execute(this.companies, query, rules);
}`;

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
      eyebrow: 'NestJS · TypeORM · Drizzle',
      title: 'Turn REST query strings into safe database queries.',
      subtitle:
        'nestjs-rest-query gives NestJS endpoints dynamic filters, sorting, pagination, field selection, and relation loading with a per-endpoint whitelist for TypeORM and Drizzle.',
      ctaPrimary: 'Get started',
      ctaSecondary: 'Read the docs',
      previewAlt: 'nestjs-rest-query — overview',
    },
    beforeAfter: {
      title: 'From handwritten query plumbing to a single decorator',
      description:
        'Every endpoint declares the fields, sorts, and operators it accepts. The library parses the query string, validates against the whitelist, and runs the query through TypeORM or Drizzle.',
      beforeLabel: 'Before — handwritten',
      afterLabel: 'After — nestjs-rest-query',
      beforeCode,
      afterCode,
    },
    compatibility: {
      title: 'Adapter compatibility',
      description:
        'TypeORM and Drizzle are stable. Prisma is on the roadmap and will use the same decorators and whitelist contract.',
      headers: { name: 'Adapter', status: 'Status', note: 'Notes' },
      rows: [
        {
          name: 'TypeORM',
          status: 'Stable',
          note: 'Default adapter, built on SelectQueryBuilder.',
        },
        {
          name: 'Drizzle',
          status: 'Stable',
          note: 'Opt-in via DrizzleAdapter, with explicit relations map.',
        },
        {
          name: 'Prisma',
          status: 'Roadmap',
          note: 'Planned. Same decorators, swapped engine.',
        },
      ],
    },
    quickstart: {
      title: 'Quickstart',
      steps: [
        {
          title: 'Install',
          body: 'Add the package to your NestJS app.',
          code: 'pnpm add nestjs-rest-query',
        },
        {
          title: 'Register the module',
          body: 'Import DynamicQueryBuilderModule once, in your AppModule.',
          code: `import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [DynamicQueryBuilderModule.forRoot()],
})
export class AppModule {}`,
        },
        {
          title: 'Declare the whitelist',
          body: 'Each endpoint declares which fields, sorts, and includes clients may use.',
          code: `@Get()
@ApiDynamicQuery<Company>({
  filters: ['name', 'cnpj', 'createdAt'],
  sorts: ['name', 'createdAt'],
})
findAll(@Query() q: QueryInput, @QueryRules() rules: RulesConfig) {
  return this.qb.execute(this.companies, q, rules);
}`,
        },
      ],
      cta: 'Read the prerequisites',
    },
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
  footer: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
    license: 'MIT License',
    tagline: 'A focused NestJS query layer for TypeORM and Drizzle.',
  },
};
