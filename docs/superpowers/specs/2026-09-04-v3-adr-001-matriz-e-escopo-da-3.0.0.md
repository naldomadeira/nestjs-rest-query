# ADR-001 — Matriz de nove células, peer fechado e escopo da `3.0.0`

> **Status:** Aceito em 2026-09-04.
> **Owner:** Opus.
> **Emenda:** §6.2, §25.8 e a divergência declarada do Prisma no
> [design de 2026-09-03](./2026-09-03-v3-paridade-orm-bancos-design.md).
> **Bloqueia:** nada. Habilita a fase 6.

O design de 2026-09-03 continua sendo o registro da decisão original e **não
foi editado**. Este ADR registra três emendas a ele, o fato que motivou cada
uma e o mecanismo que a torna segura.

---

## Por que existe

A decisão §25.8 amarrou a `3.0.0` estável a "Drizzle/MSSQL estável". Em
2026-09-04, ao verificar o estado real em vez de reler o `status.md`, três
fatos apareceram — e dois deles invertem a premissa da decisão original.

### Fato 1 — `drizzle-orm@1.0.0-rc.4` já tem driver MSSQL

O tarball publicado traz `node-mssql/` completo (driver, pool, session,
migrator) e `mssql-core/`. O `status.md` dizia "enquanto não houver GA **com
suporte a MSSQL**", conflando duas coisas distintas: o suporte a SQL Server
existe desde o RC; o que não existe é o GA. Esperar o GA para _ganhar MSSQL_ é
esperar por algo que já chegou.

### Fato 2 — as três células reais estão bloqueadas, e o motivo não é o MSSQL

`drizzleDatabase()` executa por `client.all(query)`. Medido em runtime contra o
`rc.4`, inspecionando o prototype de cada `db`:

| dialeto (driver)           | `db.all`       | `db.execute` | forma do retorno de `execute` |
| -------------------------- | -------------- | ------------ | ----------------------------- |
| sqlite (`better-sqlite3`)  | **`function`** | `undefined`  | — (`all` devolve `Row[]`)     |
| postgres (`node-postgres`) | `undefined`    | `function`   | `{ rows, rowCount, fields }`  |
| postgres (`postgres-js`)   | `undefined`    | `function`   | `RowList` — **já é `Row[]`**  |
| mysql (`mysql2`)           | `undefined`    | `function`   | **tupla** `[rows, fields]`    |
| mssql (`node-mssql`)       | `undefined`    | `function`   | `{ recordset, rowsAffected }` |

`all()` é **exclusivo do SQLite** no objeto `db`: o único `db.d.ts` do pacote
que o declara é o de `sqlite-core`. Em MSSQL existe `db.session.all` — na
_session_, não no `db` — o que explica por que uma leitura só dos `.d.ts` de
`mssql-core/session.d.ts` sugere suporte que a API pública não tem.

Portanto o guard em `drizzle-database.ts:165` lança para **Postgres, MySQL e
SQL Server**: as três células reais, não duas. O
`as unknown as DrizzleClientLike` no harness de teste é o que impediu o
compilador de acusar isso, e o comentário em `drizzle-database.ts:13` — que diz
que `all()` existe nos drivers assíncronos — vale só dentro da família SQLite.

A consequência é que o corpus 66/66 do Drizzle prova **SQLite, e só**.

### Fato 3 — não existe `drizzle-orm` 1.x estável

`latest` é `0.45.2`; a tag `rc` aponta para `1.0.0-rc.4`. Não há data de GA.
Manter §25.8 ao pé da letra significa uma v3 em pré-release por tempo
indeterminado, decidido por terceiros.

---

## Emenda 1 — nove células e `3.0.0` estável sobre peer fechado

