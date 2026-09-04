# Estado da v3

**Versão-alvo:** `3.0.0` · **Última verificação:** 2026-09-04

> A `3.0.0` estável **não** pode ser publicada a partir deste estado. Os gates
> da §23 do design não passam, e a lista está no fim desta página. Qualquer
> publicação hoje é pré-release.

Esta página descreve o que existe e o que falta. O
[design aprovado](../superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md)
descreve o que foi decidido, e não deve ser editado para acompanhar o
progresso — é registro de decisão.

## Como ler as evidências

Duas coisas diferentes são chamadas de "teste verde" neste projeto, e confundir
as duas é a forma mais fácil de superestimar o estado:

- **Dialeto de referência (SQLite).** Prova que o compilador do adapter
  implementa a semântica do plano. É rápido, roda em `pnpm test` e **não** é
  célula da matriz de paridade.
- **Matriz de paridade (PostgreSQL, MySQL, SQL Server).** É a promessa da §5:
  mesma query, mesmo resultado nas nove combinações. Roda em
  `pnpm test:integration`, exige os bancos do perfil certificado no ar, e
  **não foi executada** contra Prisma nem Drizzle.

## Fases de entrega

| Fase | Escopo                | Estado                    | Evidência                                                                                          |
| ---- | --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 0    | Contrato e baseline   | **completa**              | corpus congelado em `tests/v3/corpus/`, perfis em `test/profiles/`                                 |
| 1    | Core semântico        | **completa**              | parser, AST, autorização exata, codecs, plano, normalizador                                        |
| 2    | API e distribuição    | **completa**              | sources discriminadas, `transformPlan`, `customize` com escopo, 4 subpaths, `verify:package` verde |
| 3    | TypeORM de referência | **dialeto de referência** | corpus 66/66 em SQLite, com TypeORM `0.3.x` e `1.1.x`                                              |
| 4    | Prisma                | **dialeto de referência** | corpus 66/66 contra client gerado; sem generator, com 1 divergência declarada                      |
| 5    | Drizzle               | **dialeto de referência** | corpus 66/66 em SQLite via `drizzle-orm` real                                                      |
| 6    | Paridade completa     | **não iniciada**          | nenhuma célula real rodou contra Prisma ou Drizzle                                                 |
| 7    | Hardening e release   | **não iniciada**          | exemplos, codemods, alpha/beta/RC                                                                  |

Nenhuma fase de adapter está _completa_: completa exigiria as três células
reais, que é a fase 6.

## Estado por adapter

|                                 | TypeORM                               | Prisma                                | Drizzle                            |
| ------------------------------- | ------------------------------------- | ------------------------------------- | ---------------------------------- |
| Corpus no dialeto de referência | 66/66                                 | 66/66                                 | 66/66                              |
| Usa o ORM de verdade            | sim                                   | sim, client gerado                    | sim                                |
| PostgreSQL / MySQL / SQL Server | harness pronto, matriz não confirmada | **não rodou**                         | **não rodou**                      |
| Divergências declaradas         | nenhuma                               | 1 (`like` literal)                    | nenhuma                            |
| Lacuna própria                  | —                                     | generator a partir de `schema.prisma` | coleção aninhada sob outra relação |

### TypeORM

Adapter de referência. Junções idempotentes para filter, search, sort e fields
mesmo sem `includes`; joins de predicado separados dos de apresentação; PKs
compostas; paginação em duas fases quando a projeção inclui relação `many`.

### Prisma

`prismaSource`, `PrismaAdapter` e manifesto **escrito à mão** e validado na
inicialização. Relação `many` usa `some`/`none`, `one` usa `is`/`isNot`; o
perfil portável consulta folded fields e nunca emite `mode: 'insensitive'`.

O generator que derivaria o manifesto de um `schema.prisma` **não existe** —
é a lacuna que impede a fase 4 de fechar mesmo com o corpus verde.

### Drizzle

`drizzleSource`, `DrizzleAdapter` e `drizzleDatabase()` sobre `drizzle-orm`.
Relações declaradas por path pontuado, planner de junções idempotente, `EXISTS`
correlacionado para qualquer salto `many`, coleção de primeiro nível hidratada
por consulta própria. `ILIKE` nunca é emitido.

`drizzle-orm` está fixado em `1.0.0-rc.4`. Enquanto não houver GA com suporte a
MSSQL, a v3 permanece pré-release por decisão do design (§25.8).

