# Step 6 — SEO multilíngue + search bilíngue

> **Owner:** Sonnet (search arch + alternates), Haiku (sitemap, smoke).
> **Estimativa:** 0.5-1 dia.
> **Risco UX:** Baixo (mas ferramentas externas — Google, Bing — podem demorar a refletir).

## Objetivo

Fechar o loop do i18n com SEO correto e search funcionando em ambos os locales. Esse PR é o que torna o site "i18n maduro" sob a ótica de buscadores e usuários que pesquisam dentro do site.

## Pré-requisito

Steps 1, 2 mergeados (estrutura por locale + tradução).
Steps 3, 4, 5 idealmente mergeados (factual e nav já consolidados antes de SEO).

## Branch sugerida

`docs/step-6-seo-search`

## Tarefas

### 6.1 `alternates` em todas as páginas (Sonnet)

Helper em `apps/docs/lib/i18n/alternates.ts`:

```ts
export function getAlternates(slug: string, locale: Locale) {
  const enPath = slug; // ex: '/docs/adapters/drizzle'
  const ptPath = `/pt${slug}`;
  return {
    canonical: locale === 'en' ? enPath : ptPath,
    languages: {
      en: enPath,
      'pt-BR': ptPath,
    },
  };
}
```

Aplicar em:
- `app/(home)/page.tsx`
- `app/pt/page.tsx`
- `app/(docs)/[...slug]/page.tsx` (via `generateMetadata`)
- `app/pt/(docs)/[...slug]/page.tsx`
- `app/(docs)/skills/page.tsx`

`<head>` resultante deve conter:

```html
<link rel="canonical" href="https://.../docs/adapters/drizzle" />
<link rel="alternate" hreflang="en" href="https://.../docs/adapters/drizzle" />
<link rel="alternate" hreflang="pt-BR" href="https://.../pt/docs/adapters/drizzle" />
<link rel="alternate" hreflang="x-default" href="https://.../docs/adapters/drizzle" />
```

### 6.2 Sitemap com ambos locales (Haiku)

`apps/docs/app/sitemap.ts`:

- Enumera todas as rotas estáticas em ambos locales.
- Inclui `<xhtml:link rel="alternate" hreflang="...">` em cada `<url>`.
- Output em `/sitemap.xml` no build.

Pode ser script Node que lê `content/docs/{en,pt-BR}/**/*.mdx` e gera o sitemap. Haiku executa seguindo template.

### 6.3 robots.txt (Haiku)

`apps/docs/app/robots.ts` exportando regras simples:

```
User-agent: *
Allow: /

Sitemap: https://naldomadeira.github.io/nestjs-rest-query/sitemap.xml
```

### 6.4 Search Fumadocs por locale (Sonnet)

Decisão de arquitetura (Opus referee se aparecer dúvida):

- **Plan A:** duas instâncias separadas de Fumadocs search, uma por locale. URL de search detecta locale via path.
- **Plan B:** uma instância única indexando ambos os locales, filter por locale aplicado client-side.

Recomendação: **Plan A**. Resultado de search em PT não vaza pra EN.

Implementação:
- `lib/source.ts` ganha helpers `getEnSource()`, `getPtSource()` retornando trees separadas.
- API route ou client de search inicializado com source apropriado por rota.
- UI de search reusa o componente atual mas alimentado pelo source correto.

### 6.5 Verificar `<html lang>` correto em todas as páginas geradas (Haiku)

```bash
# após build
find apps/docs/out -name '*.html' | while read f; do
  if [[ "$f" == */pt/* ]]; then expected=pt-BR; else expected=en; fi
  grep -q "<html lang=\"$expected\"" "$f" || echo "MISMATCH: $f"
done
```

Falha o PR se imprimir alguma linha.

### 6.6 Lighthouse i18n audit (Haiku)

```bash
lighthouse https://localhost:9001/docs/adapters/drizzle \
  --only-categories=seo \
  --output=json
```

Verificar:
- `hreflang` válido em todas as páginas amostradas (5 EN + 5 PT).
- `canonical` correto.
- `lang` no `<html>` correto.

### 6.7 Smoke completo de URLs (Haiku)

Script que enumera todas as rotas (via sitemap), faz `curl -I`, espera 2xx. Executa em local + preview deploy.

## Critério de aceite

- `<link rel="canonical">` correto em todas as páginas amostradas.
- `<link rel="alternate" hreflang="...">` correto incluindo `x-default`.
- Sitemap inclui todas as rotas com `xhtml:link` para variantes.
- Search no `/docs` retorna apenas resultados EN.
- Search no `/pt/docs` retorna apenas resultados PT.
- `<html lang>` correto em 100% das páginas estáticas geradas.
- Smoke `curl -I` 100% 2xx em ambos locales.

## Não escopo

- Tradução de novas páginas — qualquer página adicionada após step-2 é responsabilidade do PR que a adiciona.
- Otimização de Core Web Vitals — step-4 já cuidou de Lighthouse Performance da home; outras páginas ficam para um futuro "perf polish".
- Configurar Google Search Console — fora do código.
