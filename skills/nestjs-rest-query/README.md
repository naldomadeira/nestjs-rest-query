# NestJS Dynamic Query Builder Skill

Esta skill orienta a instalação, configuração, uso e troubleshooting da biblioteca `@multitechbr/nestjs-dynamic-query-builder` em projetos NestJS com TypeORM.

## Propósito

Ela serve como guia operacional para criar endpoints dinâmicos com filtros, ordenação, paginação, seleção de campos, includes e busca textual opcional com `search`.

## O que cobre

- Setup do módulo e configurações obrigatórias no `main.ts`
- Uso de `@ApiDynamicQuery`, `@DynamicQuery` e `@QueryRules`
- Definição segura de `RulesConfig`
- Busca nativa opcional com `search`, inclusive aninhada
- Diferença entre propriedades da entidade (`camelCase`) e SQL manual em `customize`
- Troubleshooting dos erros mais comuns

## Estrutura

- `SKILL.md`: guia principal
- `references/`: referências detalhadas
- `evals/`: cenários de avaliação
- `scripts/`: scripts auxiliares
