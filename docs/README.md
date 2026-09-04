# Documentação

A documentação é versionada por major da biblioteca, porque a v3 é uma
reescrita com breaking changes: misturar as duas faria cada página precisar
dizer "na v2 isto, na v3 aquilo".

| Versão | Estado             | Onde                                                    |
| ------ | ------------------ | ------------------------------------------------------- |
| v3     | em desenvolvimento | [`v3/`](./v3/)                                          |
| v2     | manutenção crítica | [`../MIGRATION.md`](../MIGRATION.md) e o site publicado |

O site em `apps/docs` ainda descreve a v2. Enquanto a v3 não for publicada,
esta pasta é a fonte da verdade sobre ela.

## Artefatos de processo

`superpowers/` guarda o design aprovado e o plano de execução, com data no
nome. São registros de decisão: não devem ser editados para refletir o estado
atual — para isso existe [`v3/status.md`](./v3/status.md).
