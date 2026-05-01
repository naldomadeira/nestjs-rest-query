# Fase 1 — Correções factuais e polimento mecânico

> Pré-requisito de todas as outras fases. Tudo aqui é cirúrgico — não toca em narrativa, só nivela o que está objetivamente errado.

## Branch sugerida

`docs/phase-1-corrections`

## Tarefas

### 1.1 Reescrever `prerequisites.mdx` para refletir Drizzle estável (Sonnet)

**Por que Sonnet, não Haiku:** o arquivo tem prosa em PT que precisa preservar voz, não é find-replace.

**O que fazer:**

- Remover o callout 🔭 das linhas 49-55 sobre "Roadmap — Prisma e Drizzle".
- Substituir por um callout neutro indicando que **TypeORM e Drizzle são estáveis hoje, Prisma está no roadmap**.
- A seção "TypeORM" (linha 38) vira "Adapters suportados" com sub-seções TypeORM e Drizzle.
- A frase da linha 8 (`"Esta lib foi pensada para aplicações NestJS que usam TypeORM"`) deve mencionar TypeORM **e** Drizzle.
- Não mexer em Swagger, Node ou outras seções.

**Critério de aceite:**

```bash
grep -i "exclusivo.*typeorm\|drizzle.*roadmap\|roadmap.*drizzle" apps/docs/content/docs/getting-started/prerequisites.mdx
# deve retornar vazio
```

E `pnpm dev` mostrar a página renderizando sem links quebrados na seção.

---

### 1.2 Renomear `patters-dark.png` → `patterns-dark.png` (Haiku)

**Por que Haiku:** find-replace puro com 2 arquivos.

**O que fazer:**

```bash
mv apps/docs/public/patters-dark.png apps/docs/public/patterns-dark.png
# Atualizar a referência:
# apps/docs/app/(home)/page.tsx:90 — '/patters-dark.png' → '/patterns-dark.png'
```

**Critério de aceite:**

```bash
grep -rn "patters-dark" apps/docs/
# deve retornar vazio
ls apps/docs/public/patterns-dark.png
# deve existir
```

---

### 1.3 Apagar assets `*-old.png` órfãos (Haiku, com confirmação Sonnet)

**Por que Haiku-com-confirmação:** delete é destrutivo. Sonnet checa se realmente nenhum arquivo referencia, depois Haiku deleta.

**O que fazer:**

1. **Sonnet** confirma com:
   ```bash
   grep -rn "patterns-old\|patters-dark-old" apps/docs/
   ```
   Se retornar vazio → autorizado.

2. **Haiku** executa:
   ```bash
   rm apps/docs/public/patterns-old.png apps/docs/public/patters-dark-old.png
   ```

**Critério de aceite:** `ls apps/docs/public/*old*` retorna vazio.

---

### 1.4 Adicionar `metadataBase` ao layout root (Haiku)

**Por que Haiku:** uma linha de config seguindo padrão Next.js.

**O que fazer:**

Em `apps/docs/app/layout.tsx`, no objeto `metadata` exportado, adicionar:

```ts
metadataBase: new URL('https://naldomadeira.github.io/nestjs-rest-query/'),
```

(Verificar a URL canônica antes — vem do `homepage` em `package.json` raiz.)

**Critério de aceite:** `pnpm build` não emite mais o warning `metadataBase not configured`.

---

### 1.5 Resolver warning `rewrites` × `output: 'export'` (Sonnet)

**Por que Sonnet:** decisão de design — ou remover rewrites (perde feature) ou trocar export por SSR (muda deploy).

**Diagnóstico (executar antes):**

```bash
grep -A20 "rewrites" apps/docs/next.config.ts
grep "output" apps/docs/next.config.ts
```

**Decisão a tomar:**

- Se os rewrites são pra rotas que **não importam em build estático** (ex: dev only): mover pra `if (process.env.NODE_ENV === 'development')`.
- Se os rewrites são pra produção: o site **não pode usar `output: 'export'`** — precisa migrar pra SSR ou ISR. Isso muda o deploy (não dá pra hospedar como static no GitHub Pages do mesmo jeito). **Voltar pra Opus** pra discutir.

**Critério de aceite:** `pnpm build` não emite o warning.

---

### 1.6 Padronizar headings de `adapters/drizzle.mdx` e `typeorm.mdx` (Sonnet)

**Por que Sonnet:** decisão pequena de consistência (PT vs EN nos headings) que precisa preservar a prosa.

**O que fazer:**

Hoje os arquivos misturam — corpo em PT mas headings como `Install`, `Module setup` em inglês. Padronizar **tudo em português** nessa fase (a tradução pra inglês acontece na Fase 4).

Mapeamento sugerido:

| Atual (EN) | Padronizar (PT) |
|---|---|
| Install | Instalação |
| Module setup | Configuração do módulo |
| Quick start | Início rápido |
| Usage | Uso |
| Example | Exemplo |

**Critério de aceite:** todos os headings de `adapters/*.mdx` em pt-BR consistente.

---

## Ordem de execução

1. 1.2 (rename asset) + 1.3 (delete orphans) + 1.4 (metadataBase) — paralelo, todos Haiku
2. 1.6 (headings) + 1.1 (prerequisites) — paralelo, ambos Sonnet
3. 1.5 (rewrites) — depende do resultado do diagnóstico

## Verificação final da fase

```bash
pnpm --filter docs build 2>&1 | tee /tmp/build.log
grep -i "warn" /tmp/build.log
# deve estar vazio (ou só warnings que não eram alvo dessa fase)

grep -rn "patters-dark\|patterns-old\|exclusivo.*TypeORM\|Drizzle.*roadmap" apps/docs/
# deve estar vazio
```
