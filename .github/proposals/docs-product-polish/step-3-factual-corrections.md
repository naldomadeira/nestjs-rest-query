# Step 3 — Correções factuais e limpeza mecânica

> **Owner:** Sonnet (prerequisites + headings), Haiku (assets, metadataBase).
> **Estimativa:** 0.5 dia.
> **Risco UX:** Baixo. Cirúrgico.

## Objetivo

Zerar contradições factuais e warnings de build. **Sem mexer em narrativa.** Aplicado em **ambos os locales** já que step-2 entregou a estrutura `en/` + `pt-BR/`.

## Pré-requisito

Step-2 mergeado (estrutura por locale existe; conteúdo PT e EN em paralelo).

## Branch sugerida

`docs/step-3-factual-corrections`

## Tarefas

### 3.1 Reescrever `prerequisites.mdx` (Drizzle estável) — em ambos locales (Sonnet)

Hoje (em PT, será espelhado em EN após step-2):
- Linha 8: "Esta lib foi pensada para aplicações NestJS que usam TypeORM..."
- Linhas 49-55: callout 🔭 com "Roadmap — Prisma e Drizzle" dizendo "suporte atual é exclusivo para TypeORM".

Atualizar para:
- Linha 8: mencionar **TypeORM e Drizzle**.
- Renomear seção "TypeORM" para "Adapters suportados" com sub-seções TypeORM e Drizzle.
- Callout 🔭 vira "Prisma — roadmap" apenas.

Aplicar em:
- `apps/docs/content/docs/en/getting-started/prerequisites.mdx`
- `apps/docs/content/docs/pt-BR/getting-started/prerequisites.mdx`

**Critério de aceite:**

```bash
grep -i "exclusivo.*typeorm\|exclusively.*typeorm\|drizzle.*roadmap\|roadmap.*drizzle" \
  apps/docs/content/docs/en/getting-started/prerequisites.mdx \
  apps/docs/content/docs/pt-BR/getting-started/prerequisites.mdx
# deve retornar vazio
```

### 3.2 Renomear `patters-dark.png` → `patterns-dark.png` (Haiku)

```bash
mv apps/docs/public/patters-dark.png apps/docs/public/patterns-dark.png
# Atualizar a única referência:
# apps/docs/app/(home)/page.tsx — '/patters-dark.png' → '/patterns-dark.png'
```

**Critério de aceite:**

```bash
grep -rn "patters-dark" apps/docs/    # vazio
ls apps/docs/public/patterns-dark.png # existe
```

### 3.3 Apagar assets `*-old.png` órfãos (Sonnet confirma + Haiku deleta)

**Sonnet** valida primeiro:

```bash
grep -rn "patterns-old\|patters-dark-old" apps/docs/
# se vazio → autoriza
```

**Haiku** deleta:

```bash
rm apps/docs/public/patterns-old.png apps/docs/public/patters-dark-old.png
```

### 3.4 Adicionar `metadataBase` (Haiku)

Em `apps/docs/app/layout.tsx`, no objeto `metadata`:

```ts
metadataBase: new URL('https://naldomadeira.github.io/nestjs-rest-query/'),
```

URL canônica vem do `homepage` em `package.json` raiz.

**Critério de aceite:** `pnpm --filter docs build` não emite mais o warning `metadataBase not configured`.

### 3.5 Padronizar headings de `adapters/{drizzle,typeorm}.mdx` (Sonnet)

Hoje há mistura: corpo em PT mas headings em inglês ("Install", "Module setup"). Padronizar **dentro de cada locale**:

- `pt-BR/adapters/drizzle.mdx` e `typeorm.mdx`: headings em PT (Instalação, Configuração do módulo, etc.).
- `en/adapters/drizzle.mdx` e `typeorm.mdx`: headings em EN (Install, Module setup, etc.).

Aplicar o glossário definido em step-2.

## Critério de aceite global

- `pnpm --filter docs build` zero warnings.
- `grep -i "exclusivo.*typeorm\|exclusively.*typeorm\|drizzle.*roadmap" apps/docs/content/` vazio.
- Nenhum asset com nome errado, nenhum órfão.
- Headings consistentes dentro de cada locale.

## Não escopo

- `rewrites` × `output: 'export'` warning — vai para [ADR-001](./ADR-001-rewrites-vs-export.md).
- Reescrita de narrativa ou tom — fica para step-4 (home).
- Renomear "TypeORM-first" no copy do hero — também step-4.
