# Update Docs Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar o polish das docs em uma unica branch/PR, corrigindo fatos, UX, i18n, navegacao, SEO e search sem seguir mais a estrategia antiga de multiplos PRs.

**Architecture:** O estado atual do repo ja tem i18n parcialmente aplicado com Fumadocs (`defineI18n`, `parser: 'dir'`, `hideLocale: 'default-locale'`) e rotas em `app/(default)` + `app/[lang]`. Este plano assume essa arquitetura como fonte de verdade, preserva `output: 'export'` e usa os steps antigos apenas como contexto historico.

**Tech Stack:** Next.js 16 app router, Fumadocs UI/Core/MDX, static export, TypeScript, Tailwind, MDX, GitHub Pages com `basePath`.

---

## Decisao Final De Execucao

Este arquivo substitui a sequencia de PRs descrita em `PLAN.md`.

- Trabalhar tudo em **uma branch nova** criada a partir da branch da PR aberta atual.
- Fechar a PR antiga depois que a nova branch estiver criada e este plano estiver versionado.
- Subir uma unica PR nova quando tudo estiver finalizado e validado.
- Nao criar PRs separados por step.
- Referenciar os steps antigos somente para recuperar contexto, nao como instrucao literal.

## Branch E PR

- Branch base: branch da PR aberta atual.
- Nova branch sugerida: `docs/product-polish-final`.
- PR antiga: fechar com comentario apontando que o trabalho foi consolidado na nova branch.
- PR nova: abrir somente apos passar build, smoke local e revisao visual.

Comandos esperados:

```bash
rtk git status --short
rtk git branch --show-current
rtk git switch -c docs/product-polish-final
```

Se a branch `docs/product-polish-final` ja existir localmente:

```bash
rtk git switch docs/product-polish-final
```

## Referencias Historicas

- `PLAN.md`: decisao editorial geral, idioma canonico EN, Skills como apendice, TypeORM + Drizzle stable.
- `step-1-i18n-shell.md`: ja esta parcialmente executado no repo atual; usar apenas para entender dicionarios.
- `step-2-translation.md`: ja esta parcialmente executado; **nao seguir paths antigos** como `app/pt`.
- `step-3-factual-corrections.md`: ainda contem correcoes factuais validas.
- `step-4-home.md`: usar como direcao de produto, mas adaptar aos arquivos atuais.
- `step-5-nav.md`: usar decisao de demover Skills, mas adaptar para `components/docs-shell.tsx`.
- `step-6-seo-search.md`: usar objetivo, mas trocar implementacao por Fumadocs i18n/search nativo.
- `ADR-001-rewrites-vs-export.md`: provavelmente obsoleto; o `next.config.ts` atual nao tem `rewrites`.

## Estado Atual Que O Plano Deve Respeitar

- Conteudo MDX ja esta em:
  - `apps/docs/content/en/docs/**`
  - `apps/docs/content/pt-BR/docs/**`
- Rotas default ja estao em:
  - `apps/docs/app/(default)/**`
- Rotas localizadas ja estao em:
  - `apps/docs/app/[lang]/**`
- Fumadocs i18n ja esta configurado em:
  - `apps/docs/lib/source.ts`
- Dicionarios ja existem em:
  - `apps/docs/lib/i18n/dictionaries/en.ts`
  - `apps/docs/lib/i18n/dictionaries/pt-BR.ts`
- `defaultLocale` atual e `en` em:
  - `apps/docs/lib/i18n/types.ts`
- Home atual usa:
  - `apps/docs/components/home-content.tsx`
  - `apps/docs/components/home-shell.tsx`
- Layout docs atual usa:
  - `apps/docs/components/docs-shell.tsx`
- `next.config.ts` atual usa `output: 'export'`, `basePath` e `assetPrefix`; nao ha `rewrites`.

## Arquivos Provavelmente Modificados

