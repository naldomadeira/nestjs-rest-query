# nestjs-rest-query skill

Esta skill orienta a instalação, configuração, uso e troubleshooting da biblioteca [`nestjs-rest-query`](https://www.npmjs.com/package/nestjs-rest-query) em projetos NestJS com TypeORM ou Drizzle.

## Propósito

Serve como guia operacional para criar endpoints dinâmicos com filtros, ordenação, paginação, seleção de campos, includes e busca textual opcional — sem reinventar parsing de query string em cada projeto.

## O que cobre

- Setup do módulo e configurações obrigatórias no `main.ts`
- Registro com adapter TypeORM (default) ou Drizzle
- Uso de `@ApiDynamicQuery`, `@DynamicQuery` e `@QueryRules`
- Definição segura de `RulesConfig` (whitelist-first)
- Busca nativa opcional com `search`, inclusive aninhada
- Diferença entre propriedades da entidade (`camelCase`) e SQL manual em `customize` (TypeORM)
- Troubleshooting dos erros mais comuns

## Estrutura

- `SKILL.md`: guia principal (carregado pelo agente quando a skill é ativada)
- `references/`: referências detalhadas
  - `setup-reference.md`: pré-requisitos, bootstrap e configuração completa
  - `operators-reference.md`: os 14 operadores com exemplos e SQL gerado
  - `rules-reference.md`: estrutura do `RulesConfig` e padrões de whitelist
  - `advanced-patterns.md`: 8 padrões com `customize` (soft delete, tenant, etc.)
  - `troubleshooting.md`: erros comuns e como corrigir
- `evals/`: cenários de avaliação para a skill
- `scripts/validate-setup.sh`: script de validação automática do setup do projeto consumidor

## Instalação da skill

Baixe o `.zip` em https://naldomadeira.github.io/nestjs-rest-query/skills ou clone o diretório direto do GitHub:

```bash
# Para Claude Code (escopo global)
mkdir -p ~/.claude/skills
cp -r skills/nestjs-rest-query ~/.claude/skills/

# Para Claude Code (escopo do projeto)
mkdir -p .claude/skills
cp -r skills/nestjs-rest-query .claude/skills/
```

A frontmatter de `SKILL.md` define automaticamente quando o agente deve ativá-la.
