# nestjs-rest-query v3

A v3 é uma reescrita em torno de um núcleo semântico canônico. A entrada HTTP
vira uma AST tipada, validada contra um schema lógico e autorizada por regras
exatas; os adapters apenas compilam esse plano para a API do ORM.

**Comece por [`status.md`](./status.md)** — é lá que está o que já funciona, o
que não funciona e o que bloqueia a `3.0.0`.

| Documento                                                                           | Para quê                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`status.md`](./status.md)                                                          | Estado por fase, por adapter, gates e bloqueadores       |
| [`migration-from-v2.md`](./migration-from-v2.md)                                    | Guia de migração v2 → v3, com antes/depois               |
| [`parity.md`](./parity.md)                                                          | Como a paridade é medida e como declarar uma divergência |
| [design aprovado](../superpowers/specs/2026-09-03-v3-paridade-orm-bancos-design.md) | A decisão original, congelada                            |

## As quatro decisões que explicam o resto

1. **Coerção vem do tipo do campo, nunca da aparência do texto.** `"00430123"`
   continua string; `"10abc"` é 400. Não existe modo legado.
2. **Whitelist é exata.** Autorizar `company` não autoriza `company.name`.
3. **Perfil textual portável.** `ilike` e `search` consultam uma coluna dobrada
   (`NFC` + minúsculas), comparada literalmente — sem `ILIKE`, sem
   `mode: 'insensitive'`, sem depender de collation.
4. **Metadado ausente falha fechado.** Não há fallback que "tente adivinhar".

## Estado dos adapters, em uma linha

Os três passam o corpus de paridade no dialeto de referência (SQLite). Nenhum
foi medido contra os três bancos reais. Detalhes e ressalvas em
[`status.md`](./status.md).