- `.github/proposals/docs-product-polish/update-docs-final-plan.md`
- `apps/docs/content/en/docs/getting-started/prerequisites.mdx`
- `apps/docs/content/pt-BR/docs/getting-started/prerequisites.mdx`
- `apps/docs/content/en/docs/adapters/*.mdx`
- `apps/docs/content/pt-BR/docs/adapters/*.mdx`
- `apps/docs/components/home-content.tsx`
- `apps/docs/components/home-shell.tsx`
- `apps/docs/components/docs-shell.tsx`
- `apps/docs/components/before-after.tsx` (novo, se a home ficar mais legivel assim)
- `apps/docs/components/compat-matrix.tsx` (novo, se a home ficar mais legivel assim)
- `apps/docs/components/site-footer.tsx` (novo, se necessario para Skills no footer)
- `apps/docs/lib/i18n/dictionary-shape.ts`
- `apps/docs/lib/i18n/dictionaries/en.ts`
- `apps/docs/lib/i18n/dictionaries/pt-BR.ts`
- `apps/docs/lib/seo.ts` (novo)
- `apps/docs/app/(default)/(docs)/[...slug]/page.tsx`
- `apps/docs/app/[lang]/(docs)/[...slug]/page.tsx`
- `apps/docs/app/(default)/(docs)/skills/page.tsx`
- `apps/docs/app/sitemap.ts` (novo)
- `apps/docs/app/robots.ts` (novo)
- `apps/docs/app/api/search/route.ts` (se search por API for compativel com static export no build atual; caso contrario, documentar alternativa)
- `apps/docs/public/patterns-dark.png` (renomeado de `patters-dark.png`)
- Remover, se realmente orfaos:
  - `apps/docs/public/patterns-old.png`
  - `apps/docs/public/patters-dark-old.png`

---

## Task 1: Congelar A Base Da Branch

**Files:**
- Modify: nenhum arquivo de app.

- [ ] **Step 1: Confirmar worktree limpo**

Run:

```bash
rtk git status --short
```

Expected: `ok` ou nenhuma alteracao nao intencional. Se houver alteracoes, identificar se sao do usuario antes de seguir.

- [ ] **Step 2: Criar branch final**

Run:

```bash
rtk git branch --show-current
rtk git switch -c docs/product-polish-final
```

Expected: branch criada a partir da branch da PR aberta atual.

- [ ] **Step 3: Registrar a decisao na PR antiga**

Fechar a PR antiga com mensagem curta:

```text
Fechando esta PR porque o polish das docs foi consolidado em uma unica branch/PR final. O plano atualizado esta em .github/proposals/docs-product-polish/update-docs-final-plan.md.
```

Se a ferramenta de GitHub nao estiver disponivel no momento da execucao, deixar essa acao como checklist manual no corpo da PR nova.

---

## Task 2: Corrigir Fatos E Conteudo Tecnico

**References:** `step-3-factual-corrections.md`, `PLAN.md`.

**Files:**
- Modify: `apps/docs/content/en/docs/getting-started/prerequisites.mdx`
- Modify: `apps/docs/content/pt-BR/docs/getting-started/prerequisites.mdx`
- Modify: `apps/docs/content/en/docs/adapters/drizzle.mdx`
- Modify: `apps/docs/content/en/docs/adapters/typeorm.mdx`
- Modify: `apps/docs/content/pt-BR/docs/adapters/drizzle.mdx`
- Modify: `apps/docs/content/pt-BR/docs/adapters/typeorm.mdx`

- [ ] **Step 1: Corrigir prerequisites EN**

Em `apps/docs/content/en/docs/getting-started/prerequisites.mdx`:

- Trocar description para mencionar TypeORM and Drizzle.
- Trocar a frase inicial para "TypeORM or Drizzle".
- Renomear `## TypeORM` para `## Supported adapters`.
- Criar subsecoes curtas `### TypeORM` e `### Drizzle`.
- Trocar callout de roadmap para Prisma apenas.
- Remover qualquer claim de suporte exclusivo TypeORM.

Texto base EN:

