import type { Dictionary } from '../dictionary-shape';

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
      subtitle:
        'Filtros, paginação e ordenação dinâmicos a partir de parâmetros HTTP. Para TypeORM e Drizzle, em NestJS — com whitelist de segurança por endpoint.',
      ctaPrimary: 'Começar',
      ctaSecondary: 'Documentação',
      previewAlt: 'nestjs-rest-query — visão geral',
    },
    features: [
      {
        title: 'Filtros dinâmicos',
        description:
          'Filtre por qualquer campo permitido com operadores como eq, like, in, between e isNull.',
      },
      {
        title: 'Ordenação multi-coluna',
        description:
          'Ordene por múltiplos campos com ASC/DESC, controlado por endpoint.',
      },
      {
        title: 'Paginação automática',
        description:
          'Paginação baseada em página ou limit/offset com metadados completos na resposta.',
      },
      {
        title: 'Seleção de campos',
        description:
          'Retorne apenas as colunas que o cliente precisa, reduzindo o payload.',
      },
      {
        title: 'Carregamento de relações',
        description:
          'Carregue relações declaradas na whitelist do endpoint, em TypeORM ou Drizzle.',
      },
      {
        title: 'Whitelist de segurança',
        description:
          'Cada endpoint declara exatamente quais campos e operadores são permitidos.',
      },
    ],
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
};
