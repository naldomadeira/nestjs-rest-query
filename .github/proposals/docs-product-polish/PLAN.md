# Docs product polish — execution plan

> Plano para executar a análise do Codex (frontend-design + ui-ux-pro-max) sobre `apps/docs/`.

## TL;DR

A docs builda e funciona, mas hoje parece **template funcional**, não **produto maduro**. O caminho dividido em 4 fases por **impacto vs esforço**, com cada tarefa atribuída ao modelo certo (Opus para julgamento editorial, Sonnet para execução com nuance, Haiku para o trivial mecânico).

**Não é trabalho de uma sentada.** Estimativa total: 3 a 5 dias se rodando os modelos em paralelo onde possível.

---

## Achados validados

Cada achado do Codex foi confirmado lendo o código antes de planejar. A tabela abaixo é o ponto de partida — não cerimônia, é o que vai ser corrigido.

| # | Achado | Arquivo(s) | Severidade |
|---|---|---|---|
| 1 | Inconsistência factual: prerequisites diz "Drizzle no roadmap", adapters diz "Drizzle estável" | `apps/docs/content/docs/getting-started/prerequisites.mdx:49-51` vs `apps/docs/content/docs/adapters/index.mdx:3-4` | **Alta** — quebra confiança |
| 2 | Idioma misturado: home em PT, nav em EN, /skills em EN, `<html lang="pt-BR">` | `apps/docs/app/(home)/page.tsx`, `apps/docs/app/(docs)/layout.tsx:30`, `apps/docs/app/(docs)/skills/page.tsx`, `apps/docs/app/layout.tsx:13` | **Alta** — projeto parece "montando" |
| 3 | Home genérica (template hero+grid+screenshot) | `apps/docs/app/(home)/page.tsx` | **Média** — sem diferenciação |
| 4 | Typo `patters-dark.png` (correto seria `patterns-dark.png`) | `apps/docs/app/(home)/page.tsx:90`, `apps/docs/public/patters-dark.png` | **Baixa** — mas detalhe |
| 5 | Assets órfãos: `patterns-old.png`, `patters-dark-old.png` | `apps/docs/public/` | **Baixa** |
| 6 | Headings em inglês ("Install", "Module setup") dentro de MDX em PT | `apps/docs/content/docs/adapters/drizzle.mdx:8`, `typeorm.mdx:8` | **Média** |
| 7 | Skills com mesmo peso de Docs no nav | `apps/docs/app/(docs)/layout.tsx:30-32` | **Média** — diluição de foco |
| 8 | `metadataBase` ausente (warning de build) | `apps/docs/app/layout.tsx` | **Baixa** — polimento |
| 9 | Conflito `rewrites` × `output: 'export'` (warning) | `apps/docs/next.config.ts` | **Baixa** |

---

## Decisões estratégicas (Opus, agora)

Pra evitar ambiguidade durante execução, fixo aqui antes de delegar:

### 1. Idioma canônico: **inglês**

Razões: o package está em inglês no `package.json`, README é em inglês, audiência alvo é global. Acompanha a recomendação do Codex.

### 2. Estratégia de i18n: **`/` em EN + `/pt/` em PT, sem autodetect**

