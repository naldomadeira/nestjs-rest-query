# Docs product polish — execution plan

> Plano para executar a análise do Codex (frontend-design + ui-ux-pro-max) sobre `apps/docs/`. Reorganizado após segunda passada do Codex (ver `Revision history` no final).

## TL;DR

A docs builda e funciona, mas hoje parece **template funcional**, não **produto maduro**. Em vez de tratar i18n como "última fase", invertemos para **dictionary-first**: a base de internacionalização entra no PR #1 (zero UX shift), depois traduzimos e viramos default em EN, e só então mexemos em conteúdo, home, nav e SEO. Cada step é um PR isolado com risco contido.

Estimativa total: 4 a 6 dias rodando em paralelo onde possível.

---

## Achados validados

Cada achado do Codex foi confirmado lendo o código antes de planejar.

| # | Achado | Arquivo(s) | Severidade |
|---|---|---|---|
| 1 | Inconsistência factual: prerequisites diz "Drizzle no roadmap", adapters diz "Drizzle estável" | `apps/docs/content/docs/getting-started/prerequisites.mdx:49-51` vs `apps/docs/content/docs/adapters/index.mdx:3-4` | **Alta** |
| 2 | Idioma misturado: home em PT, nav em EN, /skills em EN, `<html lang="pt-BR">` | `apps/docs/app/(home)/page.tsx`, `apps/docs/app/(docs)/layout.tsx:30`, `apps/docs/app/(docs)/skills/page.tsx`, `apps/docs/app/layout.tsx:13` | **Alta** |
| 3 | Home genérica (template hero+grid+screenshot) | `apps/docs/app/(home)/page.tsx` | **Média** |
| 4 | Typo `patters-dark.png` (correto seria `patterns-dark.png`) | `apps/docs/app/(home)/page.tsx:90`, `apps/docs/public/patters-dark.png` | **Baixa** |
| 5 | Assets órfãos: `patterns-old.png`, `patters-dark-old.png` | `apps/docs/public/` | **Baixa** |
| 6 | Headings em inglês ("Install", "Module setup") dentro de MDX em PT | `apps/docs/content/docs/adapters/drizzle.mdx:8`, `typeorm.mdx:8` | **Média** |
| 7 | Skills com mesmo peso de Docs no nav | `apps/docs/app/(docs)/layout.tsx:30-32` | **Média** |
| 8 | `metadataBase` ausente (warning de build) | `apps/docs/app/layout.tsx` | **Baixa** |
| 9 | Conflito `rewrites` × `output: 'export'` (warning) | `apps/docs/next.config.ts` | **Baixa** |

---

## Decisões estratégicas (Opus, fixadas agora)

### 1. Idioma canônico: **inglês — escolha consciente, sem analytics**

Não temos dados de audiência da docs. Sinais indiretos (package em EN no `package.json`, README em EN, descrição do repo em EN, skill name em EN, audiência potencial global) levam à mesma conclusão. **Aceitamos o risco** de o público real ser predominantemente PT e revisar essa call depois caso surja evidência (analytics, geo dos GitHub stars, idioma das issues). Não é dogma — é hipótese explícita.

### 2. Estratégia de i18n: **dictionary-first, `/` em EN + `/pt/docs/...` em PT, sem autodetect**

- Dicionário em `apps/docs/lib/i18n/{en,pt-BR}.ts` para strings de chrome (nav, CTAs, footer).
- Conteúdo MDX dividido em `content/docs/{en,pt-BR}/`.
- Roteamento explícito: `/` → EN, `/pt/docs/...` → PT. Sem middleware.
- Switcher manual no header. Sem cookie, sem `Accept-Language`.