**Substitui** §25.8 item 8 ("A versão estável depende de Drizzle/MSSQL estável e
matriz sem skips") e o trecho de §6.2 que restringe combinações experimentais a
pré-release.

A `3.0.0` estável exige as **nove células reais verdes, sem skips** — isso não
muda. O que muda é que o _status de pré-release do `drizzle-orm`_ deixa de
bloquear a estável, porque o risco que §25.8 tentava conter não era o RC em si:
era um GA não testado entrando pela faixa de peer.

**Mecanismo:** a faixa passa de `>=1.0.0-rc.4 <2.0.0` para
`>=1.0.0-rc.4 <1.0.0`. Em semver, prereleases de `1.0.0` são menores que
`1.0.0`, então a faixa aceita exatamente os RCs medidos na matriz e **recusa o
GA** até que uma release nossa, com a matriz reexecutada, o admita.

A faixa antiga era o furo real: o `1.0.0` GA a satisfaria sem nunca ter rodado
uma célula, e a promessa de paridade viraria falsa sem ninguém mudar uma linha.

## Emenda 2 — a divergência `like` do Prisma é resolvida, não acomodada

**Retira** a divergência `like/underscore-is-literal` do inventário de exceções
permanentes, restaurando a §11 para os cinco operadores de padrão (`like`,
`notLike`, `ilike`, `notIlike`, `search`) no adapter Prisma.

A divergência foi registrada porque o Prisma compila `contains` sem cláusula
`ESCAPE` e o client tipado não permite fornecê-la. O que a análise original não
considerou: **em Postgres e MySQL, `\` já é o caractere de escape default do
`LIKE`** — e o perfil certificado de MySQL (`test/profiles/mysql/profile.sql`)
usa `STRICT_ALL_TABLES` sem `NO_BACKSLASH_ESCAPES`, então o default vale. Só o
SQL Server não tem escape default e exige a cláusula.

Duas medições feitas depois disso reduziram as opções, e vale registrar as
duas porque a primeira redação deste ADR estava otimista.

**Medição 1 — o SQLite também não tem escape default.** Contra
`better-sqlite3`, `v LIKE 'a\_b'` sem cláusula casa a string literal `a\_b`, e
não `a_b`; `v LIKE '100\%'` não casa nada. Como o dialeto de referência do
Prisma é o SQLite (`DIALECT_BY_PROVIDER`), o escape nativo cobre 2 de 4
dialetos, não 3.

**Medição 2 — `$queryRaw` não é saída.** A API tipada do Prisma não aceita
fragmento SQL dentro da árvore de `where`, então o operador de padrão só
poderia ser pré-resolvido para um conjunto de PKs e injetado como
`{ pk: { in: [...] } }`. Isso é semanticamente correto, mas o SQL Server tem
limite de 2100 parâmetros: um `like` que casa mais de 2100 linhas falharia —
justamente na célula que a solução existia para consertar.

**Decisão:** onde o escape nativo funciona, usá-lo; onde não funciona, **falhar
alto**. Postgres e MySQL recebem `patternEscape: 'native'` com `\`. SQLite e
SQL Server recebem `patternEscape: 'unsupported'`, e o adapter recusa os cinco
operadores com `CAPABILITY_UNAVAILABLE` — código que já existe em
`error-codes.ts`, então o contrato de erros não muda.

Isso satisfaz a §5.6: um erro nomeado não é aproximação silenciosa. E mantém o
gate das nove células, porque o corpus declara a expectativa **por célula**,
pelo mesmo mecanismo que hoje declara divergência em `cases.ts` — o caso roda,
casa a expectativa declarada, e o `assert-no-skips` continua passando. O que
muda em relação à divergência antiga é a natureza da falha: antes, um resultado
errado silencioso; agora, uma recusa explícita.

**Custo aceito:** um consumidor Prisma em SQLite ou SQL Server não tem `like`,
`notLike`, `ilike`, `notIlike` nem `search`. É uma perda de recurso visível,
declarada no manifesto, e preferível a devolver o conjunto errado de linhas.

**Consequência no contrato:** `AdapterCapabilities.escapeCharacter` não
consegue expressar "com ou sem cláusula `ESCAPE`", nem "impossível". Hoje
`prisma.adapter.ts` declara `escapeCharacter: '!'` e o adapter nunca emite a
cláusula — uma capability que não descreve o comportamento real, que é
exatamente como a divergência passou. O contrato ganha
`patternEscape: 'clause' | 'native' | 'unsupported'`, com `escapeCharacter`
vazio quando `unsupported`, e um contract test verifica a equivalência para que
a capability não possa voltar a mentir.

## Emenda 3 — generator e codemod saem da `3.0.0`

**Reduz** o escopo da fase 7 sem enfraquecer nenhum gate da §23.

**Generator do Prisma → validador.** O furo nomeado é "o manifesto é escrito à
mão e pode divergir do `schema.prisma` sem que nada acuse". Um validador que lê
o `schema.prisma` e falha quando o manifesto divergir fecha esse furo; o
generator é conveniência de DX. Comparar também é mais fácil de manter correto
que derivar — e é o comparador que protege a paridade. Generator vai para a
`3.1.0`.

**Codemod → fora.** O gate da §23 é "migration guide validado num consumidor v2
real", não "codemod existe". Um codemod não validado seria pior que nenhum:
transforma imports e deixa o usuário achando que terminou, quando as decisões
de schema — que o próprio design (§linha 728) diz que codemod não cobre —
continuam pendentes. O `MIGRATION.md` passa a ser validado contra um projeto v2
real, que é o que o gate pede.

---

## O que este ADR não muda

- A definição de "funcionar perfeitamente" da §5, item por item.
- "Nove células reais verdes, sem skips" como gate da estável.
- A proibição de skips e de recurso aproximado silenciosamente (§5.6).
- O perfil certificado da §6.3 — ao contrário, ele fica mais forte: o collector
  de fatos, que hoje existe só em código de teste, é promovido para `src/`, de
  modo que `PORTABILITY_PROFILE_MISMATCH` deixe de depender de o chamador
  informar fatos honestos.

## Risco aceito, declarado

A `3.0.0` estável terá um peer de pré-release (`drizzle-orm` 1.x RC). Isso é
deliberado e está contido pela faixa fechada. Quando o GA sair, ele exige uma
release nossa: reexecutar a matriz, ampliar a faixa, publicar. Até então, um
consumidor que force o GA por override recebe uma combinação que nunca foi
medida — e a faixa é o que documenta isso.
