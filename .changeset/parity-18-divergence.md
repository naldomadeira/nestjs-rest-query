---
'nestjs-rest-query': patch
---

docs(parity): mark `?sort=<many-rel>.<col>` as an intentional adapter divergence

TypeORM permits sorting through a `'many'` relation (legacy: returns the first arbitrary row of the join), while Drizzle and Prisma reject with 400. The behavior is now explicitly documented in `MIGRATION.md` under "Intentional adapter divergences", and the parity matrix encodes it via the new `accept` field on each test case so a future regression in any direction surfaces immediately. No code change in this entry — only docs and test infrastructure.