```mdx
description: Requirements for using nestjs-rest-query in a NestJS application with TypeORM or Drizzle.

This library was designed for NestJS applications that use TypeORM or Drizzle and have decorators enabled. If that is your scenario, the setup is usually simple.

## Supported adapters

### TypeORM

TypeORM support is stable and uses `SelectQueryBuilder` generated from your `Repository`.

### Drizzle

Drizzle support is stable and uses a configured adapter plus an explicit relations map when relations are needed.

<Callout type="info">
  **Roadmap — Prisma**

Prisma support is planned for a future version. The goal is to keep the same decorators API and whitelist-based security contract while swapping the query engine underneath.
</Callout>
```

- [ ] **Step 2: Corrigir prerequisites PT-BR**

Em `apps/docs/content/pt-BR/docs/getting-started/prerequisites.mdx` aplicar a traducao fiel:

```mdx
description: Requisitos para usar o nestjs-rest-query em uma aplicacao NestJS com TypeORM ou Drizzle.

Esta lib foi pensada para aplicacoes NestJS que usam TypeORM ou Drizzle e decorators habilitados. Se esse for o seu cenario, a configuracao costuma ser simples.

## Adapters suportados

### TypeORM

O suporte a TypeORM e estavel e usa um `SelectQueryBuilder` gerado a partir do seu `Repository`.

### Drizzle

O suporte a Drizzle e estavel e usa um adapter configurado, alem de um mapa explicito de relations quando relations forem necessarias.

<Callout type="info">
  **Roadmap — Prisma**

O suporte a Prisma esta planejado para uma versao futura. A meta e manter a mesma API de decorators e o mesmo contrato de seguranca por whitelist, trocando apenas o motor de query por baixo.
</Callout>
```

- [ ] **Step 3: Padronizar headings dos adapters**

Nos arquivos EN, manter headings em ingles:

```mdx
## Install
## Module setup
## Usage
```

Nos arquivos PT-BR, usar headings em portugues:

```mdx
## Instalacao
## Configuracao do modulo
## Uso
```

Nao traduzir nomes literais de API, imports, classes, decorators, query params ou nomes de pacote.

- [ ] **Step 4: Verificar claims antigos**

Run:

```bash
rtk rg -n -i "exclusivo.*typeorm|exclusively.*typeorm|drizzle.*roadmap|roadmap.*drizzle|support.*exclusive.*typeorm" apps/docs/content
```

Expected: nenhum resultado.

---

## Task 3: Limpar Assets E Base De Build

**References:** `step-3-factual-corrections.md`, `ADR-001-rewrites-vs-export.md`.

**Files:**
- Modify: `apps/docs/components/home-content.tsx`
- Rename: `apps/docs/public/patters-dark.png` -> `apps/docs/public/patterns-dark.png`
- Delete: `apps/docs/public/patterns-old.png`
- Delete: `apps/docs/public/patters-dark-old.png`
- Modify: `.github/proposals/docs-product-polish/ADR-001-rewrites-vs-export.md` (opcional: marcar como superado)

- [ ] **Step 1: Renomear asset typo**

Run:

```bash
rtk mv apps/docs/public/patters-dark.png apps/docs/public/patterns-dark.png
```

- [ ] **Step 2: Atualizar referencia do asset**

Em `apps/docs/components/home-content.tsx`, trocar:

```tsx
src={resolveDocsAssetPath('/patters-dark.png')}
```

por:

```tsx
src={resolveDocsAssetPath('/patterns-dark.png')}
```

- [ ] **Step 3: Confirmar assets old orfaos**

Run:

```bash
rtk rg -n "patterns-old|patters-dark-old" apps/docs
```

Expected: nenhum resultado.

- [ ] **Step 4: Remover assets old**

Run:

```bash
rtk rm apps/docs/public/patterns-old.png apps/docs/public/patters-dark-old.png
```

- [ ] **Step 5: Revalidar ADR de rewrites**

Run:

```bash
rtk rg -n "rewrites" apps/docs/next.config.ts apps/docs
```

Expected: nenhum `rewrites` em `apps/docs/next.config.ts`.

