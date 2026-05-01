# ADR-001 — `next.config.ts` rewrites × `output: 'export'`

> **Status:** Superado.
> **Owner:** Opus.
> **Bloqueia:** nada.

O `next.config.ts` atual não declara `rewrites`; portanto o warning original não é mais uma decisão arquitetural pendente. Manter `output: 'export'`.

---

## Contexto histórico

`pnpm --filter docs build` emite hoje:

```
⚠ Specified "rewrites" will not automatically work with "output: export"
```

Há duas posturas possíveis:

1. **Manter `output: 'export'`** (deploy estático em GitHub Pages) e remover/renderizar rewrites de outra forma.
2. **Migrar para SSR/ISR** (deploy em Vercel ou Node), mantendo rewrites.

A fricção é real porque a docs hoje é hospedada como artefato estático, e mudar isso afeta CI/CD, custo, e tempo de deploy.

## Diagnóstico necessário (Opus, 30 min)

Antes de decidir:

1. Ler `apps/docs/next.config.ts` e listar todos os `rewrites`.
2. Para cada rewrite, classificar:
   - `dev-only`? (proxy de API local)
   - `prod`? (rota interna do site)
   - `external`? (redirecionando para outro domínio)
3. Conferir se o site faz fetch dinâmico de algo em runtime (não deveria — é docs).

## Opções

### Opção A — Manter export, remover rewrites de prod

Se os rewrites são todos dev-only ou removíveis:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export',
  ...(process.env.NODE_ENV === 'development' && {
    rewrites: async () => [
      /* dev-only rewrites */
    ],
  }),
};
```

**Prós:** mantém deploy gratuito no GitHub Pages, build estático rápido.
**Contras:** se algum rewrite é necessário em prod, vai precisar de redirect server-side em outro lugar (ex: Cloudflare Pages, Vercel routes.json).

### Opção B — Migrar para Vercel SSR/ISR

Se os rewrites são essenciais em prod:

- Trocar `output: 'export'` por SSR ou ISR.
- Migrar deploy para Vercel (gratuito para projetos pessoais).
- Atualizar `release.yml` para deploy via `vercel deploy`.
- `homepage` em `package.json` muda de `naldomadeira.github.io/nestjs-rest-query/` para `nestjs-rest-query.vercel.app` (ou domínio custom).

**Prós:** features nativas do Next (server actions, ISR, etc.) ficam disponíveis. Search dinâmico mais flexível.
**Contras:** dependência de plataforma (Vercel), URL canônica muda (precisa redirect 301 do GitHub Pages durante migração), build mais lento.

### Opção C — Manter export, migrar rewrites para Cloudflare Pages

Meio termo:

- Manter `output: 'export'`.
- Mover deploy do GitHub Pages para Cloudflare Pages (gratuito).
- Configurar redirects via `_redirects` ou `_headers` da Cloudflare.

**Prós:** preserva static export, rewrites funcionam via Cloudflare.
**Contras:** mais complexidade de deploy, troca de provider.

## Decisão pendente

Opus decide após diagnóstico. Pré-disposição: **Opção A**, porque docs site provavelmente não tem rewrites de prod relevantes. Se aparecer um caso real, reavaliar.

## Critério de fechamento do ADR

- Diagnóstico documentado nesse arquivo (lista dos rewrites e classificação).
- Decisão registrada com data e razão.
- Se aprovação de mudança de provider (Opção B/C), abrir issue separada e linkar aqui.
- Build sem warning de `rewrites × export`.

## Não decidir aqui

- Adicionar novos rewrites por antecipação.
- Otimizações de performance do build.
- Estratégia de cache da CDN.
