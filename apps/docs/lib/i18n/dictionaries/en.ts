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

const afterCode = `// company.query.ts — declared once, outside the controller
export const companyRules = defineQueryRules(COMPANY_SCHEMAS, 'company', {
  filters: [
    { path: 'name', operators: ['eq', 'ilike'] },
    { path: 'cnpj', operators: ['eq', 'in'] },
    { path: 'createdAt', operators: ['gte', 'lt', 'between'] },
  ],
  sorts: ['name', 'createdAt'],
  fields: {
    root: {
      allowed: ['id', 'name', 'cnpj', 'createdAt'],
      default: ['id', 'name', 'cnpj', 'createdAt'],
    },
  },
});

// company.controller.ts
@Get()
@ApiDynamicQuery(companyRules)
findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: CompiledQueryRules,
) {
  return this.qb.execute(typeormSource(this.companies), query, rules);
}`;

export const en: Dictionary = {
  meta: {
    title: 'nestjs-rest-query',
    description:
      'Declarative, whitelist-first REST query params for NestJS, with one semantic core shared by the TypeORM, Prisma and Drizzle adapters.',
  },
  nav: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
  },
  home: {
    notice: {
      title: 'These pages describe v3, published as a prerelease',
      body: 'The 3.x API shown here is on npm as 3.0.0-alpha.0, under the alpha tag. The latest tag still points at 2.1.0, so a plain install gives you the 2.x API — ask for nestjs-rest-query@alpha to get v3. Stable 3.0.0 waits on validation of this alpha. v3 has no compatibility mode; read the migration guide before upgrading.',
      linkLabel: 'Remaining release gates',
    },
    hero: {
      eyebrow: 'NestJS · TypeORM · Prisma · Drizzle',
      title: 'Turn REST query strings into safe database queries.',
      subtitle:
        'nestjs-rest-query parses filters, sorts, pagination, field selection, relation loading and text search into a typed query plan, authorises that plan against a per-endpoint whitelist, and lets an ORM adapter compile it. Three adapters, one semantic core, one answer to the same request.',
      ctaPrimary: 'Get started',
      ctaSecondary: 'Read the docs',
      previewAlt: 'nestjs-rest-query — overview',
    },
    beforeAfter: {
      title: 'From handwritten query plumbing to two declarations',
      description:
        'A schema says what the model is — kinds, nullability, relations. Endpoint rules say what this route authorises — exact paths, operators per field, projections. The compiled rules are the single source for both runtime authorisation and the generated OpenAPI parameters, so the two cannot drift apart.',
      beforeLabel: 'Before — handwritten',
      afterLabel: 'After — nestjs-rest-query',
      beforeCode,
      afterCode,
    },
    compatibility: {
      title: 'Adapter compatibility',
      description:
        'All three adapters compile the same query plan and are measured by the same parity corpus across PostgreSQL, MySQL and SQL Server. The adapter is not a global setting — it comes from the source you hand to execute(), and each source factory lives in its own subpath.',
      headers: { name: 'Adapter', status: 'Status', note: 'Source factory' },
      rows: [
        {
          name: 'TypeORM',
          status: 'Stable',
          note: 'typeormSource(repository) — from nestjs-rest-query/typeorm. Reference adapter.',
        },
        {
          name: 'Prisma',
          status: 'Stable',
          note: 'prismaSource({ client, model, manifest }) — from nestjs-rest-query/prisma. Pattern operators are refused on SQL Server and SQLite.',
        },
        {
          name: 'Drizzle',
          status: 'Stable',
          note: 'drizzleSource({ db, dialect, table, relations }) — from nestjs-rest-query/drizzle. Requires drizzle-orm 1.x; 0.45.x is not accepted.',
        },
      ],
    },
    quickstart: {
      title: 'Quickstart',
      steps: [
        {
          title: 'Install',
          body: 'Add the package, then the one ORM you use. Every ORM peer is optional and the root entrypoint loads none of them.',
          code: `pnpm add nestjs-rest-query
pnpm add typeorm @nestjs/typeorm`,
        },
        {
          title: 'Register the module',
          body: 'Import DynamicQueryBuilderModule once, in your AppModule. No adapter goes here — forRoot configures common policy only.',
          code: `import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      pagination: { defaultPerPage: 10, maxPerPage: 100 },
    }),
  ],
})
export class AppModule {}`,
        },
        {
          title: 'Declare the schema and the rules',
          body: 'The schema describes the model; the rules describe what this endpoint authorises. The whitelist is exact — authorising company does not authorise company.name.',
          code: `export const companyRules = defineQueryRules(
  COMPANY_SCHEMAS,
  'company',
  {
    filters: [{ path: 'name', operators: ['eq', 'ilike'] }],
    sorts: ['name', 'createdAt'],
    fields: {
      root: { allowed: ['id', 'name'], default: ['id', 'name'] },
    },
  },
);`,
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
    tagline:
      'A NestJS query layer with one semantic core for TypeORM, Prisma and Drizzle.',
  },
};