Se confirmado, atualizar `ADR-001-rewrites-vs-export.md` para status `Superado` e explicar:

```md
> **Status:** Superado.

O `next.config.ts` atual nao declara `rewrites`; portanto o warning original nao e mais uma decisao arquitetural pendente. Manter `output: 'export'`.
```

---

## Task 4: Reposicionar A Home Como Produto

**References:** `step-4-home.md`, `frontend-design`.

**Files:**
- Modify: `apps/docs/components/home-content.tsx`
- Modify: `apps/docs/components/home-shell.tsx`
- Modify: `apps/docs/lib/i18n/dictionary-shape.ts`
- Modify: `apps/docs/lib/i18n/dictionaries/en.ts`
- Modify: `apps/docs/lib/i18n/dictionaries/pt-BR.ts`
- Create: `apps/docs/components/before-after.tsx` (se necessario)
- Create: `apps/docs/components/compat-matrix.tsx` (se necessario)

- [ ] **Step 1: Confirmar exemplo real do repo**

Ler:

```bash
rtk rg -n "DynamicQuery|ApiDynamicQuery|QueryBuilder|find" apps/02-app-with-postgres/src apps/03-app-with-drizzle/src
```

Escolher um exemplo real que demonstre:

- filtro;
- sort;
- includes/relations, se houver;
- paginacao;
- whitelist por endpoint.

- [ ] **Step 2: Expandir shape do dicionario da home**

Em `dictionary-shape.ts`, trocar `home` para suportar:

```ts
home: {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    previewAlt: string;
  };
  beforeAfter: {
    title: string;
    description: string;
    beforeLabel: string;
    afterLabel: string;
    beforeCode: string;
    afterCode: string;
  };
  compatibility: {
    title: string;
    rows: ReadonlyArray<{
      name: string;
      status: string;
      note: string;
    }>;
  };
  quickstart: {
    title: string;
    steps: ReadonlyArray<{
      title: string;
      body: string;
      code: string;
    }>;
  };
};
```

- [ ] **Step 3: Atualizar copy EN**

Em `en.ts`, usar a tese:

```ts
title:
  'Turn REST query strings into safe database queries.',
subtitle:
  'nestjs-rest-query gives NestJS endpoints dynamic filters, sorting, pagination, field selection, and relation loading with a per-endpoint whitelist for TypeORM and Drizzle.',
```

Quickstart deve ter no maximo 3 blocos:

```ts
steps: [
  {
    title: 'Install',
    body: 'Add the package to your NestJS app.',
    code: 'pnpm add nestjs-rest-query',
  },
  {
    title: 'Enable query parsing',
    body: 'Keep bracketed query params intact before they reach your controller.',
    code: 'app.use(queryParser());',
  },
  {
    title: 'Declare the whitelist',
    body: 'Each endpoint declares the fields and operators clients may use.',
    code: '@DynamicQuery({ filter: { name: true }, sort: [\\'createdAt\\'] })',
  },
],
```

- [ ] **Step 4: Atualizar copy PT-BR**

Em `pt-BR.ts`, traduzir fielmente sem mudar API literal:

```ts
title:
  'Transforme query strings REST em queries seguras.',
subtitle:
  'nestjs-rest-query da aos endpoints NestJS filtros dinamicos, ordenacao, paginacao, selecao de campos e carregamento de relations com whitelist por endpoint para TypeORM e Drizzle.',
```

- [ ] **Step 5: Implementar layout da home**

Em `home-content.tsx`, substituir a home generica por:

- hero direto, sem card decorativo;
- before/after com codigo real;
- matriz de compatibilidade visivel cedo;
- quickstart escaneavel;
- CTA final para `/docs/getting-started/prerequisites`.

Regras visuais:

- Nao usar hero de marketing vazio.
- Nao depender de uma paleta de uma unica cor.
- Nao usar cards dentro de cards.
- Garantir que texto nao estoure em mobile.
- Usar botoes com affordance clara; se houver icones, preferir `lucide-react`.