Razões:
- A docs usa `output: 'export'` (estática) e [Next docs avisa](https://nextjs.org/docs/messages/export-no-i18n) que i18n nativa do Next não funciona em export.
- Pasta-por-locale é mais simples que middleware para site estático.
- Esconder locale default ou autodetect inflam custo sem valor — fora do escopo.

### 3. Skills: **apêndice técnico, não produto público de primeira linha**

Skills serve agentes de IA. Agente lê `SKILL.md` independente do nav. Decisão:
- Sai do nav primário (vira link no footer + item dentro de `/docs`).
- **Não recebe tradução PT-BR no escopo desse plano.** Continua só em EN.
- O conteúdo da skill em `skills/nestjs-rest-query/` (que está em PT hoje) **não é tocado** — é artefato separado, atualizado quando o usuário decidir.

Resolve a tensão que o Codex apontou: ou é produto e merece tradução, ou é apêndice e fica de fora. Escolhemos apêndice.

### 4. Posicionamento do produto: **TypeORM + Drizzle estáveis, Prisma roadmap**

Reflete o estado real do código.

### 5. Voz editorial

- Tom: técnico, direto. "Aqui está o que faz e por quê".
- Estrutura preferida: 1 frase de tese → 2-3 frases de contexto → exemplo → próximo passo.
- PT é tradução fiel do EN, não reformulação.

### 6. Slug em inglês também no PT (`/pt/docs/getting-started/...`)

Consciente: facilita manutenção (espelho 1:1), URLs estáveis se trocar idioma, menor superfície de bugs de roteamento. Custo de UX é marginal — desenvolvedor brasileiro lê `/getting-started/` sem fricção.

---

## Sequência de PRs

Cada PR é mergeavel independentemente. Ordem importa: cada PR pressupõe os anteriores.

| # | PR | Owner principal | Estimativa | Risco UX |
|---|---|---|---|---|
| 1 | [step-1-i18n-shell.md](./step-1-i18n-shell.md) — base de i18n (sem flip de default) | Sonnet (Opus revisa) | 0.5-1 dia | Zero (refactor invisível) |
| 2 | [step-2-translation.md](./step-2-translation.md) — traduzir + virar default EN | Opus + Sonnet | 1.5-2 dias | Alto (default muda) |
| 3 | [step-3-factual-corrections.md](./step-3-factual-corrections.md) — fixes de Drizzle/asset/metadataBase em ambos locales | Sonnet + Haiku | 0.5 dia | Baixo |
| 4 | [step-4-home.md](./step-4-home.md) — home reposicionada em ambos locales, com exemplos reais | Opus + Sonnet | 1 dia | Médio |
| 5 | [step-5-nav.md](./step-5-nav.md) — Skills demovido pra footer + sidebar em /docs | Opus + Sonnet | 0.5 dia | Médio |
| 6 | [step-6-seo-search.md](./step-6-seo-search.md) — hreflang, sitemap, Fumadocs search bilíngue | Sonnet + Haiku | 0.5-1 dia | Baixo |

ADR à parte (pode entrar em qualquer momento, não bloqueia steps):

- [ADR-001-rewrites-vs-export.md](./ADR-001-rewrites-vs-export.md) — decidir se mantemos `output: 'export'` (e sumimos com os rewrites) ou migramos para SSR/ISR.

---

## Divisão por modelo — visão geral

| Modelo | Quando | Por quê |
|---|---|---|
| **Opus** | Decisões editoriais, narrativa, hierarquia, glossário bilíngue, copy de hero, OG concept, revisão de tradução por amostragem | Trabalho que exige holismo: ver código + produto + audiência |
| **Sonnet** | Refactor de componentes, novas páginas com spec, tradução fiel sob glossário, language switcher, dictionary scaffolding | Boa relação custo-julgamento para execução com nuance |
| **Haiku** | Find-replace, renomeações, rotas duplicadas, hreflang, sitemap, smoke tests, link checking | Mecânico com critério de aceite binário |

**Regra de bolso:** se a tarefa exige ler 3+ arquivos pra decidir o output, é Opus ou Sonnet. Se exige 1 arquivo e a saída é determinística, é Haiku.

---

## O que NÃO entra

- **Refazer identidade visual** (fontes, paleta, branding).
- **i18n com autodetect ou esconder locale default.**
- **Adicionar terceiro idioma.**
- **Refatorar arquitetura do Fumadocs** (custom layouts, theme override).
- **Tradução do README ou da skill** — são produtos separados; o usuário decide quando.

---

## Critérios de validação cross-step

Pra evitar regressões silenciosas, cada PR de step ≥ 2 deve checar:

- `pnpm --filter docs build` zero warnings.
- `curl -I` em todos os links do sitemap retornando 2xx em ambos locales (smoke).
- Lighthouse Performance ≥ 90 em mobile na home de ambos locales.
- Search Fumadocs continua funcionando (testar com pelo menos 2 termos por locale).

---

## Revision history

- **v1** — plano original em 4 fases (Fase 4 = i18n no fim).
- **v2** (este) — após segunda passada do Codex no PR #22:
  - Sequência reorganizada para dictionary-first (i18n shell antes de tudo).
  - Phase 4 quebrada em 3 steps independentes (shell → tradução → SEO/search).
  - Item 1.5 (rewrites×export) extraído para ADR-001.
  - Before/after da home agora aponta para `apps/02-app-with-postgres` (real, não fictício).
  - Ownership de OG image e CTA metadata reatribuído para Opus definir conceito + Sonnet executar.
  - EN-default explicitamente documentado como "escolha consciente, risco aceito" — não mais "óbvio".
  - Skills decidido como apêndice técnico — fica em EN apenas, fora do nav primário.
  - URL contract `/pt/docs/...` (não `/pt/...`) consistente em todos os arquivos.
