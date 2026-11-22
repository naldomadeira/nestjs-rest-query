# Matriz pública de versões

Esta é a matriz que a `3.0.0` promete, e ela existe para coincidir com o que a
CI realmente executa. Coincidir não é promessa: `tests/v3/package/supported-matrix.spec.ts`
compara esta página com `.github/workflows/database-matrix.yml` e com as faixas
de peer do `package.json`, e falha quando divergirem.

Uma combinação só entra aqui depois de a célula correspondente ficar verde, sem
skip. O estado de cada célula está em [`status.md`](./status.md) — esta página
diz o que é **suportado**, não o que já foi medido.

## Células da matriz

Nove combinações, medidas pelo mesmo corpus e pelas mesmas expectativas.

|             | PostgreSQL | MySQL  | SQL Server |
| ----------- | ---------- | ------ | ---------- |
| **TypeORM** | célula     | célula | célula     |
| **Prisma**  | célula     | célula | célula     |
| **Drizzle** | célula     | célula | célula     |

O SQLite **não** é célula: é o dialeto de referência, usado para provar que o
compilador de cada adapter implementa a semântica do plano. Ele roda em
`pnpm test`, é rápido e não exige container — e um verde ali não é paridade.

## Versões exercitadas

| Dimensão   | Alvo principal       | Onde é exercitado                                                |
| ---------- | -------------------- | ---------------------------------------------------------------- |
| Node.js    | 24.x                 | `database-matrix`; `ci` também roda 22.x                         |
| NestJS     | 11.x                 | `test-peers`                                                     |
| TypeORM    | 1.1.x                | matriz; 0.3.x na suíte de compatibilidade                        |
| Prisma     | 7.8.0 (CLI e client) | matriz, com driver adapter oficial por dialeto                   |
| Drizzle    | 1.0.0-rc.4           | matriz, via `postgres-js`, `mysql2` e `node-mssql`               |
| Drizzle    | 0.45.4               | referência, PostgreSQL e MySQL (`database-matrix`, `test-peers`) |
| Fastify    | 5.12                 | `tests/v3/api/fastify.spec.ts`, com e sem o parser `qs`          |
| PostgreSQL | 18                   | `postgres:18`                                                    |
| MySQL      | 8.4 LTS              | `mysql:8.4`                                                      |
| SQL Server | 2022                 | `mcr.microsoft.com/mssql/server:2022-latest`                     |

## Faixas de peer dependency

| Peer             | Faixa                              | Por quê                                                                                                                                    |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `typeorm`        | `^0.3.26 \|\| ^1.0.0`              | as duas majors passam o corpus                                                                                                             |
| `@prisma/client` | `^6.19.0 \|\| ^7.0.0`              | 7.x é o alvo; 6.19 em compatibilidade                                                                                                      |
| `drizzle-orm`    | `^0.45.0 \|\| >=1.0.0-rc.4 <1.0.0` | 0.45 é a linha estável, medida em PostgreSQL e MySQL; a 1.x fica fechada abaixo do GA, que exige uma release nossa que reexecutou a matriz |
| `@nestjs/common` | `^11.0.0`                          | major seguinte só após suíte própria (§6.2)                                                                                                |

Os quatro são **opcionais**: o pacote raiz não carrega ORM nenhum, e isso é
provado por consumidor isolado em `verify:package`.

### Por que a faixa do Drizzle tem duas linhas

Até o `3.0.0-alpha.2` a faixa era só `>=1.0.0-rc.4 <1.0.0`. Com a `latest` do
`drizzle-orm` em `0.45.4`, isso fazia uma versão estável da biblioteca exigir um
prerelease de outro projeto — e deixava de fora todo consumidor v2 de Drizzle.
O adapter só depende do template `sql` e do `all()`/`execute()` dos clients,
que a `0.45` já tem com as mesmas formas de retorno; medido o 0.45.4 no corpus
de referência e nas células PostgreSQL e MySQL, a linha entrou sem mudança de
código. A faixa ficou:

- `^0.45.0` — a linha estável, sem SQL Server (o `0.45` não tem o driver);
- `>=1.0.0-rc.4 <1.0.0` — os RCs, abaixo do GA. `<2.0.0` admitiria o `1.0.0`
  sem nenhuma célula rodada, e `exports-map.spec.ts` recusa esse alargamento
  até uma release nossa reexecutar a matriz no GA.

## O que não é suportado

- **Drizzle `0.45.x` com SQL Server.** O `0.45` não tem driver de SQL Server
  (`drizzle-orm/node-mssql` nasce no 1.x), então essa célula não existe. Com
  Drizzle, SQL Server exige a linha 1.x.
- **Drizzle `1.0.0-rc.5` em diante, medido na matriz.** A partir do rc.5 o
  `drizzle-orm` passou a ser ESM-only, e o harness da matriz (Jest em CJS) não
  o carrega. A faixa de peer os admite e o `dist` publicado funciona com o rc.6
  em CJS e ESM no Node 22.12+ (que carrega ESM por `require`) — verificado por
  smoke contra PostgreSQL —, mas a paridade só está medida no rc.4.
- **Operadores de padrão do Prisma em SQL Server** (`like`, `notLike`, `ilike`,
  `notIlike`, `search`). O Prisma não emite cláusula `ESCAPE` e o SQL Server não
  tem caractere de escape default, então `%` e `_` não podem ser literais como a
  §11 exige. O adapter recusa com `CAPABILITY_UNAVAILABLE` em vez de devolver o
  conjunto errado de linhas. A mesma recusa vale no SQLite, que tem o mesmo
  vazio de escape default — não é célula, mas é o dialeto de referência, então
  vale saber. Em `postgresql` e `mysql` os cinco operadores **funcionam** e `%`
  e `_` são literais, porque `\` é o escape default do `LIKE` nos dois. Ver
  [ADR-001](../superpowers/specs/2026-09-04-v3-adr-001-matriz-e-escopo-da-3.0.0.md),
  emenda 2.
- **Qualquer configuração de banco fora do perfil certificado** (§6.3). A
  paridade é prometida sobre o perfil publicado em `test/profiles/`, e o
  `collectProfileFacts` existe para o consumidor verificar o próprio banco
  contra ele.
