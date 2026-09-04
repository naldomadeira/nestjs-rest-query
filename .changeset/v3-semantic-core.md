---
'nestjs-rest-query': major
---

v3: núcleo semântico canônico, autorização por path exato, coerção dirigida
pelo tipo do campo, perfil textual portável, sources discriminadas e subpaths
de adapter isolados.

A entrada HTTP passa a virar uma AST tipada, validada contra um schema lógico e
autorizada por regras exatas; os adapters apenas compilam esse plano. A coerção
deixa de ser orientada pela aparência do texto, `%`/`_`/`\` viram literais,
`in=[]` retorna zero linhas, a projeção deixa de injetar a PK no JSON e os erros
ganham um envelope com código estável.

Breaking. Ver `docs/migration/v2-to-v3.md`.
