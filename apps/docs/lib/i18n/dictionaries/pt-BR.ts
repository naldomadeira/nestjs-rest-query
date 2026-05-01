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

export const ptBR: Dictionary = {
  meta: {
    title: 'nestjs-rest-query',
    description:
      'Query params REST declarativos com whitelist para NestJS, TypeORM e Drizzle.',
  },
  nav: {
    docs: 'Docs',
    skills: 'Skills',
    github: 'GitHub',
  },
  home: {
    hero: {
      eyebrow: 'NestJS · TypeORM · Drizzle',
      title: 'Transforme query strings REST em queries seguras.',
      subtitle:
        'nestjs-rest-query dá aos endpoints NestJS filtros dinâmicos, ordenação, paginação, seleção de campos e carregamento de relations com whitelist por endpoint para TypeORM e Drizzle.',
      ctaPrimary: 'Começar',
      ctaSecondary: 'Ler a documentação',
      previewAlt: 'nestjs-rest-query — visão geral',
    },
    beforeAfter: {
      title: 'Do encanamento manual de queries para um único decorator',
      description:
        'Cada endpoint declara os campos, sorts e operadores que aceita. A lib parseia a query string, valida contra a whitelist e executa a consulta via TypeORM ou Drizzle.',
      beforeLabel: 'Antes — escrito à mão',
      afterLabel: 'Depois — nestjs-rest-query',
      beforeCode,
      afterCode,
    },
    compatibility: {
      title: 'Compatibilidade de adapters',
      description:
        'TypeORM e Drizzle são estáveis. Prisma está no roadmap e usará os mesmos decorators e o mesmo contrato de whitelist.',
      headers: { name: 'Adapter', status: 'Status', note: 'Notas' },
      rows: [
        {
          name: 'TypeORM',
          status: 'Estável',
          note: 'Adapter padrão, construído sobre SelectQueryBuilder.',
        },
        {
          name: 'Drizzle',
          status: 'Estável',
          note: 'Ativado via DrizzleAdapter, com mapa explícito de relations.',
        },
        {
          name: 'Prisma',
          status: 'Roadmap',
          note: 'Planejado. Mesmos decorators, motor diferente.',
        },
      ],
    },
    quickstart: {
      title: 'Quickstart',
      steps: [
        {
          title: 'Instalar',
          body: 'Adicione o pacote ao seu app NestJS.',
          code: 'pnpm add nestjs-rest-query',
        },
        {
          title: 'Registrar o módulo',
          body: 'Importe o DynamicQueryBuilderModule uma vez, no AppModule.',
          code: `import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [DynamicQueryBuilderModule.forRoot()],
})
export class AppModule {}`,
        },
        {
          title: 'Declarar a whitelist',
          body: 'Cada endpoint declara quais campos, sorts e includes os clientes podem usar.',
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
    tagline: 'Uma camada de query NestJS focada em TypeORM e Drizzle.',
  },
};