- [ ] **Step 6: Smoke visual local**

Run:

```bash
rtk pnpm --filter docs dev
```

Abrir:

- `http://localhost:9001/`
- `http://localhost:9001/pt-BR/`

Expected:

- home EN e PT renderizam;
- layout mobile nao quebra;
- CTAs apontam para rotas existentes.

---

## Task 5: Reestruturar Nav, Skills E Footer

**References:** `step-5-nav.md`.

**Files:**
- Modify: `apps/docs/components/docs-shell.tsx`
- Modify: `apps/docs/components/home-shell.tsx`
- Modify: `apps/docs/lib/i18n/dictionary-shape.ts`
- Modify: `apps/docs/lib/i18n/dictionaries/en.ts`
- Modify: `apps/docs/lib/i18n/dictionaries/pt-BR.ts`
- Modify: `apps/docs/content/en/docs/meta.json`
- Modify: `apps/docs/content/pt-BR/docs/meta.json`
- Create: `apps/docs/content/en/docs/skills.mdx`
- Create: `apps/docs/content/pt-BR/docs/skills.mdx`
- Create: `apps/docs/components/site-footer.tsx` (se o layout atual nao tiver footer adequado)

- [ ] **Step 1: Remover Skills do nav primario**

Em `docs-shell.tsx`, trocar:

```tsx
const navLinks = [
  { text: t.nav.docs, url: `${prefix}/docs` },
  { text: t.nav.skills, url: '/skills' },
  // GitHub...
];
```

por:

```tsx
const navLinks = [
  { text: t.nav.docs, url: `${prefix}/docs` },
  // GitHub...
];
```

Aplicar a mesma ideia em `home-shell.tsx` se Skills aparecer ali.

- [ ] **Step 2: Adicionar bridge Skills no sidebar EN**

Em `apps/docs/content/en/docs/meta.json`, adicionar `skills` no final:

```json
{
  "pages": [
    "index",
    "getting-started",
    "swagger",
    "usage",
    "adapters",
    "advanced",
    "skills"
  ]
}
```

Criar `apps/docs/content/en/docs/skills.mdx`:

```mdx
---
title: AI Agent Skills
description: Capability bundles for AI coding agents that work with nestjs-rest-query.
---

The public library documentation is the source of truth for developers. Skills are a companion artifact for AI coding agents that need installation, configuration, and troubleshooting guidance.

<Card title="Open Skills" href="/skills">
  Browse the generated skills page and download the bundle for your agent.
</Card>
```

- [ ] **Step 3: Adicionar bridge Skills no sidebar PT-BR**

Em `apps/docs/content/pt-BR/docs/meta.json`, adicionar `skills` no final.

Criar `apps/docs/content/pt-BR/docs/skills.mdx`:

```mdx
---
title: Skills para agentes de IA
description: Pacotes de capacidade para agentes de codigo que trabalham com nestjs-rest-query.
---

A documentacao publica da lib e a fonte de verdade para desenvolvedores. Skills sao um artefato complementar para agentes de IA que precisam de orientacao de instalacao, configuracao e troubleshooting.

<Card title="Abrir Skills" href="/skills">
  Veja a pagina gerada de skills e baixe o bundle para o seu agente.
</Card>
```

- [ ] **Step 4: Adicionar footer discreto**

Se necessario, criar `site-footer.tsx` com links:

- Docs;
- Skills;
- GitHub;
- License.

Footer deve respeitar locale:

```tsx
const prefix = locale === defaultLocale ? '' : `/${locale}`;
```

- [ ] **Step 5: Verificar links internos**

Run:

