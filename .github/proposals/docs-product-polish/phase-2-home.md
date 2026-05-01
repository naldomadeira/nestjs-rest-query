# Fase 2 — Home reposicionada

> Objetivo: a home parar de parecer template Fumadocs default e começar a parecer **produto**. Audiência alvo: backend dev avaliando se vale adotar a lib, em ≤ 60 segundos de leitura.

## Branch sugerida

`docs/phase-2-home`

## Pré-requisito

Fase 1 mergeada (sem assets quebrados, sem inconsistência factual).

## Estrutura proposta da home (Opus decide, Sonnet implementa)

A home atual segue padrão `hero+screenshot+grid de 6 features`. Reescrita em 5 seções, nesta ordem:

### Seção 1 — Hero com tese forte

Hoje:
> "Filtros, paginação e ordenação dinâmicos a partir de parâmetros HTTP. TypeORM-first..."

Vira algo como (texto final é decisão de Opus durante execução):
> "Stop writing the same WHERE clauses. nestjs-rest-query turns REST query strings into safe, whitelisted database queries — for TypeORM and Drizzle, in NestJS."

Mudanças:
- Tese antes de feature.
- Inglês como default (Fase 4 vai materializar; mas o copy já nasce em EN).
- Menciona TypeORM **e** Drizzle (consistência com adapters).
- CTA primário: "Get started" (não "Começar").
- CTA secundário: "View on GitHub" (não "Documentação" — link de docs vai pro nav primário).

### Seção 2 — Before/After

A coisa mais alta de impacto na home. Mostra dois blocos lado a lado:

```
ANTES                                    DEPOIS
─────────────────                       ─────────────────
async findAll(query: any) {             @ApiDynamicQuery({
  const where = {};                       filters: ['name', 'email'],
  if (query.email) {                      sorts: ['createdAt'],
    where.email = ILike(`%${query.email}%`);   })
  }                                      list(@Query() q, @QueryRules() r) {
  // ... 30+ lines parsing                return qb.execute(repo, q, r);
  return repo.find({ where, ... });    }
}
```

Notas para Sonnet:
- Pode usar `<CodeBlock>` lado a lado com `<div className="grid grid-cols-2">`.
- Em mobile, empilhar.
- O código "antes" é fictício mas realista — boilerplate típico de NestJS+TypeORM.
- Highlight no código "depois" mostrando o ponto onde o whitelist é declarado.

### Seção 3 — Compatibilidade (matriz visual)

Tabela ou grid com badges:

| ORM     | Status         |
|---------|----------------|
| TypeORM | ✅ Stable       |
| Drizzle | ✅ Stable       |
| Prisma  | 🚧 Coming soon  |

| Runtime | Versão |
|---------|--------|
| NestJS  | ^11    |
| Node    | ≥ 20   |

Importante: **nada de menção a "exclusivo TypeORM"**. Espelha o README e a Fase 1.

### Seção 4 — Quickstart escaneável

≤ 30 linhas, em 3 blocos numerados:

1. `pnpm add nestjs-rest-query`
2. Bootstrap em `main.ts` (3 linhas críticas)
3. Decorator + service (snippet curto)

Cada bloco tem 1 frase de contexto. Sem prosa longa.

### Seção 5 — Próximo passo + prova social

- Link grande "Read the docs →"
- Badge npm (versão atual, downloads)
- Link "Used in production by ..." (se houver — pular se não tiver case real)

## Tarefas

| # | Tarefa | Modelo |
|---|---|---|
| 2.1 | Definir copy final do hero (3 versões A/B mentais, escolher 1) | **Opus** |
| 2.2 | Escolher exemplo de código antes/depois (escolher domínio realista) | **Opus** |
| 2.3 | Decidir layout exato e responsividade do before/after | **Opus** |
| 2.4 | Implementar nova `app/(home)/page.tsx` seguindo a spec acima | Sonnet |
| 2.5 | Componentizar `<BeforeAfter>` (provavelmente sai como componente reutilizável) | Sonnet |
| 2.6 | Atualizar OG image do site se a home mudar visualmente forte | Sonnet ou Haiku |
| 2.7 | Verificar Lighthouse score (LCP, CLS) da home nova | Haiku |

## Arquivos que vão mudar

- `apps/docs/app/(home)/page.tsx` — reescrita
- `apps/docs/components/before-after.tsx` — novo, provavelmente
- `apps/docs/components/compat-matrix.tsx` — novo, provavelmente
- `apps/docs/public/og-home.png` — atualizar se redesenhada
- Não tocar em `content/docs/**` nessa fase.

## Critério de aceite

- Visitante novo na home consegue dizer em 30s o que é, por que existe, como instala.
- O bloco antes/depois é entendido sem ler explicação.
- Compatibilidade visível sem rolar até o fim.
- Lighthouse Performance ≥ 90 em mobile.
- Sem regressão em CLS/LCP comparado à home atual.

## Estimativa

- Opus (copy + decisões): 2-3 horas
- Sonnet (implementação): 3-5 horas
- Haiku (smoke + lighthouse): 30 min
- **Total: 1 dia**