## Divergências intencionais

Divergência é exceção, não acomodação: fica declarada como dado no próprio caso
do corpus (`tests/v3/corpus/cases.ts`), com justificativa obrigatória, e é
comparada com o mesmo rigor da expectativa canônica. Um adapter que volte a
concordar quebra o build e força a remoção da exceção.

| Adapter | Caso                         | Por quê                                                                                                                                                                                                                                               |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma  | `like/underscore-is-literal` | O Prisma compila `contains` para `LIKE ('%' \|\| ? \|\| '%')` sem cláusula `ESCAPE` e não escapa metacaracteres; o client tipado não permite fornecê-la. `%` e `_` viram coringas em `like`, `notLike`, `ilike`, `notIlike` e `search`, contra a §11. |

Atenção ao ler o corpus: `like/percent-is-literal` passa no Prisma **por
coincidência** — exatamente um nome do seed contém "100". Aquele verde não é
cobertura.

## Gates da `3.0.0` (§23)

| Gate                                            | Estado                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Nove combinações reais verdes, sem skips        | **não** — só o dialeto de referência roda                                              |
| Drizzle/MSSQL em versão estável                 | **não** — `1.0.0-rc.4`                                                                 |
| Nenhum cast no uso público documentado          | sim                                                                                    |
| Nenhum peer opcional carregado pelo core        | sim — provado por consumer fixture                                                     |
| Exemplos compilam e passam smoke E2E            | **não** — fase 7                                                                       |
| Códigos de erro e JSON canônico idênticos       | sim no dialeto de referência; não medido na matriz                                     |
| Cobertura de branches críticos acima de 95%     | **parcial** — ver abaixo                                                               |
| Nenhum achado de segurança alto ou crítico      | sem varredura nova nesta rodada                                                        |
| Benchmarks dentro do orçamento                  | não reexecutado nesta rodada                                                           |
| Migration guide validado num consumidor v2 real | **não**                                                                                |
| Matriz pública de versões coincide com a CI     | **não** — a CI não roda Prisma/Drizzle                                                 |
| Profiles de banco passam nos checks             | **parcial** — o runtime valida fatos fornecidos pelo chamador, sem collector por banco |

### Cobertura

Medida na última execução completa de `pnpm test`:

| Área                     | Statements | Branches |
| ------------------------ | ---------- | -------- |
| Total                    | 95.26%     | 87.62%   |
| `infra/adapters/prisma`  | 98.59%     | 96.73%   |
| `infra/adapters/drizzle` | 97.97%     | 94.28%   |
| `infra/adapters/typeorm` | 92.14%     | 75.00%   |

O gate pede branches acima de 95% nos caminhos críticos. O adapter TypeORM,
que é o de referência, está em 75% — é a maior dívida de cobertura aberta.

## Bloqueadores nomeados

1. **Nenhum banco real rodou contra Prisma ou Drizzle.** É a fase 6 inteira e o
   principal motivo de nada aqui poder ser chamado de paridade.
2. **SQL Server exige runner Linux x64.** Falhas locais em ARM estão
   registradas e não substituem a célula.
3. **Generator do Prisma.** Sem ele, o manifesto é escrito à mão e pode divergir
   do `schema.prisma` sem que nada acuse.
4. **Drizzle 1.x em RC.** Trava a estável por decisão de design.
5. **`like` literal no Prisma.** Divergência documentada, não resolvida.
6. **Coleção aninhada sob outra relação no Drizzle** falha fechado.
7. **Collector de perfil certificado por banco** não existe.
8. **Cobertura de branches do adapter TypeORM** em 75%.

## Como reproduzir

```bash
pnpm install
pnpm test              # 42 suites, 654 testes — inclui os 3 corpus de referência
pnpm typecheck
pnpm lint
pnpm verify:package    # build + publint + attw + consumidores CJS/ESM

# matriz real: exige os bancos do perfil certificado
pnpm db:up
DQB_DIALECT=postgres DQB_PG_URL=postgres://dqb:dqb@localhost:55432/dqb pnpm test:integration
pnpm db:down
```

`pnpm test` gera o client Prisma antes de rodar (`pretest`) e usa
`--experimental-vm-modules`, porque o runtime do Prisma 7 se carrega por
`import()` dinâmico.