```bash
rtk rg -n "href=\"/(docs|pt-BR|skills)|url: '/|url: `" apps/docs/components apps/docs/content
```

Expected: links PT usam prefix quando necessario; `/skills` permanece global e valido.

---

## Task 6: SEO, Canonical, Sitemap, Robots E Search

**References:** `step-6-seo-search.md`, Context7 Fumadocs.

**Files:**
- Create: `apps/docs/lib/seo.ts`
- Modify: `apps/docs/app/(default)/(docs)/[...slug]/page.tsx`
- Modify: `apps/docs/app/[lang]/(docs)/[...slug]/page.tsx`
- Modify: `apps/docs/app/(default)/(docs)/skills/page.tsx`
- Create: `apps/docs/app/sitemap.ts`
- Create: `apps/docs/app/robots.ts`
- Create/Modify: `apps/docs/app/api/search/route.ts` if supported by current static export constraints.

- [ ] **Step 1: Criar helper de URL canonica com basePath**

Criar `apps/docs/lib/seo.ts`:

```ts
import { defaultLocale, type Locale } from './i18n';

const siteUrl = 'https://naldomadeira.github.io';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/nestjs-rest-query';

export const metadataBase = new URL(`${siteUrl}${basePath}/`);

export function localePrefix(locale: Locale) {
  return locale === defaultLocale ? '' : `/${locale}`;
}

export function docsPath(slugs: readonly string[] = [], locale: Locale) {
  const suffix = slugs.length > 0 ? `/${slugs.join('/')}` : '';
  return `${localePrefix(locale)}/docs${suffix}`;
}

export function absoluteUrl(path: string) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalized, metadataBase).toString();
}
```

- [ ] **Step 2: Adicionar metadataBase nos layouts raiz**

Nos layouts que exportarem metadata, usar:

```ts
import { metadataBase } from '@/lib/seo';

export const metadata = {
  metadataBase,
};
```

Se os layouts atuais nao exportarem metadata, aplicar nos `generateMetadata` das paginas docs e skills.

- [ ] **Step 3: Adicionar alternates nas paginas MDX**

Em `generateMetadata` de:

- `app/(default)/(docs)/[...slug]/page.tsx`
- `app/[lang]/(docs)/[...slug]/page.tsx`

Retornar:

```ts
const slug = params.slug ?? [];
const enPath = docsPath(slug, 'en');
const ptPath = docsPath(slug, 'pt-BR');

