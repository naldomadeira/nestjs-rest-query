# Fase 4 — i18n: inglês default + `/pt/` opcional

> Objetivo: site em inglês na raiz (`/`), português acessível em `/pt/...` com seletor explícito. Sem autodetect, sem cookie, sem mágica.

## Branch sugerida

`docs/phase-4-i18n`

## Pré-requisito

Fases 1 e 2 mergeadas. Fase 3 pode estar em paralelo. **Não começar antes da Fase 2** — não vale traduzir copy que vai mudar de qualquer jeito.

## Estratégia (Opus, fixada agora)

### Roteamento

```
/                              → EN (default)
/docs/...                      → EN
/skills/                       → EN
/pt                            → PT home
/pt/docs/...                   → PT
/pt/skills/                    → PT skills
```

**Sem autodetect** do `Accept-Language`. **Sem cookie** persistindo escolha. Quem quer PT clica no switcher; URL muda; pronto.

### Por que assim

- A docs usa `output: 'export'` (estática). [Next docs explicitamente avisa](https://nextjs.org/docs/messages/export-no-i18n) que i18n nativa do Next não funciona com export.
- Fumadocs tem suporte a i18n mas o [guia oficial assume middleware](https://www.fumadocs.dev/docs/internationalization/next), o que não combina com static export.
- Rotas explícitas evitam middleware: cada locale é uma sub-tree estática, gerada em build.
- Esconder o locale default ou fallback inteligente exige mais trabalho (custom redirects, hreflang complexo) com valor marginal — **fora do escopo**.

### Estrutura de conteúdo

```
apps/docs/
  content/
    docs/
      en/                        # novo — default em /docs/
        getting-started/
        adapters/
        ...
      pt/                        # novo — em /pt/docs/
        getting-started/
        adapters/
        ...
  app/
    (home)/page.tsx              # EN
    pt/
      (home)/page.tsx            # PT
      (docs)/...                 # PT docs route group
    (docs)/
      [...slug]/page.tsx         # já existe — EN
```

Alternativa: usar Fumadocs' built-in i18n com pasta única e frontmatter por locale. Mas isso entra em conflito com static export. **Pasta separada por locale é mais simples e robusto.**

### Componente `LanguageSwitcher`

- Renderiza dois links: `EN` e `PT`.
- Item ativo destacado.
- Calcula a URL "espelho" no outro locale (ex: estou em `/pt/docs/adapters/drizzle`, link de EN aponta pra `/docs/adapters/drizzle`).
- Se a página espelho não existe (raro), aponta pra raiz do locale.

### Metadata

Cada página precisa:

```tsx
export const metadata = {
  alternates: {
    canonical: '/docs/adapters/drizzle',
    languages: {
      en: '/docs/adapters/drizzle',
      'pt-BR': '/pt/docs/adapters/drizzle',
    },
  },
};
```

Isso vai num helper `getLocalizedMetadata(slug, locale)` chamado em cada page.

## Tarefas

| # | Tarefa | Modelo | Notas |
|---|---|---|---|
| 4.1 | Confirmar estratégia de pasta vs Fumadocs i18n built-in | **Opus** | Validar se Fumadocs aceita pasta-por-locale sem fricção |
| 4.2 | Style guide bilíngue (glossário técnico EN↔PT) | **Opus** | Termos como "whitelist", "decorator", "rules" — manter em EN ou traduzir? |
| 4.3 | Criar estrutura `content/docs/{en,pt}/` | Sonnet | Mover MDX existente (PT) pra `pt/`; criar versões EN |
| 4.4 | Traduzir cada MDX existente PT→EN seguindo o glossário | Sonnet | Tradução fiel, não reformulação |
| 4.5 | Atualizar `lib/source.ts` para entregar tree por locale | Sonnet | Pode ser 2 chamadas de `loader()` ou 1 com filtro |
| 4.6 | Criar `app/pt/layout.tsx` espelhando `app/(docs)/layout.tsx` mas em PT | Sonnet | Reusa componentes, troca strings |
| 4.7 | Criar `app/pt/(docs)/[...slug]/page.tsx` espelho do EN | Sonnet | Copia a lógica, lê do tree PT |
| 4.8 | Externalizar strings hard-coded (CTA, nav labels, footer) em `lib/i18n.ts` | Sonnet | Dicionário simples `{en, pt}` |
| 4.9 | Componente `<LanguageSwitcher />` com cálculo de URL espelho | Sonnet | Lê `usePathname()`, troca prefixo |
| 4.10 | Adicionar `<html lang>` dinâmico — vem do segmento da rota | Sonnet | Detect via path: começa com `/pt`? `pt-BR` : `en` |
| 4.11 | `alternates` (canonical + hreflang) em todas as páginas | Sonnet | Helper `getAlternates(slug, locale)` |
| 4.12 | Sitemap com ambas as variantes | Haiku | Geração mecânica |
| 4.13 | Smoke test: `curl -I` em todas as URLs de ambos locales | Haiku | Detecta 404 |
| 4.14 | Lighthouse i18n audit: hreflang correto, lang attr | Haiku | Pode rodar via CLI |

## Decisões delicadas (Opus precisa fechar antes de Sonnet começar)

### 1. Termos técnicos: traduzir ou não?

Sugestão (a confirmar):

| Termo | EN | PT |
|---|---|---|
| whitelist | whitelist | whitelist (manter) |
| filter | filter | filtro |
| sort | sort | ordenação |
| field | field | campo |
| include / relation | relation | relação |
| decorator | decorator | decorator (manter) |
| rule | rule | regra |
| pagination | pagination | paginação |

**Princípio:** termos que o desenvolvedor encontra **no código** (decorator, whitelist) ficam em inglês. Termos de UX (sort, filter) podem traduzir. Glossário fixo evita inconsistência.

### 2. Onde guardar strings de UI

Opções:
- `apps/docs/lib/i18n.ts` exportando `{ en: { ... }, pt: { ... } }` — simples, sem deps.
- Biblioteca tipo `next-intl` — overkill pra 2 idiomas e só strings de chrome.

**Recomendação:** dicionário em `lib/i18n.ts`, sem dependência nova.

### 3. Slug do PT: traduzir ou não?

Manter slug em inglês mesmo no PT (`/pt/docs/getting-started/prerequisites`) ou traduzir (`/pt/docs/comecando/pre-requisitos`)?

**Recomendação:** **manter em inglês**. SEO mais simples (mesma estrutura), URLs estáveis se mudar idioma, menor manutenção.

## Critério de aceite

- `curl https://naldomadeira.github.io/nestjs-rest-query/` → HTML com `lang="en"`.
- `curl .../pt/` → HTML com `lang="pt-BR"`.
- Switcher visível em todas as páginas; clicar troca o locale e mantém o caminho.
- `<link rel="alternate" hreflang="...">` correto em todas as páginas (auditável via Lighthouse).
- Sitemap inclui ambas as variantes.
- Build estático ainda passa (`pnpm build` zero erros).
- Sem regressão em search dos docs (Fumadocs search funciona em ambos os locales).

## Estimativa

- Opus (decisões + glossário): 2-3 horas
- Sonnet (estrutura + tradução + componentes): 1.5-2 dias
- Haiku (sitemap + smoke + lighthouse): 2 horas
- **Total: 2-3 dias**

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Fumadocs não suporta bem pasta-por-locale | Fallback: usar i18n built-in mesmo com export, aceitar fricção. Opus reavalia em 4.1 |
| Tradução EN→PT fica robótica | Opus revisa amostragem (5 páginas aleatórias) antes de Sonnet continuar |
| Search não funciona em ambos locales | Fumadocs search aceita múltiplos sources; configurar 2 instâncias |
| Build estático fica lento | Aceitar — é build, não runtime |

## Não escopo (relembrando)

- Autodetect de idioma.
- Cookie persistindo escolha.
- Esconder o locale default.
- Terceiro idioma.
- Tradução do README ou da skill `SKILL.md` (são produtos separados).
