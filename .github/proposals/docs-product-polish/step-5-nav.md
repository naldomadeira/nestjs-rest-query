# Step 5 — Nav restructure: Skills demovido

> **Owner:** Opus (decisão de IA + CTA copy), Sonnet (implementação), Haiku (link checking).
> **Estimativa:** 0.5 dia.
> **Risco UX:** Médio — descoberta de Skills muda.

## Objetivo

Nav primário foca audiência da lib (devs que vão usar). Skills sai do mesmo nível de Docs. Decisão estratégica fixada no PLAN: Skills é **apêndice técnico**, não produto público de primeira linha.

## Pré-requisito

Steps 1-4 mergeados. Ideal mas não obrigatório que 4 esteja em produção pra coletar reação.

## Branch sugerida

`docs/step-5-nav`

## Decisão de IA (Opção A — fixada)

Nav primário fica:

```tsx
const navLinks = [
  { text: t.nav.docs, url: '/docs' },
  { type: 'icon', text: 'GitHub', ... },
];
```

Skills:

- **Footer link** discreto (mesmo nível que License, Changelog).
- **Item dentro de `/docs`** no sidebar, no mesmo nível que "Adapters", "Advanced".
- Continua acessível em ≤ 2 cliques de qualquer página.
- Continua **só em EN** (decisão estratégica #3 do PLAN: Skills é apêndice, não traduz).

Razões:

- Audiência primária da home é dev escolhendo a lib. Skills é secundária.
- Skills serve agentes — agente lê `SKILL.md` direto, não precisa de visibilidade no nav.
- Manter descobrível mas sem competir com Docs.

## Tarefas

| #    | Tarefa                                                                                        | Modelo   | Notas                                                   |
| ---- | --------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| 5.1  | Definir copy final dos CTAs e dos meta tags afetados (EN + PT)                                | **Opus** | Continua proteção contra "ajuste mecânico apaga nuance" |
| 5.2  | Decidir slug da seção Skills dentro de `/docs` (`/docs/skills`? `/docs/integrations/skills`?) | **Opus** | Hierarquia                                              |
| 5.3  | Atualizar `app/(docs)/layout.tsx` — remover entrada Skills do `navLinks`                      | Sonnet   | Edit pequeno                                            |
| 5.4  | Adicionar entrada de Skills no sidebar (`content/docs/en/meta.json`)                          | Sonnet   | Mapping                                                 |
| 5.5  | Criar `content/docs/en/skills.mdx` que linka pra `/skills` (mantém URL)                       | Sonnet   | Bridge page; explica e linka                            |
| 5.6  | Adicionar `<Footer>` (ou ajustar existente) com link Skills                                   | Sonnet   | Component                                               |
| 5.7  | Atualizar dicionário `i18n/dictionaries/{en,pt-BR}.ts` — chaves `nav.*`, `footer.*`           | Sonnet   | Reflete decisão                                         |
| 5.8  | Atualizar `apps/docs/app/(home)/page.tsx` se algum CTA mencionar Skills                       | Sonnet   | Spec de Opus                                            |
| 5.9  | Atualizar `metadata` da home (description) se mencionar Skills                                | Sonnet   | Idem                                                    |
| 5.10 | Atualizar `og-home.png` se conceito da Step-4 mencionava Skills                               | Sonnet   | Reusa pipeline da Step-4                                |
| 5.11 | Smoke: crawl de todas as páginas, sem 404 em links internos                                   | Haiku    | curl + lista                                            |
| 5.12 | Verificar redirect/canonical para `/skills` original                                          | Haiku    | curl -I                                                 |

## Arquivos que vão mudar

- `apps/docs/app/(docs)/layout.tsx` — remove entrada Skills do nav
- `apps/docs/app/pt/(docs)/layout.tsx` (se existir após step-2) — idem
- `apps/docs/content/docs/en/meta.json` — adiciona "skills" se Opus optar por sidebar
- `apps/docs/content/docs/en/skills.mdx` — novo (bridge para `/skills`)
- `apps/docs/components/footer.tsx` — novo ou ajustado
- `apps/docs/lib/i18n/dictionaries/{en,pt-BR}.ts` — chaves `footer.*`
- `apps/docs/app/(home)/page.tsx` e `apps/docs/app/pt/page.tsx` — se CTAs mencionavam Skills
- `apps/docs/public/og-home.png` — se conceito mudou

## Critério de aceite

- Nav primário tem ≤ 2 links + GitHub icon.
- Skills continua acessível em ≤ 2 cliques de qualquer página.
- Nenhum link interno quebrado (smoke Haiku).
- Search Fumadocs ainda indexa Skills (testar em ambos locales — mas Skills só em EN, então PT search não retorna nada para "skills").
- `/skills` URL continua válida (mantém compatibilidade com links externos).
- CTAs e metadata da home revisadas pela Opus, não simplesmente find-replace.

## Não escopo

- Mudar conteúdo da página de Skills em si (`apps/docs/app/(docs)/skills/page.tsx`).
- Tradução do `/skills` para PT (decisão estratégica #3).
- Reescrever sidebar do `/docs` por completo — só adicionar entrada Skills.
