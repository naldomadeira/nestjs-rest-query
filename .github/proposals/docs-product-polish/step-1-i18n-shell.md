# Step 1 — i18n shell (zero UX shift)

> **Owner:** Sonnet executa, Opus revisa.
> **Estimativa:** 0.5-1 dia.
> **Risco UX:** Zero — é refactor invisível. Default segue PT, sem switcher visível.

## Objetivo

Plumbing puro. Externalizar todas as strings hard-coded de chrome (nav, layout, home, /skills) em dicionários `en.ts` e `pt-BR.ts`, com default `pt-BR`. **Nenhuma mudança visual.** O PR seguinte (step-2) é que vira o default e expõe o switcher.

## Branch sugerida

`docs/step-1-i18n-shell`

## Tarefas

### 1.1 Criar dicionários de chrome (Sonnet)

Arquivos novos:

- `apps/docs/lib/i18n/types.ts` — tipo `Locale = 'en' | 'pt-BR'`, default `pt-BR`.
- `apps/docs/lib/i18n/dictionaries/en.ts` — dicionário em inglês.
- `apps/docs/lib/i18n/dictionaries/pt-BR.ts` — dicionário em português.
- `apps/docs/lib/i18n/index.ts` — exporta `getDictionary(locale)`, `defaultLocale`, `locales`.

Estrutura inicial do dicionário (Opus pode revisar e ajustar chaves antes do Sonnet começar):

```ts
{
  nav: {
    docs: 'Docs' | 'Docs',
    skills: 'Skills' | 'Skills',
    github: 'GitHub' | 'GitHub',
  },
  home: {
    hero: { title, subtitle, ctaPrimary, ctaSecondary },
    features: { /* títulos das 6 features */ },
  },
  skills: {
    pageTitle, pageSubtitle, downloadLabel, githubLabel,
    howToUseTitle, howToUseSteps: [string, string, string],
  },
  footer: { /* a definir conforme step-5 */ },
}
```

Cobre só strings de chrome. Conteúdo MDX **não** entra aqui.

### 1.2 Refatorar componentes pra ler do dicionário (Sonnet)

Arquivos a tocar:

- `apps/docs/app/(docs)/layout.tsx` — `navLinks`, alt de imagens.
- `apps/docs/app/(home)/page.tsx` — hero, CTAs, features grid, alts.
- `apps/docs/app/(docs)/skills/page.tsx` — toda a chrome (titulo, subtitulo, labels).
- `apps/docs/app/layout.tsx` — `metadata.title`, `metadata.description`.

Cada componente vira:

```tsx
import { getDictionary } from '@/lib/i18n';
import { defaultLocale } from '@/lib/i18n/types';

const t = getDictionary(defaultLocale);
// ...usa t.nav.docs, t.home.hero.title etc.
```

**Importante:** como `defaultLocale` ainda é `pt-BR`, o output renderizado é idêntico ao atual. Smoke visual: comparar screenshots antes/depois — devem bater.

### 1.3 `<html lang>` lê de `defaultLocale` (Sonnet)

`apps/docs/app/layout.tsx:13`: hoje é `<html lang="pt-BR">` hardcoded. Vira:

```tsx
import { defaultLocale } from '@/lib/i18n/types';
<html lang={defaultLocale}>
```

Por enquanto resolve pra `pt-BR` em build. No step-2 vira dinâmico.

### 1.4 Validar com Fumadocs (Opus)

Antes de Sonnet começar, Opus confirma:

- Fumadocs aceita conviver com nosso dicionário paralelo (não sobrepõe seus próprios mecanismos de i18n).
- Não há conflito com `lib/source.ts` ou `source.config.ts`.

Se aparecer fricção, Opus reavalia se vale usar [Fumadocs i18n nativo](https://www.fumadocs.dev/docs/internationalization) com export estático. Documentar a decisão.

## Critério de aceite

- `pnpm --filter docs build` zero warnings (modulo os pré-existentes que serão tratados em step-3).
- `pnpm --filter docs dev` renderiza identicamente à versão pré-PR (smoke visual).
- Nenhuma string em PT hard-coded restante em `app/(docs)/layout.tsx`, `app/(home)/page.tsx`, `app/(docs)/skills/page.tsx`, `app/layout.tsx`.
- Diff principal: novos arquivos em `lib/i18n/` + edits cirúrgicos em 4 components.
- Tipagem do dicionário garante que `t.nav.docs` é `string` (não `unknown`).

## Não escopo

- Mover MDX para `content/docs/{en,pt-BR}/` — fica para step-2.
- LanguageSwitcher visível — fica para step-2.
- Tradução de conteúdo MDX — fica para step-2.
- Rotas `/pt/...` — fica para step-2.
- SEO/hreflang — fica para step-6.

## Tarefas mecânicas (Haiku, opcional)

Se Sonnet preferir delegar:

- Inventariar todas as strings PT hard-coded com `grep -rn "PT regex" apps/docs/app/`.
- Gerar lista CSV (arquivo, linha, string) para Sonnet usar como to-do.
