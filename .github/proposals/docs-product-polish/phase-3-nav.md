# Fase 3 — Nav restructure + Skills demovido

> Objetivo: nav primário foca audiência da lib (devs que vão usar). Skills sai do mesmo nível de Docs porque é recurso secundário pra agentes.

## Branch sugerida

`docs/phase-3-nav`

## Pré-requisito

Fase 1 mergeada. Pode rodar em paralelo com Fase 2.

## Estado atual

`apps/docs/app/(docs)/layout.tsx:30-32`:

```tsx
const navLinks = [
  { text: 'Docs', url: '/docs' },
  { text: 'Skills', url: '/skills' },
  { type: 'icon', text: 'GitHub', ... },
];
```

Skills tem **mesmo peso visual** que Docs. Pra um visitante que quer aprender a lib, isso é ruído.

## Opções (Opus escolhe uma)

### Opção A — Skills no rodapé do `/docs`

Nav primário fica:

```tsx
const navLinks = [
  { text: 'Docs', url: '/docs' },
  { type: 'icon', text: 'GitHub', ... },
];
```

Skills vira link no footer + uma seção dentro de `/docs/skills` (item no sidebar dos docs, no mesmo nível de "Adapters", "Advanced").

**Prós:** mais limpo, mantém Skills descobrível por quem está dentro da doc.
**Contras:** alguém que chega na home buscando "skills pro Claude Code" não acha imediatamente.

### Opção B — Skills como dropdown discreto

Nav primário:

```tsx
const navLinks = [
  { text: 'Docs', url: '/docs' },
  { text: 'Resources', url: '/skills' },  // ou um menu dropdown
  { type: 'icon', text: 'GitHub', ... },
];
```

"Resources" pode futuramente agregar skills + outros recursos (templates, examples).

**Prós:** Skills visível mas não compete.
**Contras:** "Resources" vazio hoje (só Skills), pode parecer underdeveloped.

### Opção C — Skills só no rodapé

Tira completamente do nav primário. Aparece no footer com outros links secundários (License, Changelog, etc.).

**Prós:** mais focado.
**Contras:** baixa descoberta inicial.

**Recomendação Opus (a confirmar durante execução):** **Opção A**. Maximiza foco do nav primário sem matar Skills. Já que o público de Skills é agente de IA (e o agente lê o `SKILL.md` direto), descoberta humana acontece secundariamente — via Docs internas ou GitHub.

## Tarefas

| # | Tarefa | Modelo |
|---|---|---|
| 3.1 | Decidir entre A/B/C com base em métricas se houver, ou no julgamento | **Opus** |
| 3.2 | Implementar mudança em `app/(docs)/layout.tsx` | Sonnet |
| 3.3 | Adicionar entrada de Skills no sidebar dos docs (Opção A) | Sonnet |
| 3.4 | Garantir que `/skills` ainda funciona como rota, com canonical link | Sonnet |
| 3.5 | Atualizar `meta.json` em `content/docs/` se Skills virar item de sidebar | Sonnet |
| 3.6 | Search-and-replace de links internos quebrados se URL de Skills mudar | Haiku |
| 3.7 | Atualizar OG/metadata da home (CTA não menciona mais "Skills" se for o caso) | Haiku |

## Arquivos que vão mudar

- `apps/docs/app/(docs)/layout.tsx` — remover entrada de Skills do `navLinks`
- `apps/docs/content/docs/meta.json` — adicionar `"skills"` na lista de pages, se Opção A
- `apps/docs/content/docs/skills/index.mdx` — novo, redireciona ou explica e linka pra `/skills` original (manter URL pra não quebrar links externos)
- `apps/docs/components/footer.tsx` (se existir) ou layout — adicionar link Skills no rodapé

## Critério de aceite

- Nav primário tem ≤ 2 links + GitHub icon.
- Skills continua acessível em ≤ 2 cliques de qualquer página.
- Nenhum link interno quebrado.
- Search no docs (Fumadocs search) ainda indexa Skills.

## Estimativa

- Opus (decisão): 30 min
- Sonnet (implementação): 1-2 h
- Haiku (limpeza): 30 min
- **Total: 2-3 horas**
