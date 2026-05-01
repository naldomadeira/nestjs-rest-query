# Step 2 — Tradução do conteúdo + flip de default para EN

> **Owner:** Opus (glossário + revisão), Sonnet (tradução + components).
> **Estimativa:** 1.5-2 dias.
> **Risco UX:** Alto — default visível muda. Comunicar nos canais antes de mergear.

## Objetivo

A) Mover todo conteúdo MDX para `content/docs/pt-BR/` (espelho 1:1 do que existe). B) Traduzir cada MDX para EN em `content/docs/en/`. C) Adicionar rotas `/pt/docs/...`. D) `LanguageSwitcher` visível. E) Flip de `defaultLocale` para `en`. F) `<html lang>` dinâmico baseado na rota.

## Pré-requisito

Step-1 mergeado (dicionário de chrome existindo, refactor invisível concluído).

## Branch sugerida

`docs/step-2-translation`

## Tarefas

### 2.1 Glossário bilíngue (Opus, primeiro)

Antes de Sonnet começar a traduzir, Opus fixa em `lib/i18n/glossary.md` (não-código, doc para revisores):

| Termo | EN | PT-BR |
|---|---|---|
| whitelist | whitelist | whitelist (mantém) |
| filter (URL/UI) | filter | filtro |
| sort | sort | ordenação |
| field | field | campo |
| relation | relation | relação |
| decorator | decorator | decorator (mantém) |
| rule (RulesConfig) | rule | regra |
| pagination | pagination | paginação |
| query string | query string | query string (mantém) |
| query param | query parameter | parâmetro de query |
| handler | handler | handler (mantém) |
| repository | repository | repository (mantém) |
| middleware | middleware | middleware (mantém) |

**Princípio:** termos que o desenvolvedor encontra **literal no código** ficam em EN. Termos de UX traduzem.

### 2.2 Reorganização de pastas (Sonnet)

```
apps/docs/content/docs/
  index.mdx                    →  pt-BR/index.mdx
  meta.json                    →  pt-BR/meta.json
  getting-started/             →  pt-BR/getting-started/
  swagger/                     →  pt-BR/swagger/
  usage/                       →  pt-BR/usage/
  adapters/                    →  pt-BR/adapters/
  advanced/                    →  pt-BR/advanced/
  en/                          (criar, vazio inicialmente)
```

`apps/docs/lib/source.ts` precisa ser ajustado pra entregar trees por locale. Provavelmente duas chamadas separadas de `loader()` ou um filtro por path.

### 2.3 Tradução PT→EN (Sonnet, com revisão Opus por amostragem)

Cada arquivo MDX em `pt-BR/` ganha um par em `en/` com a mesma estrutura. Tradução fiel ao glossário, **não** reformulação.

Ordem sugerida (mais visível primeiro):
1. `index.mdx`
2. `getting-started/*`
3. `adapters/index.mdx` + `typeorm.mdx` + `drizzle.mdx`
4. `usage/*`
5. `swagger/*`
6. `advanced/*`

**Opus revisa amostragem (3 páginas obrigatórias antes de Sonnet continuar):**
- `index.mdx` — define o tom de toda a docs.
- `getting-started/prerequisites.mdx` — primeira leitura do dev.
- `adapters/index.mdx` — termos técnicos centrais.

Se a revisão dessas 3 mostrar drift de glossário ou tom, Sonnet **pausa** e ajusta antes de continuar.

### 2.4 Rotas `/pt/docs/...` (Sonnet)

Estrutura de rotas:

```
apps/docs/app/
  (docs)/[...slug]/page.tsx     ← lê de content/docs/en/
  pt/
    layout.tsx                   ← reusa DocsRootLayout passando locale='pt-BR'
    docs/[...slug]/page.tsx     ← lê de content/docs/pt-BR/
    skills/page.tsx              ← se decidirmos manter em PT (decisão step-5)
```

`DocsRootLayout` aceita prop `locale` e passa pro `getDictionary()`.

Seguindo decisão estratégica #6 do PLAN: slugs em **inglês também no PT**.

### 2.5 LanguageSwitcher (Sonnet)

`apps/docs/components/language-switcher.tsx`:

- Usa `usePathname()` para saber a rota atual.
- Calcula a rota espelho: se está em `/docs/foo`, switcher de PT aponta pra `/pt/docs/foo`.
- Se a rota espelho não existe (raro durante migração), aponta pra raiz do locale alvo.
- Item ativo destacado.
- Posicionado no header, ao lado do GitHub icon.

### 2.6 `<html lang>` dinâmico (Sonnet)

`app/layout.tsx` precisa saber o locale corrente. Como Next 16 com app router fornece o pathname no servidor, dá pra detectar via children/route segments. Alternativa: ter dois `<html>` — um em `app/layout.tsx` (raiz EN), outro em `app/pt/layout.tsx` (PT). Sonnet escolhe o caminho com menor surpresa.

### 2.7 Flip do default (Sonnet)

Última edição do PR:
- `lib/i18n/types.ts` → `defaultLocale = 'en'`
- Components atualmente lendo `defaultLocale` agora retornam EN
- `/` agora serve EN; `/pt/docs/...` serve PT
- `<html lang>` em `/` resolve `en`

### 2.8 Smoke completo (Haiku)

```bash
# enumerar todas as rotas, fazer curl -I, esperar 2xx
# script joga lista no stdout
node scripts/smoke-i18n.mjs   # criar este script
```

Falha o PR se algum 4xx/5xx aparecer.

## Critério de aceite

- `/` retorna HTML com `lang="en"` e conteúdo em inglês.
- `/pt/docs/getting-started/prerequisites` retorna HTML com `lang="pt-BR"` e conteúdo PT.
- Switcher presente em todas as páginas de ambos os locales.
- Switcher mantém o caminho ao trocar locale (testar em 3 rotas distintas).
- Cada MDX em PT tem espelho em EN com mesmo path/slug.
- Glossário aplicado consistentemente — Opus revisou as 3 páginas-âncora.
- `pnpm --filter docs build` zero erros.
- Smoke `curl -I` passa em todas as rotas.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Tradução robotizada / drift de tom | Opus revisa as 3 páginas-âncora **antes** de Sonnet continuar |
| Fumadocs source não suporta bem pasta-por-locale | Plan B documentado em `step-1.4`; se aparecer aqui, Opus reavalia migrar para Fumadocs i18n nativo |
| Rota espelho não existe (página em PT, não em EN) | Switcher cai para raiz do locale alvo + log silencioso pra acompanhar |
| Build estático fica lento | Aceitar — é build, não runtime |

## Não escopo

- Tradução do `/skills` page (decisão estratégica #3: Skills fica EN-only).
- Tradução do `skills/nestjs-rest-query/SKILL.md` (artefato separado, fora desse plano).
- SEO multilíngue (hreflang, sitemap) — step-6.
- Search bilíngue — step-6.
