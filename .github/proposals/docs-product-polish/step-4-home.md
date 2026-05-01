# Step 4 — Home reposicionada

> **Owner:** Opus (copy + estrutura + OG conceito), Sonnet (implementação), Haiku (Lighthouse).
> **Estimativa:** 1 dia.
> **Risco UX:** Médio — mudança visual significativa.

## Objetivo

Transformar home de "template Fumadocs default" em "produto". Aplicar nos dois locales (já existindo após step-2). Audiência: backend dev avaliando se vale adotar a lib em ≤ 60s de leitura.

## Pré-requisito

Step-3 mergeado (factual já correto antes de virar copy).

## Branch sugerida

`docs/step-4-home`

## Estrutura proposta da home (5 seções)

### Seção 1 — Hero com tese forte

Hoje:
> "Filtros, paginação e ordenação dinâmicos a partir de parâmetros HTTP. TypeORM-first..."

Vira (texto final é decisão de Opus durante execução):

EN:
> "Stop writing the same WHERE clauses. nestjs-rest-query turns REST query strings into safe, whitelisted database queries — for TypeORM and Drizzle, in NestJS."

PT-BR (tradução fiel):
> "Pare de escrever os mesmos `WHERE`. nestjs-rest-query transforma query strings REST em queries seguras, com whitelist — para TypeORM e Drizzle, em NestJS."

CTAs: "Get started" / "View on GitHub" (no PT: "Começar" / "Ver no GitHub").

### Seção 2 — Before/After com exemplo **real** do repo

Crítica do Codex foi acertada: código fictício no marketing pode prometer redução de boilerplate que não bate com a API real.

**Fonte real:** `apps/02-app-with-postgres/src/users/users.controller.ts` e service correspondente. Antes/depois extraídos de:

- "ANTES" — endpoint similar **manual** (escrito como contraste, vivendo num gist ou comentário no app de exemplo). Opus escreve uma versão crua que reflete o que um dev escreveria sem a lib, validando que reproduz o resultado equivalente.
- "DEPOIS" — copia literal do código que existe em `apps/02`.

Procedimento:
1. Opus lê `apps/02-app-with-postgres/src/**/*.controller.ts` e `*.service.ts`.
2. Escolhe **um** endpoint suficientemente rico (filtro + sort + include + paginação).
3. Reescreve a versão "manual" do mesmo endpoint sem a lib (`@nestjs/typeorm` cru).
4. Valida que ambas as versões produzem a mesma query SQL pra um caso de uso comum.
5. Documenta a equivalência num comentário do código de exemplo.

Layout: dois `<CodeBlock>` lado a lado em desktop, empilhados em mobile. Highlight no bloco "depois" mostrando o ponto onde o whitelist é declarado.

### Seção 3 — Compatibilidade (matriz visual)

| ORM     | Status         |
|---------|----------------|
| TypeORM | ✅ Stable       |
| Drizzle | ✅ Stable       |
| Prisma  | 🚧 Coming soon  |

| Runtime | Versão |
|---------|--------|
| NestJS  | ^11    |
| Node    | ≥ 20   |

**Nada de "TypeORM-first" ou "exclusivo TypeORM".** Espelha o README e step-3.

### Seção 4 — Quickstart escaneável (≤ 30 linhas em 3 blocos)

1. `pnpm add nestjs-rest-query`
2. Bootstrap em `main.ts` (3 linhas críticas: query parser, ValidationPipe).
3. Decorator + service (snippet curto).

Cada bloco com 1 frase de contexto. Sem prosa longa.

### Seção 5 — Próximo passo + prova social

- Link grande "Read the docs →"
- Badges: npm version, downloads.
- "Used in production by ..." — **só se houver case real**. Caso contrário, omitir.

## Tarefas

| # | Tarefa | Modelo | Notas |
|---|---|---|---|
| 4.1 | Ler `apps/02` e escolher endpoint para before/after | **Opus** | Decisão de positioning |
| 4.2 | Escrever versão "manual" equivalente do endpoint escolhido | **Opus** | Realista, não palha |
| 4.3 | Validar que o "depois" reproduz a mesma SQL para o caso de uso típico | **Opus** | Smoke manual |
| 4.4 | Definir copy final do hero EN + PT (3 versões mentais, escolher 1) | **Opus** | Voz |
| 4.5 | Definir layout exato e responsividade do before/after | **Opus** | UX call |
| 4.6 | Conceituar OG image (composição visual + texto) | **Opus** | Não delegável |
| 4.7 | Implementar nova `app/(home)/page.tsx` lendo do dicionário | Sonnet | Spec fechado |
| 4.8 | Implementar nova `app/pt/page.tsx` espelho | Sonnet | Mesma estrutura |
| 4.9 | Componente `<BeforeAfter>` reutilizável | Sonnet | Recebe duas strings de código + highlights |
| 4.10 | Componente `<CompatMatrix>` | Sonnet | Recebe array tipado, renderiza |
| 4.11 | Atualizar dicionário `i18n/dictionaries/{en,pt-BR}.ts` com `home.*` final | Sonnet | Após copy de Opus |
| 4.12 | Renderizar OG image (Vercel OG API ou pré-renderizar PNG) | Sonnet | Implementação seguindo conceito |
| 4.13 | Atualizar OG metadata em `app/layout.tsx` | Sonnet | Lê asset gerado |
| 4.14 | Lighthouse (mobile, ambas as homes) | Haiku | LCP, CLS, Performance ≥ 90 |
| 4.15 | Smoke `curl -I` nas duas homes | Haiku | 200 OK |

## Arquivos que vão mudar

- `apps/docs/app/(home)/page.tsx` — reescrita
- `apps/docs/app/pt/page.tsx` — nova ou reescrita
- `apps/docs/components/before-after.tsx` — novo
- `apps/docs/components/compat-matrix.tsx` — novo
- `apps/docs/lib/i18n/dictionaries/{en,pt-BR}.ts` — chaves `home.*` expandidas
- `apps/docs/public/og-home.png` — atualizada
- `apps/docs/app/layout.tsx` — `metadata.openGraph` aponta pro novo asset

## Critério de aceite

- Visitante novo na home consegue dizer em 30s o que é, por que existe, como instala.
- Bloco antes/depois usa código **real** do `apps/02-app-with-postgres`.
- Compatibilidade visível sem rolar até o fim.
- Lighthouse Performance ≥ 90 em mobile, em ambas as homes.
- Sem regressão em CLS/LCP comparado ao baseline pre-PR.
- Diff dos dicionários só adiciona/atualiza chaves `home.*` — não toca em outras chaves.

## Não escopo

- Mexer em sidebar, nav primário ou Skills — fica para step-5.
- SEO multilíngue (hreflang, sitemap) — step-6.
- Reescrever conteúdo das outras páginas (`/docs/getting-started`, etc.) — só home.