Razões:
- A docs é estática (`output: 'export'`) — i18n nativa do Next não é bem suportada nesse modo (ver [Next docs](https://nextjs.org/docs/messages/export-no-i18n)).
- Fumadocs tem suporte a i18n mas o guia oficial assume middleware/roteamento por locale, o que conflita com export estático.
- Caminho profissional e simples: rotas explícitas + seletor de idioma no layout. Sem cookie, sem detecção do `Accept-Language`, sem mágica.

**Esconder o locale default ou fallback inteligente fica fora do escopo desse plano** (custo sobe muito; valor marginal).

### 3. Skills sai do nav primário

A audiência primária do site é desenvolvedor que vai **usar a lib**. Skills é recurso secundário (pra agentes). Vai pra um link discreto no footer ou seção dentro de `/docs`.

### 4. Posicionamento do produto: **TypeORM + Drizzle estáveis, Prisma roadmap**

Reflete o estado real do código (`src/infra/adapters/`). Toda menção a "exclusivo TypeORM" some.

### 5. Voz editorial

- Tom: técnico, direto, "aqui está o que faz e por quê".
- Estrutura preferida: 1 frase de tese → 2-3 frases de contexto → exemplo → próximo passo.
- Português usa as mesmas convenções, é tradução fiel — não reformulação.

---

## Plano em fases

Cada fase abre um PR separado pra revisão incremental. Fase 1 é pré-requisito das demais; Fases 2-4 podem ir em paralelo.

### Fase 1 — Correções factuais e polimento mecânico (1 PR)

**Objetivo:** zerar contradições factuais e warnings, sem mudar narrativa.

Tudo aqui é mecânico ou semi-mecânico. Detalhes em [phase-1-corrections.md](./phase-1-corrections.md).

| Tarefa | Modelo | Por quê |
|---|---|---|
| Reescrever `prerequisites.mdx` removendo "Drizzle no roadmap" | Sonnet | Precisa preservar voz e ler código pra confirmar status |
| Renomear `patters-dark.png` → `patterns-dark.png` + refs | Haiku | Find-replace puro |
| Apagar `*-old.png` órfãos | Haiku | Confirmação visual antes de deletar (Sonnet checa) |
| Adicionar `metadataBase` em `app/layout.tsx` | Haiku | Linha de config |
| Resolver `rewrites` × `output: 'export'` warning | Sonnet | Decisão: ou remover rewrites, ou tirar export. Precisa entender impacto |
| Padronizar headings de `adapters/*.mdx` (sem traduzir prosa ainda) | Sonnet | Pequena reescrita coerente |

**Critério de aceite:**
- `pnpm build` zero warnings.
- Nenhuma página afirma que Drizzle está no roadmap.
- Nenhum asset com nome errado, nenhum órfão.

**Estimativa:** meio dia.

### Fase 2 — Home reposicionada (1 PR)

**Objetivo:** transformar home de "template" em "produto".

Detalhes em [phase-2-home.md](./phase-2-home.md).

| Tarefa | Modelo | Por quê |
|---|---|---|
| Definir tese e estrutura da home (5 seções, em ordem) | **Opus** | Decisão de positioning, não delegável |
| Escrever copy de hero, before/after, prova, quickstart | **Opus** | Voz editorial, tom |
| Implementar componentes da nova home seguindo a copy | Sonnet | Implementação direta com spec |
| Otimizar screenshots / criar before-after visual se viável | Sonnet | Avaliar viabilidade; se complexo, voltar pra Opus |

**Critério de aceite:**
- Home responde nos primeiros 5 segundos: o que é, por que existe, como instala.
- Há um trecho "before/after" mostrando o boilerplate que a lib remove.
- Quickstart escaneável em ≤ 30 linhas.
- Compatibilidade visível na home (TypeORM/Drizzle/Node).

**Estimativa:** 1 dia.

### Fase 3 — Nav restructure + Skills demovido (1 PR pequeno)

**Objetivo:** focar nav primário em audiência principal.

Detalhes em [phase-3-nav.md](./phase-3-nav.md).

| Tarefa | Modelo | Por quê |
|---|---|---|
| Decidir formato exato de nav (Docs / GitHub apenas? Skills no footer?) | **Opus** | Hierarquia de informação |
| Implementar mudança em `app/(docs)/layout.tsx` | Sonnet | Edit pequeno |
| Criar/ajustar entrada de Skills (footer ou seção dentro de docs) | Sonnet | Implementação |
| Atualizar redirects/links internos pra Skills se mudar URL | Haiku | Find-replace |

**Critério de aceite:**
- Nav primário foca audiência da lib.
- Skills continua descobrível mas não compete com Docs.
- Sem links quebrados.

**Estimativa:** 2 horas.

### Fase 4 — i18n EN-default + /pt/ (1 PR maior)

**Objetivo:** inglês como default, PT acessível via `/pt/...` com switcher explícito.

Detalhes em [phase-4-i18n.md](./phase-4-i18n.md).

| Tarefa | Modelo | Por quê |
|---|---|---|
| Decisão final de estratégia de roteamento e fallback | **Opus** | Validar custo; eventualmente ajustar |
| Style guide bilíngue (terminologia técnica, glossário) | **Opus** | Decisão editorial |
| `<html lang>` dinâmico + metadata `hreflang` / `canonical` | Sonnet | Implementação seguindo spec |
| Mover conteúdo PT pra `content/docs/pt/` (mirror) | Sonnet | Reorganização estrutural |
| Traduzir cada MDX existente PT→EN como conteúdo padrão | Sonnet | Tradução com voz |
| Externalizar strings hard-coded do layout/home/skills | Sonnet | Refactor com config |
| Componente `LanguageSwitcher` (UI + roteamento) | Sonnet | Componente novo |
| Atualizar `lib/source.ts` pra entregar tree por locale | Sonnet | Conhecer Fumadocs |
| Verificar SEO: sitemap, hreflang em todas as páginas | Haiku | Geração mecânica |
| Smoke test de todos os links em ambos locales | Haiku | Crawl simples |

**Critério de aceite:**
- `/` mostra inglês.
- `/pt/getting-started/prerequisites` funciona e mostra PT.
- Toggle de idioma visível em todas as páginas.
- `<html lang>` correto por rota.
- `hreflang` e `canonical` corretos.
- Build estático ainda passa.

**Estimativa:** 2 a 3 dias.

---

## Divisão por modelo — visão geral

| Modelo | Quando | Por quê |
|---|---|---|
| **Opus** | Decisões editoriais, narrativa, hierarquia, estratégia de i18n | Trabalho que exige holismo: ver código + produto + audiência. Caro, mas é onde valor incremental aparece |
| **Sonnet** | Tradução fiel, refactor de componentes, novas páginas com spec | Boa relação custo-julgamento. Sabe ler código existente e seguir guia editorial sem desvios graves |
| **Haiku** | Find-replace, renomeações, geração de boilerplate, smoke tests | Mecânico, repetitivo, com critério de aceite binário |

**Regra de bolso ao executar:** se a tarefa requer ler 3+ arquivos pra decidir o output, é Opus ou Sonnet. Se requer 1 arquivo e a saída é determinística, é Haiku.

---

## O que NÃO entra

Pra fechar escopo:

- **Refazer identidade visual** (fontes, paleta, branding). É outro projeto.
- **i18n com autodetect ou esconder o locale default.** Codex avisou que custa muito; valor marginal.
- **Adicionar terceiro idioma** (espanhol, etc.). Avaliar depois de PT estável.
- **Refatorar arquitetura do Fumadocs** (custom layouts, theme override). Fora do escopo de "polimento".
- **Conteúdo novo** (tutoriais, blog posts). Estamos polindo o que existe, não expandindo.

---

## Próximos passos imediatos

1. Você revisa esse plano (este PR).
2. Aprovado, eu (Opus) abro PR da **Fase 1** — vai usar Sonnet/Haiku pelo `Agent` tool.
3. Mergeia Fase 1, abre Fase 2 (Opus escreve copy, Sonnet implementa).
4. Fases 3 e 4 em paralelo se quiser ritmo.

Cada fase tem seu próprio PR pra reduzir batch size de revisão e isolar reverts caso algo dê errado.