return {
  title: page.data.title,
  description: page.data.description,
  alternates: {
    canonical: docsPath(slug, locale),
    languages: {
      en: enPath,
      'pt-BR': ptPath,
      'x-default': enPath,
    },
  },
};
```

Ajustar `locale` conforme rota default ou `[lang]`.

- [ ] **Step 4: Criar sitemap estatico**

Criar `apps/docs/app/sitemap.ts` enumerando:

- `/`;
- `/pt-BR`;
- todas as paginas de `source.getPages('en')`;
- todas as paginas de `source.getPages('pt-BR')`;
- `/skills`;

Cada entrada deve retornar URL absoluta com `absoluteUrl`.

- [ ] **Step 5: Criar robots**

Criar `apps/docs/app/robots.ts`:

```ts
import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
```

- [ ] **Step 6: Search Fumadocs por locale**

Preferir Fumadocs nativo com `createI18nSearchAPI`, porque o repo ja usa `defineI18n`.

Implementacao esperada se compativel com static export:

```ts
import { source } from '@/lib/source';
import { createI18nSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createI18nSearchAPI('advanced', {
  i18n: {
    languages: ['en', 'pt-BR'],
    defaultLanguage: 'en',
  },
  indexes: source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    content: page.data.body.raw,
    locale: page.locale ?? 'en',
  })),
});
```

Se `output: 'export'` bloquear API route, nao migrar para SSR. Documentar no proprio plano/PR a alternativa adotada pelo Fumadocs para static search, mantendo o objetivo: search EN nao deve misturar resultado PT e vice-versa.

- [ ] **Step 7: Verificar lang no output estatico**

Run:

```bash
rtk pnpm --filter docs build
rtk find apps/docs/out -name '*.html' | while read f; do if [[ "$f" == */pt-BR/* ]]; then expected=pt-BR; else expected=en; fi; rtk proxy grep -q "<html lang=\"$expected\"" "$f" || echo "MISMATCH: $f"; done
```

Expected: nenhum `MISMATCH`.

---

## Task 7: Validacao Final

**Files:**
- Modify: somente se alguma validacao falhar.

- [ ] **Step 1: Build**

Run:

```bash
rtk pnpm --filter docs build
```

Expected:

- exit code 0;
- sem warning novo relevante;
- sem warning de `rewrites` com `output: export`.

- [ ] **Step 2: Busca por inconsistencias textuais**

Run:

```bash
rtk rg -n -i "exclusivo.*typeorm|exclusively.*typeorm|drizzle.*roadmap|roadmap.*drizzle|patters-dark|patterns-old|patters-dark-old" apps/docs
```

Expected: nenhum resultado.

- [ ] **Step 3: Verificar rotas principais no output**

Run:

```bash
rtk test -f apps/docs/out/index.html
rtk test -f apps/docs/out/docs/index.html
rtk test -f apps/docs/out/docs/getting-started/prerequisites/index.html
rtk test -f apps/docs/out/pt-BR/index.html
rtk test -f apps/docs/out/pt-BR/docs/getting-started/prerequisites/index.html
rtk test -f apps/docs/out/sitemap.xml
rtk test -f apps/docs/out/robots.txt
```

Expected: todos os comandos retornam sucesso.

- [ ] **Step 4: Smoke local via servidor estatico**

Run:

```bash
rtk pnpm --filter docs dev
```

Abrir e verificar:

- `http://localhost:9001/`
- `http://localhost:9001/docs`
- `http://localhost:9001/docs/getting-started/prerequisites`
- `http://localhost:9001/pt-BR`
- `http://localhost:9001/pt-BR/docs/getting-started/prerequisites`
- `http://localhost:9001/skills`

Expected:

- nenhuma pagina 404;
- nav nao mostra Skills como link primario;
- Skills aparece por footer/sidebar bridge;
- home explica o produto em ate 30 segundos;
- PT e EN nao misturam chrome text.

- [ ] **Step 5: Revisao visual**

Checar desktop e mobile:

- sem texto sobreposto;
- sem card dentro de card;
- botoes com tamanho consistente;
- home nao parece template Fumadocs generico;
- matriz TypeORM/Drizzle/Prisma esta clara;
- quickstart cabe em mobile.

- [ ] **Step 6: Preparar PR unica**

Run:

```bash
rtk git status --short
rtk git diff --stat
```

PR title:

```text
docs: polish product docs and multilingual UX
```

PR body:

```md
## Summary

- Consolidates the docs polish work into one final branch.
- Fixes TypeORM/Drizzle factual inconsistencies.
- Reworks the home page into a product-focused docs entry point.
- Demotes Skills from primary nav while keeping it discoverable.
- Adds/repairs multilingual SEO, sitemap, robots, and search behavior.

## Validation

- [ ] `rtk pnpm --filter docs build`
- [ ] text inconsistency scan
- [ ] output route smoke
- [ ] desktop/mobile visual smoke

## Notes

This replaces the previous multi-PR plan in `.github/proposals/docs-product-polish/PLAN.md`.
```

---

## Non-Goals

- Nao traduzir README.
- Nao traduzir `skills/nestjs-rest-query/SKILL.md`.
- Nao migrar deploy para Vercel/Cloudflare.
- Nao abandonar `output: 'export'`.
- Nao criar outro sistema de i18n paralelo ao Fumadocs.
- Nao fazer redesign de marca completo.

## Definition Of Done

- Uma branch final contem todo o trabalho.
- PR antiga fechada ou claramente marcada como substituida.
- PR nova aberta somente apos validacao.
- Build docs passa.
- Drizzle nao aparece mais como roadmap.
- TypeORM e Drizzle aparecem como stable.
- Prisma aparece apenas como roadmap.
- Home parece documentacao profissional de produto, nao template.
- Nav primario foca Docs + GitHub.
- Skills segue acessivel sem competir com Docs.
- SEO multilíngue considera `basePath`.
- Search respeita locale ou documenta claramente a limitacao tecnica de static export.
