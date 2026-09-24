# nestjs-rest-query skill

Esta skill orienta a instalação, configuração, uso e troubleshooting da biblioteca [`nestjs-rest-query`](https://www.npmjs.com/package/nestjs-rest-query) em projetos NestJS com TypeORM, Drizzle ou Prisma.

## Propósito

Serve como guia operacional para criar endpoints dinâmicos com filtros, ordenação, paginação, seleção de campos, includes e busca textual — sem reinventar parsing de query string em cada projeto. Cobre as **duas linhas públicas** da biblioteca, que têm APIs incompatíveis: a skill começa detectando a versão instalada (`package.json`, lockfile e estilo de import) e segue o guia da linha certa.

## O que cobre

- Detecção da versão: `forRoot({ adapter })`/`RulesConfig` = 2.x; `defineQueryRules` + `typeormSource()`/`prismaSource()`/`drizzleSource()` = 3.x
- **3.x**: schema lógico e regras por endpoint, sources por ORM, colunas dobradas e de ordem portável, gramática da query, teto de `paginate=false`, envelope de erro, Swagger, defeitos conhecidos por versão do alpha
- **2.x**: setup com adapter no `forRoot`, `RulesConfig`, operadores, `customize`, troubleshooting
- Migração 2.x → 3.x, apontando para o `MIGRATION.md`

## Estrutura

- `SKILL.md`: detecção de versão, roteamento e a 3.x em uma página
- `references/v3/`: `setup.md`, `schema-and-rules.md`, `query-grammar.md`, `adapters.md`, `troubleshooting.md`, `migrating-from-v2.md`
- `references/v2/`: `guide.md` (o guia 2.x) e as referências de setup, operadores, regras, padrões avançados e troubleshooting da 2.x
- `evals/`: cenários de avaliação (2.x, 3.x, detecção e migração)
- `scripts/validate-setup.sh`: valida o setup do projeto consumidor e informa a linha detectada

## Instalação da skill

O GitHub não oferece download de subdiretório pela interface, então a pasta
`skills/nestjs-rest-query` não tem um botão de "baixar" na página do repo.
Use um dos três caminhos abaixo.

**Direto do repositório, sem clonar** (extrai só esta pasta do tarball do
branch):

```bash
mkdir -p ~/.claude/skills && \
  curl -fsSL https://github.com/naldomadeira/nestjs-rest-query/archive/refs/heads/main.tar.gz | \
  tar -xz --strip-components=2 -C ~/.claude/skills \
  nestjs-rest-query-main/skills/nestjs-rest-query
```

Troque `~/.claude/skills` por `.claude/skills` para instalar no escopo do
projeto.

**Pelo `.zip` publicado**, na release mais recente ou na página de skills:

- https://github.com/naldomadeira/nestjs-rest-query/releases/latest/download/nestjs-rest-query-skill.zip
- https://naldomadeira.github.io/nestjs-rest-query/skills

**Se você já tem o repo clonado**, é só copiar a pasta:

```bash
# escopo global
mkdir -p ~/.claude/skills && cp -r skills/nestjs-rest-query ~/.claude/skills/

# escopo do projeto
mkdir -p .claude/skills && cp -r skills/nestjs-rest-query .claude/skills/
```

A frontmatter de `SKILL.md` define automaticamente quando o agente deve ativá-la.
