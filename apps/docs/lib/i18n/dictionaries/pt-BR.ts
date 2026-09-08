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

const afterCode = `// company.query.ts — declarado uma vez, fora do controller
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

export const ptBR: Dictionary = {
  meta: {
    title: 'nestjs-rest-query',
    description:
      'Query params REST declarativos com whitelist para NestJS, sobre um núcleo semântico único compartilhado pelos adapters TypeORM, Prisma e Drizzle.',
  },
  nav: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
  },
  home: {
    notice: {
      title: 'Estas páginas descrevem a v3, publicada como prerelease',
      body: 'A API 3.x mostrada aqui está no npm como 3.0.0-alpha.0, sob a tag alpha. A tag latest continua apontando para a 2.1.0, então uma instalação normal entrega a API 2.x — peça nestjs-rest-query@alpha para receber a v3. A 3.0.0 estável depende da validação deste alpha. A v3 não tem modo de compatibilidade; leia o guia de migração antes de subir.',
      linkLabel: 'Gates que faltam para a release',
    },
    hero: {
      eyebrow: 'NestJS · TypeORM · Prisma · Drizzle',
      title: 'Transforme query strings REST em queries seguras.',
      subtitle:
        'nestjs-rest-query transforma filtros, ordenação, paginação, seleção de campos, carregamento de relações e busca textual num plano de query tipado, autoriza esse plano contra uma whitelist por endpoint e deixa um adapter de ORM compilá-lo. Três adapters, um núcleo semântico, uma resposta para a mesma requisição.',
      ctaPrimary: 'Começar',
      ctaSecondary: 'Ler a documentação',
      previewAlt: 'nestjs-rest-query — visão geral',
    },
    beforeAfter: {
      title: 'Do encanamento manual de queries para duas declarações',
      description:
        'O schema diz o que o modelo é — tipos, nulabilidade, relações. As regras de endpoint dizem o que aquela rota autoriza — paths exatos, operadores por campo, projeções. As regras compiladas são a fonte única tanto da autorização em runtime quanto dos parâmetros OpenAPI gerados, então as duas não podem divergir.',
      beforeLabel: 'Antes — escrito à mão',
      afterLabel: 'Depois — nestjs-rest-query',
      beforeCode,
      afterCode,
    },
    compatibility: {
      title: 'Compatibilidade de adapters',
      description:
        'Os três adapters compilam o mesmo plano de query e são medidos pelo mesmo corpus de paridade em PostgreSQL, MySQL e SQL Server. O adapter não é configuração global — ele vem da source que você passa para execute(), e cada factory de source vive no seu próprio subpath.',
      headers: { name: 'Adapter', status: 'Status', note: 'Factory de source' },
      rows: [
        {
          name: 'TypeORM',
          status: 'Estável',
          note: 'typeormSource(repository) — de nestjs-rest-query/typeorm. Adapter de referência.',
        },
        {
          name: 'Prisma',
          status: 'Estável',
          note: 'prismaSource({ client, model, manifest }) — de nestjs-rest-query/prisma. Operadores de padrão são recusados em SQL Server e SQLite.',
        },
        {
          name: 'Drizzle',
          status: 'Estável',
          note: 'drizzleSource({ db, dialect, table, relations }) — de nestjs-rest-query/drizzle. Exige drizzle-orm 1.x; 0.45.x não é aceito.',
        },
      ],
    },
    quickstart: {
      title: 'Quickstart',
      steps: [
        {
          title: 'Instalar',
          body: 'Adicione o pacote e, depois, o único ORM que você usa. Todo peer de ORM é opcional e o entrypoint raiz não carrega nenhum deles.',
          code: `pnpm add nestjs-rest-query
pnpm add typeorm @nestjs/typeorm`,
        },
        {
          title: 'Registrar o módulo',
          body: 'Importe o DynamicQueryBuilderModule uma vez, no AppModule. Nenhum adapter entra aqui — o forRoot configura apenas política comum.',
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
          title: 'Declarar o schema e as regras',
          body: 'O schema descreve o modelo; as regras descrevem o que aquele endpoint autoriza. A whitelist é exata — autorizar company não autoriza company.name.',
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
      cta: 'Ler os pré-requisitos',
    },
  },
  skills: {
    badge: 'Para agentes de IA',
    title: 'Skills',
    description:
      'Pacotes de capacidade prontos que ensinam agentes de IA (Claude Code, Cursor, Copilot) a instalar, configurar e diagnosticar problemas com nestjs-rest-query. Baixe o zip e siga as instruções do seu agente para adicionar skills, ou explore o código no GitHub.',
    empty: 'Nenhuma skill disponível ainda.',
    download: 'Baixar .zip',
    viewOnGitHub: 'Ver no GitHub',
    howToUseTitle: 'Como usar uma skill',
    howToUseSteps: [
      'Baixe o .zip da skill desejada.',
      'Descompacte na pasta que seu agente lê (Claude Code: ~/.claude/skills/ ou .claude/skills/ no seu projeto).',
      'O SKILL.md da skill descreve quando o agente deve ativá-la — nenhuma configuração adicional é necessária.',
    ],
  },
  footer: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
    license: 'Licença MIT',
    tagline:
      'Uma camada de query NestJS com um núcleo semântico único para TypeORM, Prisma e Drizzle.',
  },
};
