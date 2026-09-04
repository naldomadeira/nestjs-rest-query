# Como a paridade é medida

A definição da §5 do design é observável: para a mesma query, regras, schema e
seed, as nove combinações de ORM e banco devem produzir o mesmo status, código
de erro, conjunto e ordem de IDs, paginação, shape e valores JSON. O SQL gerado
não faz parte do contrato.

## O corpus é dado, não código

`tests/v3/corpus/` guarda o contrato como dado: o modelo canônico, o seed e 66
casos com status, código de erro, IDs, ordem, total e shape esperados.

```
tests/v3/corpus/
  model.ts        modelo canônico — cada adapter deriva daqui suas tabelas
  seed.ts         dados, em NFC, com as colunas *_folded já preenchidas
  cases.ts        os 66 casos e suas expectativas
  corpus.types.ts tipos, incluindo o de divergência
```

O mesmo caso alimenta três coisas: os contract tests no dialeto de referência,
a matriz de integração real e o inventário de divergências. Isso é deliberado —
paridade vira **comparação de dados**, não comportamento reimplementado por
adapter.

## Um runner, três adapters

`runCorpusCase(testCase, source)` recebe uma `QuerySource` pronta. Nenhum
adapter tem runner próprio: uma suíte paralela seria livre para ser mais
permissiva, que é exatamente o que o corpus existe para impedir.

```
tests/v3/adapters/typeorm/corpus-contract.spec.ts
tests/v3/adapters/prisma/corpus-contract.spec.ts
tests/v3/adapters/drizzle/corpus-contract.spec.ts
tests/v3/integration/corpus-database.spec.ts     ← matriz real
```

## Dialeto de referência não é célula da matriz

SQLite prova que o compilador implementa a semântica do plano. Ele **não**
prova paridade: não tem as collations, os fusos, as precisões nem as
conversões de driver dos três bancos suportados. A promessa é medida em
`tests/v3/integration/`, contra o perfil certificado.

Confundir os dois é a forma mais fácil de superestimar o estado do projeto.

## Declarar uma divergência

Quando um ORM **não consegue** expressar a semântica canônica, a diferença é
declarada no próprio caso:

```ts
{
  id: 'like/underscore-is-literal',
  // ...
  expect: { kind: 'rows', ids: [10], total: 1, lastPage: 1 },
  divergences: {
    prisma: {
      reason: 'por que o adapter não consegue — obrigatório',
      expect: { kind: 'rows', ids: [/* o que ele realmente devolve */] },
    },
  },
}
```

Três propriedades tornam isso diferente de um skip:

1. O resultado divergente é comparado com o **mesmo rigor** do canônico.
2. Se o adapter voltar a concordar, o teste **quebra** e obriga a remover a
   exceção — uma isenção não sobrevive à limitação que a justificou.
3. `corpus.spec.ts` mantém um inventário: adicionar uma divergência muda uma
   lista revisada, em vez de passar despercebida entre 66 casos.

Divergência é proibida em caso que espera erro. Recusar entrada inválida é
obrigação de todos os adapters, e o núcleo decide isso antes de qualquer um
deles rodar.

As divergências vigentes estão em [`status.md`](./status.md#divergências-intencionais).

## Perfis de banco

Paridade não é prometida sobre configuração arbitrária. `test/profiles/` fixa
DDL, collation, timezone e índices para PostgreSQL 18, MySQL 8.4 e SQL Server
2022, com `docker compose`.

Hoje o runtime **valida** os fatos de perfil que o chamador fornece, mas não
existe collector que os colete por conta própria. Até existir, o perfil
certificado é gate parcialmente implementado — não um selo automático.
